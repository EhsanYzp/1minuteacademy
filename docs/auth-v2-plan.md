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
   - `signUpWithPassword`, `signInWithPassword`, `signInWithOAuth`, `requestPasswordReset`, `signOut`
  - `getSession`, `onAuthStateChange`, `refreshSession`
- [src/pages/LoginPage.jsx](../src/pages/LoginPage.jsx)
   - modes: `signin | signup | forgot`
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

### 2.1.1 Email branding (make emails look like 1 Minute Academy)
By default, Supabase’s hosted email service can show Supabase branding (subject like “Supabase Auth”, footer text, and sender identity). To make password reset / verification emails look like they come from **1 Minute Academy**, you generally need **custom SMTP** + **custom templates**.

Recommended provider: **Resend** (simple setup + good deliverability). The steps below assume your domain is `1minute.academy` on Namecheap.

#### Step-by-step: Resend + Namecheap DNS + Supabase Custom SMTP

**1) Decide your sender address**
- Use something like `no-reply@1minute.academy` (recommended for auth emails).
- Optional: set up a human inbox like `support@1minute.academy` separately (Google Workspace / Namecheap Business Email), but keep auth mail on Resend.

**2) Create a Resend account and add your domain**
- In Resend Dashboard → Domains → **Add domain** → `1minute.academy`.
- Resend will show a list of DNS records to add (SPF + DKIM, sometimes additional records). **Copy them exactly from Resend** (values can change).

**3) Add Resend DNS records in Namecheap**
- Namecheap → Domain List → `1minute.academy` → **Manage** → **Advanced DNS**.
- Under **Host Records**, click **Add New Record** for each record Resend provides.

Namecheap UI note:
- Some Namecheap accounts don’t show **MX Record** under **Host Records**.
- In that case, add MX records under **Advanced DNS → Mail Settings → Custom MX** (this is still DNS; it’s just a different section in Namecheap).

Important: **Namecheap “Mail Settings” controls your domain’s inbound email (MX at `@`)**.
- If you switch **Mail Settings** to **Email Forwarding**, Namecheap will typically change your `@` MX records to their forwarding service.
- This is fine if you want forwarding-only mailboxes (e.g. `support@1minute.academy`), but it can break any other inbound email service you were using via Custom MX.
- Resend sending/verification is primarily driven by SPF/DKIM records and (sometimes) an MX for a **subdomain** like `send.1minute.academy`.
   - If your Resend MX is created as a *subdomain MX* (host `send`), switching Mail Settings shouldn’t affect it.
   - If you had to add Resend’s MX inside **Mail Settings → Custom MX**, double-check Resend’s domain status after switching to Email Forwarding (you may need to re-add that `send` MX in a place that persists).

About Resend’s MX record (e.g. `Type: MX`, `Host: send`, `Value: feedback-smtp...amazonses.com`):
- This usually creates an MX record for a **subdomain** (e.g. `send.1minute.academy`) used as the envelope/return-path (“MAIL FROM”) domain.
- It typically **does not** affect your normal inbound email MX at `@`.
- Whether it’s required depends on Resend’s domain status:
   - If Resend shows “Enable sending” as **pending** until you add it, then it’s required to complete verification.
   - If your domain is already fully verified for sending, it’s optional but still recommended for best deliverability/diagnostics.

What you’ll typically see (exact hosts/values come from Resend):
- **SPF** (TXT)
   - Type: `TXT Record`
   - Host: `@`
   - Value: (copy from Resend)
- **DKIM** (usually CNAME)
   - Type: `CNAME Record`
   - Host: something like `resend._domainkey` (copy from Resend)
   - Value: something like `...resend...` (copy from Resend)

If you already have an SPF TXT record:
- You must **merge** SPF entries into a single record (you can’t have multiple SPF records reliably).
- Add Resend’s include to the existing record (based on Resend’s instructions).

**4) Add a DMARC record (recommended, improves deliverability)**
- Namecheap → Advanced DNS → Add New Record
   - Type: `TXT Record`
   - Host: `_dmarc`
   - Value (starter): `v=DMARC1; p=none; rua=mailto:support@1minute.academy; fo=1;`

**5) Verify domain in Resend**
- Back in Resend → Domains → click **Verify**.
- DNS can take 5–60 minutes (sometimes longer). If verification fails, wait and retry.

**6) Get Resend SMTP credentials (Resend uses an API key as the SMTP password)**
- Resend does not always show a “create SMTP credentials” button.
- Instead:
   - Resend Dashboard → **API Keys** → **Create API key**
   - Use that API key as the SMTP **Password**
- SMTP values:
   - Host: `smtp.resend.com`
   - Port: `465` (implicit TLS) or `587` (STARTTLS)
   - Username: `resend`
   - Password: `YOUR_RESEND_API_KEY`

**7) Configure Supabase to use Custom SMTP**
- Supabase Dashboard → Authentication → Settings → SMTP → **Set up custom SMTP**
- Fill values:
   - Host: `smtp.resend.com`
   - Port: `465` (recommended) or `587`
   - Username: `resend`
   - Password: (the Resend SMTP password)
   - Sender name: `1 Minute Academy`
   - Sender email: `no-reply@1minute.academy`
- Save.

**8) Remove “Supabase Auth” + remove Supabase footer text**
- Supabase Dashboard → Authentication → Email Templates
   - Update the **Subject** for:
      - Confirm signup
      - Reset password
      - (and any other templates you enable)
   - Update the **Body** to remove any Supabase-branded footer lines.

Optional: a ready-to-paste, branded reset-password template lives at [docs/email-templates/reset-password.html](email-templates/reset-password.html).
If Yahoo (or other inboxes) renders the reset email poorly, use the more conservative, high-contrast template at [docs/email-templates/reset-password-safe.html](email-templates/reset-password-safe.html).
Optional: a ready-to-paste, branded confirm-signup template lives at [docs/email-templates/confirm-signup.html](email-templates/confirm-signup.html).

**9) Test**
- Trigger a password reset from the Login page.
- Confirm:
   - From: `1 Minute Academy <no-reply@1minute.academy>`
   - Subject is your custom one (no “Supabase Auth”)
   - Footer is your custom content
   - Link opens `/auth/reset` and password update works

Troubleshooting quick hits:
- SMTP auth failures: double-check port + TLS mode and credentials.
- “From address not allowed”: ensure the domain is verified in Resend and the sender matches that domain.
- Still seeing Supabase branding: verify you edited the correct templates in Supabase.

Setup (Supabase Dashboard):
- Authentication → Email Templates
   - For each template you use (typically **Confirm signup** and **Reset password**):
     - Edit the **Subject** to your own, e.g. `1 Minute Academy — Reset your password` (this removes “Supabase Auth”).
     - Edit the **Body** to remove any Supabase-branded lines/footers you don’t want.
- Authentication → Settings (or Email / SMTP depending on UI) → SMTP
   - Configure a custom SMTP provider (e.g. Resend, Postmark, SendGrid, Amazon SES).
   - Set sender name: `1 Minute Academy`
   - Set sender email: `no-reply@1minute.academy` (or similar)

Domain prerequisites:
- Use a domain you control (e.g. `1minute.academy`).
- Configure SPF/DKIM (and ideally DMARC) for deliverability.

Notes:
- If you keep Supabase-hosted email (no custom SMTP), you may not be able to fully remove all Supabase branding (especially sender identity and any provider-injected footer).
- After changing templates/SMTP, re-test both **signup verification** and **password reset** emails end-to-end.

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

Status: implemented
- Login supports a “Forgot password?” mode that requests a reset email.
- Reset emails use `redirectTo: ${origin}/auth/reset?from=<path>` to return users to their intended page.
- Reset page updates password via `supabase.auth.updateUser({ password })` and redirects back to `from` (default: `/topics`).

Edge cases:
- expired reset link
- user already logged in

Acceptance:
- Reset email received.
- Reset page updates password and navigates to `/topics` or previous page.

---

### Phase 3 — Social login (Google, GitHub)
1. Add buttons on Login page: “Continue with Google/GitHub”.
2. Implement `signInWithOAuth(provider)` in AuthContext:
   - `supabase.auth.signInWithOAuth({ provider, options: { redirectTo } })`
   - redirectTo: `${origin}/auth/callback`
3. Callback page:
   - show “Signing you in…”
   - after session established, navigate to `fromPath` if present.

Status: implemented (Google + GitHub)
- Added OAuth buttons on the Login page for Google and GitHub.
- Implemented `signInWithOAuth(provider, redirectTo)` in AuthContext.
- OAuth redirects return to `/auth/callback?from=<path>` and then navigate to `from` (default: `/topics`).

Provider notes:
- **GitHub email:** GitHub may not return an email unless the app requests the `user:email` scope. We request `read:user user:email` so Supabase can fetch a verified email even if the user keeps their email private.
- If a provider still returns no email (rare, but possible), we should prompt the user to add an email address after login.

Acceptance:
- Clicking provider button opens provider auth.
- Returning to `/auth/callback` logs user in and returns them to the intended page.

Note: X (Twitter) OAuth is intentionally disabled in the UI for now while provider setup is finalized.

---

### Phase 4 — Email verification UX
1. Signup should show “verify your email” state.
2. Implement “resend verification email” (Supabase supports resend; exact API may depend on auth settings).
3. Add “unverified banner”:
   - If user exists but `user.email_confirmed_at` is null, show banner and restrict gated features.

Status: implemented
- After password signup, if Supabase returns no session (email confirmation required), the Login page switches to a “Verify your email” state with a resend button.
- Added `resendVerificationEmail(email, emailRedirectTo)` in AuthContext via `supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo } })`.
- Added a persistent “Verify your email” banner in the header with a resend button.
- Profile route (`/me`) requires a verified email (unverified users are redirected to login with a verification hint).

Supabase setup needed (Phase 4)
- Authentication → Providers → **Email**
   - Ensure **Email confirmations** are set how you want:
      - If ON, signup typically returns **no session** until the user clicks the email link (the app shows the “Verify your email” state).
      - If OFF, users can be signed in immediately, but the app will still show the unverified banner and gate `/me` until confirmed.
- Authentication → URL Configuration (wording varies by Supabase UI)
   - Set **Site URL**: `https://1minute.academy`
   - Add **Redirect URLs**:
      - `http://localhost:5173/*`
      - `https://1minute.academy/*`
   - These must include `/auth/callback` (OAuth + verify links) and `/auth/reset` (password reset).
- Authentication → Email Templates
   - **Confirm signup**: ensure the button/link uses Supabase’s confirmation URL variable (so it lands back in the app after verification).
   - (Optional) Remove Supabase branding by editing subject/body + using custom SMTP.
- Authentication → SMTP (optional but recommended)
   - Configure custom SMTP (e.g. Resend) so verification and reset emails have the right sender + deliverability.

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

Status: implemented
- Added a password strength meter + checklist on password signup and reset pages.
- Enforced minimum strength on the client before calling Supabase:
   - at least 10 characters
   - includes uppercase + lowercase + number + symbol
   - blocks a small set of common passwords
   - blocks passwords containing the user’s email local-part

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

Status: implemented
- Login page includes a “Remember me” checkbox (stored in localStorage).
- Supabase auth client switches between:
  - persistent sessions (`persistSession: true`) when Remember me is ON
  - in-memory sessions (`persistSession: false`) when Remember me is OFF
- When Remember me is OFF we also clear any previously-stored local session defensively, so a past Remember-me session can’t auto-restore on restart.
- If an existing authenticated session expires and the user hits a gated route, they are redirected to login with a “session expired” message.

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
