const DISPLAY_SUBJECT_ALIASES = new Map([
  // Keep DB/content value stable, but simplify UI label.
  ['AI & Agents', 'AI'],
]);

const QUERY_SUBJECT_ALIASES = new Map([
  // Map UI label back to DB/content value.
  ['AI', 'AI & Agents'],
]);

export function toDisplaySubject(raw) {
  const subject = String(raw ?? '').trim() || 'General';
  return DISPLAY_SUBJECT_ALIASES.get(subject) ?? subject;
}

export function toQuerySubject(raw) {
  const subject = String(raw ?? '').trim();
  if (!subject || subject === 'All') return null;
  return QUERY_SUBJECT_ALIASES.get(subject) ?? subject;
}
