const COMMON_PASSWORDS = [
  '123456',
  '123456789',
  '12345678',
  'password',
  'qwerty',
  'qwerty123',
  '111111',
  '123123',
  'abc123',
  'letmein',
  'admin',
  'welcome',
  'iloveyou',
  'monkey',
  'dragon',
  'sunshine',
  'princess',
  'football',
  'baseball',
  'master',
  'login',
  'passw0rd',
  'trustno1',
  '000000',
  '654321',
  '1q2w3e4r',
  '1q2w3e4r5t',
  'zaq12wsx',
  'asdfghjkl',
  'password1',
  'password123',
  'admin123',
  'welcome123',
  'iloveyou123',
  '1234',
  '12345',
  '1234567',
  '987654321',
  'aa123456',
  '123321',
  'qazwsx',
  'qazwsx123',
  'password!',
  'password@',
];

const COMMON_PASSWORD_SET = new Set(COMMON_PASSWORDS);

function normalizePassword(pw) {
  return String(pw ?? '')
    .trim()
    .toLowerCase();
}

function emailLocalPart(email) {
  if (!email || typeof email !== 'string') return null;
  const at = email.indexOf('@');
  if (at <= 0) return null;
  const local = email.slice(0, at).trim().toLowerCase();
  return local.length >= 3 ? local : null;
}

export function evaluatePasswordStrength(password, { email } = {}) {
  const value = String(password ?? '');
  const normalized = normalizePassword(value);

  const lengthOk = value.length >= 10;
  const hasLower = /[a-z]/.test(value);
  const hasUpper = /[A-Z]/.test(value);
  const hasNumber = /\d/.test(value);
  const hasSymbol = /[^A-Za-z0-9]/.test(value);

  const isCommon = COMMON_PASSWORD_SET.has(normalized);
  const local = emailLocalPart(email);
  const containsEmail = local ? normalized.includes(local) : false;

  const checks = {
    lengthOk,
    hasLower,
    hasUpper,
    hasNumber,
    hasSymbol,
    isCommon: !isCommon,
    containsEmail: !containsEmail,
  };

  const missing = [];
  if (!lengthOk) missing.push('At least 10 characters');
  if (!hasLower) missing.push('Add a lowercase letter');
  if (!hasUpper) missing.push('Add an uppercase letter');
  if (!hasNumber) missing.push('Add a number');
  if (!hasSymbol) missing.push('Add a symbol');
  if (isCommon) missing.push('Avoid common passwords');
  if (containsEmail) missing.push('Avoid using your email in the password');

  // Score is just for UI (0–5). Common/email penalties override.
  let score = 0;
  if (lengthOk) score += 1;
  if (hasLower) score += 1;
  if (hasUpper) score += 1;
  if (hasNumber) score += 1;
  if (hasSymbol) score += 1;
  if (isCommon || containsEmail) score = Math.min(score, 1);

  const ok =
    lengthOk &&
    hasLower &&
    hasUpper &&
    hasNumber &&
    hasSymbol &&
    !isCommon &&
    !containsEmail;

  const label = ok ? 'Strong' : score >= 4 ? 'Almost there' : score >= 2 ? 'Weak' : 'Very weak';

  return {
    ok,
    score,
    label,
    checks,
    missing,
  };
}

export function passwordStrengthErrorMessage(result) {
  if (!result || typeof result !== 'object') return 'Password is too weak.';
  if (result.ok) return null;
  if (Array.isArray(result.missing) && result.missing.length) {
    return `Password is too weak: ${result.missing.join(', ')}.`;
  }
  return 'Password is too weak.';
}
