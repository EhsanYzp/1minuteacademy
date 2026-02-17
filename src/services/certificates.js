import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient';
import { renderCertificateSvgTemplate } from './certificateSvgTemplate';

const BUCKET = 'certificates';

function requireSupabase() {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured');
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');
  return supabase;
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeFilePart(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_.]/g, '')
    .slice(0, 48) || 'certificate';
}

function fmtShortDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
  } catch {
    return '';
  }
}

function initialsFromName(name) {
  const s = String(name ?? '').trim();
  if (!s) return '?';
  const parts = s.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase() || '?';
}

async function tryFetchAsDataUrl(url) {
  const u = String(url ?? '').trim();
  if (!u) return null;
  try {
    const res = await fetch(u, { mode: 'cors', credentials: 'omit', cache: 'no-store' });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob || !blob.type) return null;
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return dataUrl.startsWith('data:') ? dataUrl : null;
  } catch {
    return null;
  }
}

function buildCertificateSvg({
  certificateId,
  subject,
  recipientName,
  recipientAvatarDataUrl,
  awardedAt,
}) {
  const id = escapeXml(String(certificateId ?? '').slice(0, 36));
  const subj = escapeXml(subject ?? 'General');
  const name = escapeXml(recipientName ?? 'Member');
  const dateLabel = escapeXml(fmtShortDate(awardedAt) || fmtShortDate(new Date().toISOString()));
  const avatarHref = recipientAvatarDataUrl ? escapeXml(recipientAvatarDataUrl) : '';

  // A4 landscape-ish at 1600x1131 (keeps crisp PNG previews).
  return renderCertificateSvgTemplate({
    width: 1600,
    height: 1131,
    certificateId: id,
    subject: subj,
    recipientName: name,
    dateLabel,
    recipientAvatarHref: avatarHref,
  });
}

async function svgToPngBlob(svg, { width = 1600, height = 1131 } = {}) {
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    const pngBlob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to export PNG'))), 'image/png', 0.92);
    });

    return pngBlob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function listMyCertificates() {
  if (!isSupabaseConfigured) return [];
  const supabase = requireSupabase();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const user = userData?.user;
  if (!user) throw new Error('Please sign in first');

  const { data, error } = await supabase
    .from('user_certificates')
    .select('id, user_id, subject, title, recipient_name, recipient_avatar_url, total_topics, completed_topics, awarded_at, svg_path, png_path, created_at, updated_at')
    .order('awarded_at', { ascending: false });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export function getCertificatePublicUrlFromPath(path) {
  return getCertificatePublicUrlFromPathWithOptions(path, {});
}

export function getCertificatePublicUrlFromPathWithOptions(path, { cacheBuster } = {}) {
  if (!path) return null;
  if (!isSupabaseConfigured) return null;
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(String(path));
    const base = data?.publicUrl ?? null;
    if (!base) return null;

    const token = cacheBuster == null ? '' : String(cacheBuster);
    if (!token) return base;
    const join = base.includes('?') ? '&' : '?';
    return `${base}${join}v=${encodeURIComponent(token)}`;
  } catch {
    return null;
  }
}

export async function generateAndUploadMyCertificate({ certificateRow }) {
  const row = certificateRow;
  if (!row?.id) throw new Error('Invalid certificate');
  if (!isSupabaseConfigured) throw new Error('Supabase not configured');

  const supabase = requireSupabase();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const user = userData?.user;
  if (!user) throw new Error('Please sign in first');

  const subject = String(row?.subject ?? 'General');
  const recipientName = String(row?.recipient_name ?? 'Member');
  const recipientAvatarUrl = row?.recipient_avatar_url ? String(row.recipient_avatar_url) : null;
  const awardedAt = row?.awarded_at ?? null;

  const recipientAvatarDataUrl = recipientAvatarUrl ? await tryFetchAsDataUrl(recipientAvatarUrl) : null;

  const svg = buildCertificateSvg({
    certificateId: row.id,
    subject,
    recipientName,
    recipientAvatarDataUrl,
    awardedAt,
  });

  const pngBlob = await svgToPngBlob(svg);
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });

  const prefix = `${user.id}/${row.id}`;
  const slug = safeFilePart(subject);
  const svgPath = `${prefix}/${slug}.certificate.svg`;
  const pngPath = `${prefix}/${slug}.certificate.png`;

  const { error: svgErr } = await supabase.storage.from(BUCKET).upload(svgPath, svgBlob, {
    upsert: true,
    cacheControl: '3600',
    contentType: 'image/svg+xml',
  });
  if (svgErr) throw svgErr;

  const { error: pngErr } = await supabase.storage.from(BUCKET).upload(pngPath, pngBlob, {
    upsert: true,
    cacheControl: '3600',
    contentType: 'image/png',
  });
  if (pngErr) throw pngErr;

  const { data: updated, error: updateErr } = await supabase
    .from('user_certificates')
    .update({ svg_path: svgPath, png_path: pngPath })
    .eq('id', row.id)
    .select('id, user_id, subject, title, recipient_name, recipient_avatar_url, total_topics, completed_topics, awarded_at, svg_path, png_path, created_at, updated_at')
    .single();

  if (updateErr) throw updateErr;
  return updated;
}

export async function updateMyCertificateRecipient({ certificateId, recipientName, recipientAvatarUrl = null }) {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured');
  const supabase = requireSupabase();

  const id = String(certificateId ?? '').trim();
  if (!id) throw new Error('Invalid certificate');

  const nextName = String(recipientName ?? '').trim();
  if (!nextName) throw new Error('Recipient name is required');

  const nextAvatar = recipientAvatarUrl ? String(recipientAvatarUrl) : null;

  const { data: updated, error } = await supabase
    .from('user_certificates')
    .update({ recipient_name: nextName, recipient_avatar_url: nextAvatar })
    .eq('id', id)
    .select('id, user_id, subject, title, recipient_name, recipient_avatar_url, total_topics, completed_topics, awarded_at, svg_path, png_path, created_at, updated_at')
    .single();

  if (error) throw error;
  return updated;
}
