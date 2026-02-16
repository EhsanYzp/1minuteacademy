import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient';

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

function buildCertificateSvg({
  certificateId,
  subject,
  recipientName,
  awardedAt,
}) {
  const id = escapeXml(String(certificateId ?? '').slice(0, 36));
  const subj = escapeXml(subject ?? 'General');
  const name = escapeXml(recipientName ?? 'Member');
  const dateLabel = escapeXml(fmtShortDate(awardedAt) || fmtShortDate(new Date().toISOString()));

  // A4 landscape-ish at 1600x1131 (keeps crisp PNG previews).
  const w = 1600;
  const h = 1131;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f7fbff"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#4ECDC4"/>
      <stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#0b1220" flood-opacity="0.10"/>
    </filter>
    <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.5" fill="#0b1220" opacity="0.06"/>
    </pattern>
  </defs>

  <rect x="0" y="0" width="${w}" height="${h}" fill="url(#bg)"/>
  <rect x="0" y="0" width="${w}" height="${h}" fill="url(#dots)"/>

  <!-- Fun touch: tiny 60s stamp -->
  <g transform="translate(1320 120) rotate(-8)">
    <rect x="0" y="0" width="200" height="70" rx="16" fill="#fff" stroke="#0b1220" stroke-opacity="0.12"/>
    <text x="100" y="46" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="28" font-weight="900" fill="#0b1220" opacity="0.86">60s</text>
  </g>

  <!-- Main certificate card -->
  <g filter="url(#shadow)">
    <rect x="90" y="90" width="1420" height="951" rx="34" fill="#ffffff"/>
    <rect x="90" y="90" width="1420" height="951" rx="34" fill="none" stroke="#0b1220" stroke-opacity="0.10" stroke-width="2"/>

    <!-- Border accent -->
    <rect x="120" y="120" width="1360" height="891" rx="28" fill="none" stroke="url(#accent)" stroke-width="6" opacity="0.55"/>

    <!-- Header -->
    <text x="800" y="220" text-anchor="middle" font-family="ui-serif, Georgia, 'Times New Roman'" font-size="54" font-weight="900" fill="#0b1220" opacity="0.92">Certificate of Completion</text>
    <text x="800" y="270" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="20" font-weight="700" fill="#0b1220" opacity="0.60">1 Minute Academy</text>

    <!-- Recipient -->
    <text x="800" y="385" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="22" font-weight="800" fill="#0b1220" opacity="0.55">This certifies that</text>
    <text x="800" y="455" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="58" font-weight="950" fill="#0b1220" opacity="0.94">${name}</text>

    <text x="800" y="535" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="22" font-weight="800" fill="#0b1220" opacity="0.55">has completed all modules in</text>

    <!-- Subject award -->
    <text x="800" y="620" text-anchor="middle" font-family="ui-serif, Georgia, 'Times New Roman'" font-size="52" font-weight="900" fill="#0b1220" opacity="0.92">${subj}</text>
    <text x="800" y="680" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="28" font-weight="950" fill="url(#accent)">${subj} 1 Minute Expert</text>

    <!-- Footer -->
    <g transform="translate(180 835)">
      <path d="M0 30 H420" stroke="#0b1220" stroke-opacity="0.12" stroke-width="2"/>
      <text x="0" y="65" font-family="ui-sans-serif, system-ui, -apple-system" font-size="18" font-weight="800" fill="#0b1220" opacity="0.70">Awarded</text>
      <text x="0" y="95" font-family="ui-sans-serif, system-ui, -apple-system" font-size="20" font-weight="900" fill="#0b1220" opacity="0.90">${dateLabel}</text>
    </g>

    <g transform="translate(1000 835)">
      <path d="M0 30 H420" stroke="#0b1220" stroke-opacity="0.12" stroke-width="2"/>
      <text x="0" y="65" font-family="ui-sans-serif, system-ui, -apple-system" font-size="18" font-weight="800" fill="#0b1220" opacity="0.70">Certificate ID</text>
      <text x="0" y="95" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas" font-size="18" font-weight="900" fill="#0b1220" opacity="0.86">${id}</text>
    </g>

    <!-- Friendly wink -->
    <text x="800" y="985" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="16" font-weight="750" fill="#0b1220" opacity="0.52">Built for people who hate long courses.</text>
  </g>
</svg>`;
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
  if (!path) return null;
  if (!isSupabaseConfigured) return null;
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(String(path));
    return data?.publicUrl ?? null;
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
  const awardedAt = row?.awarded_at ?? null;

  const svg = buildCertificateSvg({
    certificateId: row.id,
    subject,
    recipientName,
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
