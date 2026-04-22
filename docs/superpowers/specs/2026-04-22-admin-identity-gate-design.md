# Netlify Identity gate for `/admin` — design spec

**Date:** 2026-04-22
**Status:** Approved (brainstorming phase)
**Scope:** Protect the Decap CMS UI at `/admin` with Netlify Identity.
Content-page protected-route system is intentionally left as-is.

## Goal

Require a Netlify Identity login before the Decap CMS UI at `/admin` is
reachable. Admins who haven't logged in get redirected to a new
`/admin-login` page that hosts the Netlify Identity widget; on
successful login they're sent back to `/admin` and Decap takes over
(including its own GitHub OAuth for commit write access).

## Non-goals

- **No changes to the content-page gate.** The existing email-cookie +
  optional Identity flow in `src/middleware.ts` for protected content
  pages, `src/lib/access-gate.ts`, and `src/pages/access.astro` stays
  exactly as-is.
- **No migration to `@netlify/identity` npm package.** The legacy
  `netlify-identity-widget.js` CDN script is still functional and
  matches the pattern already on `/access`. Migration is a separate
  effort with its own spec.
- **No Identity roles, groups, or per-route allowlist.** Any invited
  Identity user is a full admin. Netlify's invite list is the
  allowlist.
- **No `netlify.toml` changes.** The existing `SAMEORIGIN` framing
  override on `/admin*` still applies for Decap's preview iframe.
- **No Decap configuration changes.** `public/admin/*` and
  `public/admin/config.yml` remain unchanged.
- **No automated tests** for the middleware gate. Verification is the
  manual smoke test in `deploy.md`.
- **Free Netlify plan only.** Ruling out Netlify's role-based access
  control redirects (a paid feature).

## Current state

- `src/middleware.ts:24` — `skipMiddleware` explicitly bypasses
  `/admin`, so Decap is currently reachable unauthenticated.
- `src/lib/access-gate.ts:35-54` — `verifyIdentityEmail` already exists
  and verifies an HS256 `nf_jwt` cookie against `IDENTITY_JWT_SECRET`.
  Currently called only from the content-page branch of middleware.
- `src/pages/access.astro:115-163` — loads
  `netlify-identity-widget.js` from
  `https://identity.netlify.com/v1/` conditionally on
  `PUBLIC_NETLIFY_IDENTITY_URL`; on `"login"` event, redirects to
  `next`.
- `.env.example` — both `IDENTITY_JWT_SECRET` and
  `PUBLIC_NETLIFY_IDENTITY_URL` already listed as *Optional*.
- `deploy.md` — lists both Identity env vars as *No (optional)* in
  § 7 table.

## Design

### Architecture

Every request to `/admin` or `/admin/*` runs through the existing
Astro edge middleware (`middlewareMode: 'edge'` in
`astro.config.mjs`). The middleware:

1. Reads the `nf_jwt` cookie.
2. Verifies it with `verifyIdentityEmail(nfJwt, IDENTITY_JWT_SECRET)`.
3. If the verification returns an email → `return next()` (Decap loads
   as today).
4. Otherwise → `context.redirect("/admin-login?next=<pathname>", 302)`.

`/admin-login` itself is unauthenticated (it has to be, or users can't
log in). The page hosts the Netlify Identity widget; on successful
login the widget sets the `nf_jwt` cookie automatically, and the page
navigates to `?next=` (default `/admin`).

Decap's own GitHub OAuth flow is orthogonal. Once inside `/admin`, an
Identity-authenticated user who lacks GitHub write access to the
content repo can view the CMS but sees a GitHub login prompt from
Decap before any save succeeds. This is documented in `deploy.md`.

### File changes

#### `src/middleware.ts` (modify)

Three edits to the existing file:

1. **Remove `/admin` from `skipMiddleware`.** Delete the line
   `if (pathname.startsWith("/admin")) return true;`.
2. **Add `/admin-login` to `skipMiddleware`.** Insert
   `if (pathname === "/admin-login" || pathname.startsWith("/admin-login/")) return true;`
   near the top of the function, before any other branches.
3. **Add the `/admin` gate** right after the `skipMiddleware` check and
   before the existing protected-pages branch:

   ```ts
   if (pathname === "/admin" || pathname.startsWith("/admin/")) {
     const identitySecret = import.meta.env.IDENTITY_JWT_SECRET as
       | string
       | undefined;
     const nfJwt = context.cookies.get("nf_jwt")?.value;
     const email =
       identitySecret && nfJwt
         ? await verifyIdentityEmail(nfJwt, identitySecret)
         : null;
     if (!email) {
       const returnTo = pathname + context.url.search;
       return context.redirect(
         `/admin-login?next=${encodeURIComponent(returnTo)}`,
         302
       );
     }
     return next();
   }
   ```

The `verifyIdentityEmail` import at line 6 is already present; no new
imports needed.

No allowlist check: any valid Identity JWT is sufficient. Invite
management is done entirely in the Netlify UI.

#### `src/pages/admin-login.astro` (create)

A new Astro page, roughly 80–100 lines, styled to match `/access`:

- `export const prerender = false;` — always SSR.
- Reads `next` from the query string; sanitizes with `safeNextPath`
  from `src/lib/access-gate.ts` (same helper the content-page gate
  uses); defaults to `/admin` if absent or unsafe.
- Reads `PUBLIC_NETLIFY_IDENTITY_URL` env var.
- If the env var is missing, renders a "Netlify Identity not
  configured" notice (no widget).
- Otherwise, renders a centered card with a single "Sign in" button.
- Inline script loads
  `https://identity.netlify.com/v1/netlify-identity-widget.js`, calls
  `window.netlifyIdentity.init({ APIUrl: PUBLIC_NETLIFY_IDENTITY_URL })`,
  registers a `"login"` handler that sets `window.location.href = next`,
  and opens the widget on button click.
- Visual style (card, font, colors, button) matches `/access` so the
  two auth surfaces feel consistent.

The JS is intentionally near-identical to the `/access` widget loader
(lines 136–163) to minimize surprise and review effort. A future spec
can unify them if `@netlify/identity` is adopted.

#### `.env.example` (edit)

Reclassify the two Identity variables. Proposed new comments:

```
# Required for /admin access (Netlify Identity gate on the CMS UI).
# Site JWT secret from Netlify → Identity → Services → JWT.
IDENTITY_JWT_SECRET=

# Required for /admin access. Identity API URL for the widget.
# Example: https://your-site.netlify.app/.netlify/identity
PUBLIC_NETLIFY_IDENTITY_URL=
```

(`ACCESS_COOKIE_SECRET` is unchanged.)

#### `deploy.md` (edit, additive)

- **§ 7 env-vars table:** move both Identity vars from the "No" column
  to "Yes (for /admin access)" with a short note that they're required
  only if the operator wants `/admin` protected (strongly recommended).
- **Insert new § 9 — "Enable Netlify Identity for admin access"**
  between current § 8 (GitHub OAuth provider) and current § 9 (Align
  Decap with your repo). Subsections:
  1. Netlify UI: Site configuration → Identity → **Enable Identity**.
  2. **Registration preferences → Invite only.**
  3. Services → JWT → copy **Secret** → paste into
     `IDENTITY_JWT_SECRET` env var.
  4. Copy Identity API URL
     (`https://YOUR-SITE.netlify.app/.netlify/identity`) into
     `PUBLIC_NETLIFY_IDENTITY_URL`.
  5. Identity → **Invite users** → enter admin email addresses; they
     receive a confirmation email and set a password.
  6. Trigger a redeploy so env vars + the new `/admin-login` page
     ship.
- **Renumber existing §§ 9–16 to 10–17.** All intra-document
  references update accordingly.
- **Expand § 12 (was § 11) "CMS smoke test":** add a note that the
  first hit on `/admin` redirects to `/admin-login`; users sign in
  with their invited Identity account, then Decap takes over with its
  own GitHub sign-in prompt.
- **Add a troubleshooting row (§ 16, was § 15):**
  `/admin` redirects to `/admin-login` in a loop → `IDENTITY_JWT_SECRET`
  wrong or missing; verify it matches Netlify Identity → Services →
  JWT exactly.
- **Add a post-launch checklist item (§ 17, was § 16, under "CMS and
  access"):** `- [ ] Netlify Identity enabled, registration set to
  Invite-only, at least one admin invited.`

## File layout

| Path | Action | Notes |
|---|---|---|
| `src/middleware.ts` | modify | 3 edits: remove `/admin` skip, add `/admin-login` skip, add admin gate block. |
| `src/pages/admin-login.astro` | create | Identity-widget login page, ~80–100 lines. |
| `.env.example` | edit | Re-comment the two Identity vars as required for /admin. |
| `deploy.md` | edit | Promote Identity to required; insert new § 9; renumber; expand smoke test; add troubleshooting row + checklist item. |
| `docs/superpowers/specs/2026-04-22-admin-identity-gate-design.md` | create | This spec. |

## Commit plan

Two commits — code separable from docs:

1. `feat(admin): gate /admin with Netlify Identity via edge middleware`
   — `src/middleware.ts`, `src/pages/admin-login.astro` (new),
   `.env.example`.
2. `docs(deploy): add Netlify Identity setup for /admin access` —
   `deploy.md` only.

Rationale: the code commit can ship and be verified in production
before the docs follow, and either commit can be reverted independently.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| `IDENTITY_JWT_SECRET` not set on Netlify when deploy lands → `/admin` stuck in redirect loop. | Fail-closed is intentional. Documented as the top troubleshooting row. Operators follow `deploy.md` § 9 before § 10's first-deploy verification. |
| Invited Identity user lacks GitHub write access → can load `/admin` but can't save. | Documented in § 11 CMS smoke test; matches pre-Identity behavior for Decap. |
| Legacy `netlify-identity-widget.js` CDN is eventually removed by Netlify. | Tracked as out-of-scope follow-up (migrate to `@netlify/identity` npm). Same risk applies to the widget already on `/access`. |
| Static files under `public/admin/*` (e.g. `config.yml`) bypass edge middleware. | Astro `middlewareMode: 'edge'` runs the edge function for all non-asset paths including `public/` files at runtime. No additional mitigation needed. (If Netlify's routing changes, revisit.) |
| Operator sets `IDENTITY_JWT_SECRET` but forgets `PUBLIC_NETLIFY_IDENTITY_URL`. | `/admin-login` renders a "Netlify Identity not configured" notice instead of an inert button. Operator sees the problem immediately. |

## Out-of-scope follow-ups

Track separately, not blocking launch:

- Migrate both `/access` and `/admin-login` to the `@netlify/identity`
  npm package. Shared module, one widget version.
- Role-based access inside Decap (editor vs. admin) once there's a
  reason to distinguish invited Identity users.
- A tiny integration test for middleware (spin up edge function, hit
  `/admin` without cookie, assert 302 to `/admin-login`).
