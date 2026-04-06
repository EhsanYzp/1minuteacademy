import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { makeTopicOgSvg } from '../../src/lib/topicOg.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const TOPICS_PATH = path.join(ROOT, 'public', 'topics.json');
const FALLBACK_OG_PATH = path.join(ROOT, 'public', 'og', 'og-image.png');

let topicsByIdPromise = null;
const imageBufferCache = new Map();

async function loadTopicsById() {
  if (!topicsByIdPromise) {
    topicsByIdPromise = fs.readFile(TOPICS_PATH, 'utf8').then((raw) => {
      const parsed = JSON.parse(raw);
      const topics = Array.isArray(parsed?.topics) ? parsed.topics : [];
      return new Map(topics.map((topic) => [String(topic?.id ?? '').trim(), topic]));
    });
  }
  return topicsByIdPromise;
}

function getTopicId(req) {
  const value = req?.query?.topicId ?? req?.query?.id ?? '';
  return String(value).trim();
}

async function getFallbackBuffer() {
  return fs.readFile(FALLBACK_OG_PATH);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const topicId = getTopicId(req);
  if (!topicId) {
    res.status(400).json({ error: 'Missing topicId' });
    return;
  }

  try {
    const topicsById = await loadTopicsById();
    const topic = topicsById.get(topicId);

    let buffer = imageBufferCache.get(topicId) ?? null;
    if (!buffer) {
      if (!topic) {
        buffer = await getFallbackBuffer();
      } else {
        const svg = makeTopicOgSvg({
          title: topic.title,
          emoji: '',
          color: topic.color,
        });
        buffer = await sharp(Buffer.from(svg)).png().toBuffer();
      }
      imageBufferCache.set(topicId, buffer);
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(topicId)}.png"`);
    res.status(200).send(buffer);
  } catch (error) {
    console.error('topic-image error', error);
    try {
      const fallback = await getFallbackBuffer();
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600');
      res.status(200).send(fallback);
    } catch {
      res.status(500).json({ error: 'Failed to generate topic image' });
    }
  }
}