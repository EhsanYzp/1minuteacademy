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
    const res = await fetch(u, { mode: 'cors', credentials: 'omit' });
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
  const initials = escapeXml(initialsFromName(recipientName));
  const dateLabel = escapeXml(fmtShortDate(awardedAt) || fmtShortDate(new Date().toISOString()));
  const avatarHref = recipientAvatarDataUrl ? escapeXml(recipientAvatarDataUrl) : '';

  // A4 landscape-ish at 1600x1131 (keeps crisp PNG previews).
  const w = 1600;
  const h = 1131;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f5fbff"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#4ECDC4"/>
      <stop offset="55%" stop-color="#3bb1e3"/>
      <stop offset="100%" stop-color="#2563eb"/>
    </linearGradient>
    <linearGradient id="ribbon" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fde68a"/>
      <stop offset="100%" stop-color="#f59e0b"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#0b1220" flood-opacity="0.10"/>
    </filter>
    <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.3" fill="#0b1220" opacity="0.06"/>
    </pattern>
    <clipPath id="avatarClip">
      <circle cx="0" cy="0" r="54" />
    </clipPath>
  </defs>

  <rect x="0" y="0" width="${w}" height="${h}" fill="url(#bg)"/>
  <rect x="0" y="0" width="${w}" height="${h}" fill="url(#dots)"/>

  <!-- Confetti corners (subtle) -->
  <g opacity="0.22">
    <circle cx="120" cy="130" r="10" fill="#4ECDC4"/>
    <circle cx="155" cy="165" r="6" fill="#2563eb"/>
    <circle cx="195" cy="125" r="7" fill="#f59e0b"/>
    <circle cx="1480" cy="120" r="9" fill="#4ECDC4"/>
    <circle cx="1446" cy="160" r="6" fill="#2563eb"/>
    <circle cx="1492" cy="178" r="7" fill="#f59e0b"/>
  </g>

  <!-- Fun touch: tiny 60s stamp -->
  <g transform="translate(1320 118) rotate(-8)">
    <rect x="0" y="0" width="200" height="70" rx="18" fill="#fff" stroke="#0b1220" stroke-opacity="0.12"/>
    <text x="100" y="46" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="28" font-weight="950" fill="#0b1220" opacity="0.86">60s</text>
  </g>

  <!-- Main certificate card -->
  <g filter="url(#shadow)">
    <rect x="90" y="90" width="1420" height="951" rx="36" fill="#ffffff"/>
    <rect x="90" y="90" width="1420" height="951" rx="36" fill="none" stroke="#0b1220" stroke-opacity="0.10" stroke-width="2"/>

    <!-- Border accent -->
    <rect x="120" y="120" width="1360" height="891" rx="30" fill="none" stroke="url(#accent)" stroke-width="7" opacity="0.58"/>

    <!-- Header bar -->
    <g transform="translate(160 150)">
      <rect x="0" y="0" width="1280" height="86" rx="22" fill="url(#accent)" opacity="0.12"/>
      <text x="640" y="56" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="22" font-weight="900" fill="#0b1220" opacity="0.78">1 Minute Academy</text>
    </g>

    <text x="800" y="310" text-anchor="middle" font-family="ui-serif, Georgia, 'Times New Roman'" font-size="64" font-weight="900" fill="#0b1220" opacity="0.93">Certificate of Completion</text>

    <!-- Avatar badge -->
    <g transform="translate(800 392)">
      <circle cx="0" cy="0" r="68" fill="url(#accent)" opacity="0.18"/>
      <circle cx="0" cy="0" r="62" fill="#fff" stroke="#0b1220" stroke-opacity="0.10" stroke-width="2"/>
      ${avatarHref ? `<g clip-path="url(#avatarClip)" transform="translate(0 0)">
        <image href="${avatarHref}" x="-54" y="-54" width="108" height="108" preserveAspectRatio="xMidYMid slice" />
      </g>` : `<text x="0" y="14" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="34" font-weight="950" fill="#0b1220" opacity="0.80">${initials}</text>`}
      <circle cx="0" cy="0" r="54" fill="none" stroke="url(#accent)" stroke-width="6" opacity="0.60"/>
    </g>

    <!-- Recipient -->
    <text x="800" y="505" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="22" font-weight="850" fill="#0b1220" opacity="0.56">This certifies that</text>
    <text x="800" y="585" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="60" font-weight="950" fill="#0b1220" opacity="0.95">${name}</text>

    <text x="800" y="655" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="22" font-weight="850" fill="#0b1220" opacity="0.56">has completed every module in</text>

    <!-- Subject award -->
    <text x="800" y="745" text-anchor="middle" font-family="ui-serif, Georgia, 'Times New Roman'" font-size="54" font-weight="900" fill="#0b1220" opacity="0.93">${subj}</text>

    <!-- Ribbon title -->
    <g transform="translate(480 780)">
      <path d="M60 0 H580 a26 26 0 0 1 26 26 v34 a26 26 0 0 1 -26 26 H60 a26 26 0 0 1 -26 -26 V26 A26 26 0 0 1 60 0 Z" fill="url(#ribbon)" opacity="0.95"/>
      <path d="M34 26 L0 43 L34 60" fill="#f59e0b" opacity="0.70"/>
      <path d="M666 26 L700 43 L666 60" fill="#f59e0b" opacity="0.70"/>
      <text x="320" y="58" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="26" font-weight="950" fill="#0b1220" opacity="0.90">${subj} 1 Minute Expert</text>
    </g>

    <!-- Footer -->
    <g transform="translate(180 905)">
      <path d="M0 30 H420" stroke="#0b1220" stroke-opacity="0.12" stroke-width="2"/>
      <text x="0" y="65" font-family="ui-sans-serif, system-ui, -apple-system" font-size="18" font-weight="850" fill="#0b1220" opacity="0.70">Awarded</text>
      <text x="0" y="95" font-family="ui-sans-serif, system-ui, -apple-system" font-size="20" font-weight="950" fill="#0b1220" opacity="0.90">${dateLabel}</text>
    </g>

    <g transform="translate(1000 905)">
      <path d="M0 30 H420" stroke="#0b1220" stroke-opacity="0.12" stroke-width="2"/>
      <text x="0" y="65" font-family="ui-sans-serif, system-ui, -apple-system" font-size="18" font-weight="850" fill="#0b1220" opacity="0.70">Certificate ID</text>
      <text x="0" y="95" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas" font-size="18" font-weight="900" fill="#0b1220" opacity="0.86">${id}</text>
    </g>

    <!-- Friendly wink -->
    <text x="800" y="1000" text-anchor="middle" font-family="ui-sans-serif, system-ui, -apple-system" font-size="16" font-weight="800" fill="#0b1220" opacity="0.50">Built for people who hate long courses. (Respect.)</text>
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
