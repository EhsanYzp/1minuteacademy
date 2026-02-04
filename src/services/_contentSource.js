export function getContentSource() {
  // 'supabase' (default) or 'local'
  const raw = import.meta.env.VITE_CONTENT_SOURCE;
  if (raw === 'local') return 'local';
  return 'supabase';
}
