import { useMemo } from 'react';
import { evaluatePasswordStrength } from '../../lib/passwordStrength';

function Row({ ok, children }) {
  return (
    <div className={ok ? 'pw-check pw-check--ok' : 'pw-check'}>
      <span className="pw-check-icon" aria-hidden="true">
        {ok ? '✓' : '•'}
      </span>
      <span>{children}</span>
    </div>
  );
}

export default function PasswordStrengthMeter({ password, email }) {
  const strength = useMemo(() => evaluatePasswordStrength(password, { email }), [password, email]);

  if (!password) return null;

  const pct = Math.max(0, Math.min(100, Math.round((strength.score / 5) * 100)));
  const tone = strength.ok ? 'good' : strength.score >= 4 ? 'mid' : 'bad';

  return (
    <div className="pw-meter" aria-live="polite">
      <div className="pw-meter-head">
        <div className="pw-meter-label">Password strength</div>
        <div className={`pw-meter-badge pw-meter-badge--${tone}`}>{strength.label}</div>
      </div>

      <div className="pw-meter-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className={`pw-meter-fill pw-meter-fill--${tone}`} style={{ width: `${pct}%` }} />
      </div>

      <div className="pw-checklist">
        <Row ok={strength.checks.lengthOk}>At least 10 characters</Row>
        <Row ok={strength.checks.hasLower}>Lowercase letter</Row>
        <Row ok={strength.checks.hasUpper}>Uppercase letter</Row>
        <Row ok={strength.checks.hasNumber}>Number</Row>
        <Row ok={strength.checks.hasSymbol}>Symbol</Row>
        <Row ok={strength.checks.isCommon}>Not a common password</Row>
        <Row ok={strength.checks.containsEmail}>Doesn’t contain your email</Row>
      </div>
    </div>
  );
}
