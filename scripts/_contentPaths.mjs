import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT = path.resolve(__dirname, '..');
export const CONTENT_DIR = path.join(ROOT, 'content');
export const TOPICS_DIR = path.join(CONTENT_DIR, 'topics');
export const COURSE_PLANS_DIR = path.join(CONTENT_DIR, 'course-plans');
export const CATALOG_DIR = path.join(CONTENT_DIR, 'catalog');
export const SCHEMA_DIR = path.join(CONTENT_DIR, 'schema');
