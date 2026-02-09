# Auth v2 Plan (Supabase)

Goal: evolve the current “basic auth” into a production-grade auth system.

Scope includes:
- Social login: Google, GitHub, X (Twitter)
- Forgot password + reset password
- Password strength checks (client-side) + clear UX
- Email verification (sign-up requires verification)
- Remove magic link login
- Session management: refresh tokens, session expiry, remember-me

Non-goals (for now):
- MFA / passkeys
- SSO (SAML)
- Account linking/merging across providers (we’ll note constraints)

---

## 0) Current State (as implemented)

Primary files:
- [src/context/AuthContext.jsx](../src/context/AuthContext.jsx)
  - `signUpWithPassword`, `signInWithPassword`, `signInWithOtp` (magic link), `signOut`
  - `getSession`, `onAuthStateChange`, `refreshSession`
- [src/pages/LoginPage.jsx](../src/pages/LoginPage.jsx)
  - modes: `signin | signup | magic`
- [src/lib/supabaseClient.js](../src/lib/supabaseClient.js)
  - `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: true`

Key note: Supabase already handles access/refresh tokens and auto-refresh on the client when `autoRefreshToken` + `persistSession` are enabled.

---

## 1) Product Decisions (we should lock these before coding)

### 1.1 Email verification policy
Choose one:
- **A (recommended):** Require email verification before the user is considered “active”.
  - UX: after signup show “check your inbox” screen + “resend verification email” button.
  - App behavior: if user is logged in but not verified, block premium/progress features and show banner.
- B: Allow login immediately, but gate progress until verified.

### 1.2 Session policy
- Default session expiry: rely on Supabase JWT expiry + refresh tokens.
- “Remember me”:
  - If checked: persist session (current behavior).
  - If unchecked: **do not persist** across browser restarts (store session in memory only).

### 1.3 Magic links
- Remove magic-link login from UI and code.
- Keep `detectSessionInUrl` enabled because OAuth + password reset flows still return to the app via URL.

### 1.4 Providers
- Google OAuth
- GitHub OAuth
- X (Twitter) OAuth
  - Note: X setup may require paid developer access and has more brittle callback rules.

---

## 2) Implementation Protocol (applies to every future change)

### 2.1 Environments
- Local dev: `.env` must include `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Supabase Auth settings must include redirect URLs:
  - `http://localhost:5173/*`
  - production domain(s): `https://your-domain/*`

### 2.2 Redirect handling
We will standardize on these routes in the webapp:
- `/auth/callback` (OAuth return handling / finalize session)
- `/auth/reset` (password reset form)

### 2.3 UI/UX consistency
- Auth pages should be 1-screen, minimal steps, strong error messages.
- Auth should never block content browsing.

### 2.4 Acceptance criteria format
Every feature below includes:
- Functional behavior
- Edge cases
- Security notes

---

## 3) Work Plan (do in order)

### Phase 1 — Remove magic links + add new auth routes
1. Remove magic mode from [src/pages/LoginPage.jsx](../src/pages/LoginPage.jsx)
   - Delete UI tab + `signInWithOtp` usage.
2. Remove `signInWithOtp` from [src/context/AuthContext.jsx](../src/context/AuthContext.jsx)
   - Ensure no callers remain.
3. Add route pages:
   - `AuthCallbackPage` at `/auth/callback`
   - `ResetPasswordPage` at `/auth/reset`

Status: implemented
- Magic-link login removed from UI and AuthContext.
- Added `/auth/callback` and `/auth/reset` routes (wired in [src/App.jsx](../src/App.jsx)).
- Callback/reset pages rely on `detectSessionInUrl: true` to parse sessions from URL.

Acceptance:
- No “Magic link” option in UI.
- OAuth and reset flows can still parse sessions from URL.

---

### Phase 2 — Forgot password / reset password
1. Login page: add “Forgot password?” link.
2. Create request-reset flow:
   - call `supabase.auth.resetPasswordForEmail(email, { redirectTo })`
   - redirectTo should be `${origin}/auth/reset`
3. Reset page:
   - allow user to set a new password
   - call `supabase.auth.updateUser({ password: newPassword })`

Edge cases:
- expired reset link
- user already logged in

Acceptance:
- Reset email received.
- Reset page updates password and navigates to `/topics` or previous page.

---

### Phase 3 — Social login (Google, GitHub, X)
1. Add buttons on Login page: “Continue with Google/GitHub/X”.
2. Implement `signInWithOAuth(provider)` in AuthContext:
   - `supabase.auth.signInWithOAuth({ provider, options: { redirectTo } })`
   - redirectTo: `${origin}/auth/callback`
3. Callback page:
   - show “Signing you in…”
   - after session established, navigate to `fromPath` if present.

Acceptance:
- Clicking provider button opens provider auth.
- Returning to `/auth/callback` logs user in and returns them to the intended page.

---

### Phase 4 — Email verification UX
1. Signup should show “verify your email” state.
2. Implement “resend verification email” (Supabase supports resend; exact API may depend on auth settings).
3. Add “unverified banner”:
   - If user exists but `user.email_confirmed_at` is null, show banner and restrict gated features.

Acceptance:
- Verified users can use the app normally.
- Unverified users see clear instructions and can resend verification.

---

### Phase 5 — Password strength checks
Client-side only (Supabase enforces server rules too, but we’ll improve UX):
- Add strength meter + rules:
  - min length (>= 10 recommended)
  - includes uppercase, lowercase, number, symbol
  - block common passwords (lightweight list)
- On signup and reset password, require strength threshold.

Acceptance:
- Weak passwords are blocked with clear, actionable feedback.

---

### Phase 6 — Session management + “Remember me”
1. Add “Remember me” checkbox in Login.
2. Implement a session persistence toggle:
   - If remember-me OFF: initialize supabase client with `persistSession: false` (requires a design decision: either create two clients or re-init auth).
   - Alternative: keep persistSession true, but on sign-in when remember-me is false, immediately call signOut on tab close is not reliable; better to use separate client configuration.
3. Session expiry UX:
   - if refresh fails, redirect to login with a message.

Acceptance:
- Remember-me OFF logs you out on browser restart.
- Remember-me ON persists.

---

## 4) Security checklist
- Ensure redirect URLs are whitelisted in Supabase.
- Avoid open redirects (`from` path should be validated as same-origin route).
- Do not leak whether an email exists during reset.
- Ensure sensitive errors are not shown verbatim to end-users.

---

## 5) Testing plan (lightweight)
- Manual test matrix for:
  - password signup + verification
  - login
  - reset password
  - OAuth for each provider
  - session expiry handling
  - remember-me on/off

Optional automation later:
- Playwright smoke tests for login flow (non-OAuth) + reset page rendering.
