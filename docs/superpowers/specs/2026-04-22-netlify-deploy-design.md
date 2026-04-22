# Netlify first-launch deploy — design spec

**Date:** 2026-04-22
**Status:** Approved (brainstorming phase)
**Scope:** First-time production launch of `pbl-com` on Netlify, plus a
production-ready baseline `netlify.toml`.

## Goal

Produce two artifacts so the site can be launched on Netlify reliably by
someone who has never touched Netlify before:

1. A `deploy.md` runbook at the repo root — the first-time go-live playbook,
   followed top-to-bottom.
2. A rewritten `netlify.toml` — production-ready baseline: security headers,
   cache policy, deploy-context scaffolding, existing redirects preserved.

The `README.md` "Go live on Netlify (quick path)" section collapses to a
short pointer at `deploy.md`.

## Non-goals

- No application code changes (middleware, content schema, scripts are
  untouched).
- No Content-Security-Policy. The `htmlContent` / `headHtml` fields on the
  `pages` collection intentionally allow editor-authored inline scripts; a
  strict CSP would break the CMS model. Revisit as report-only later if
  wanted.
- No Netlify build plugins (Lighthouse, cache, etc.) — noise for a first
  launch.
- No CI workflow — Netlify's build is the gate.
- No automated smoke-test script — smoke tests are manual steps in
  `deploy.md`.
- No changes to Decap CMS configuration beyond what the operator edits
  during launch (`backend.repo`, `backend.branch` in
  `public/admin/config.yml`).

## Current state

- `netlify.toml` (25 lines): build command, `NODE_VERSION = "22"`, two
  legacy `/keystatic*` → `/admin` redirects. No headers, no cache rules,
  no deploy contexts.
- `README.md` lines ~7–72: a "Go live on Netlify (quick path)" section
  covering repo, Netlify connect, build settings, first deploy, Decap
  alignment, OAuth App, Netlify OAuth provider, CMS smoke test.
- Astro SSR (`output: 'server'`) with `@astrojs/netlify` in edge middleware
  mode. Publish directory and functions are managed by the adapter.
- Edge middleware enforces protected pages via a signed `pbl_access`
  cookie (HMAC key = `ACCESS_COOKIE_SECRET`).
- Optional Netlify Identity integration via `IDENTITY_JWT_SECRET` and
  `PUBLIC_NETLIFY_IDENTITY_URL`.
- Decap CMS at `/admin`, GitHub backend via Netlify's OAuth proxy
  (callback `https://api.netlify.com/auth/done`).

## Design

### Artifact 1 — `deploy.md` (repo root)

Single top-to-bottom runbook. Audience: a GitHub-admin operator with no
prior Netlify experience. Sections, in order:

1. **TL;DR checklist** — ~10-line scan-before-starting overview.
2. **Prerequisites** — GitHub admin on the content repo, Netlify account,
   Node ≥22.12.0 locally, a GitHub account for creating the OAuth App,
   the editor email addresses destined for `allowedEmails`.
3. **Pre-flight (local)** — on a fresh clone, run `npm install`,
   `npm run check`, `npm run verify:root-home`, `npm run build`. All must
   pass. Confirms the repo builds before wiring Netlify.
4. **Generate `ACCESS_COOKIE_SECRET`** — one-liner
   (`openssl rand -hex 48`); save for step 7.
5. **Create the GitHub OAuth App (for Decap login)** — Developer settings
   → OAuth Apps → New OAuth App. Homepage URL = the Netlify site URL;
   Authorization callback URL **exactly**
   `https://api.netlify.com/auth/done`. Record Client ID + Client secret.
6. **Create the Netlify site** — Import from GitHub, pick the production
   branch, confirm build command auto-detects from `netlify.toml`. Do not
   set a publish directory (the adapter manages it).
7. **Set Netlify environment variables** — `ACCESS_COOKIE_SECRET`
   (required). Optional: `IDENTITY_JWT_SECRET`,
   `PUBLIC_NETLIFY_IDENTITY_URL`. Scope to "All contexts" unless staging
   will diverge.
8. **Enable Netlify's GitHub OAuth provider** — Site configuration →
   Access & security → OAuth. Paste the Client ID + secret from step 5.
9. **Align Decap config to the repo** — edit
   `public/admin/config.yml`: `backend.repo = YOUR_ORG/YOUR_REPO`,
   `backend.branch = <production branch>`. Commit, push, wait for
   rebuild.
10. **First deploy verification** — build log green; home page loads; a
    known CMS page resolves; `/keystatic` 301s to `/admin`.
11. **CMS smoke test** — log in at `/admin`, make a trivial edit, confirm
    the commit lands on the configured branch, rebuild triggers, change
    appears on the live site.
12. **Protected-page smoke test** — mark a test page `isProtected: true`
    with the operator's email in `allowedEmails`. Verify `/access` flow;
    verify a non-listed email gets **404** (not 403); verify login sets a
    session that grants access.
13. **Custom domain (optional)** — add domain in Netlify, follow DNS
    instructions, confirm HTTPS issued.
14. **Rollback** — Netlify → Deploys → "Publish deploy" on a prior deploy.
15. **Troubleshooting** — table of common failures:
    - Decap login redirect loop (OAuth callback URL mismatch).
    - Build fails on Node version (engine range).
    - `/admin` blank (Decap unpkg CDN or config.yml parse error).
    - Protected page 404 everywhere (missing `ACCESS_COOKIE_SECRET`).
    - Edits don't appear (wrong `backend.branch` or cached HTML —
      confirm `Cache-Control: max-age=0`).
16. **Post-launch checklist** — mirrors the README handoff checklist,
    ticked once live.

### Artifact 2 — `netlify.toml` (rewrite)

Full proposed file:

```toml
# Astro SSR on Netlify via @astrojs/netlify (middleware edge mode).
# Publish dir and functions are managed by the adapter — do NOT set [build] publish.
#
# Secrets (ACCESS_COOKIE_SECRET, IDENTITY_JWT_SECRET) live in Netlify env vars, not here.
# Decap GitHub OAuth is configured in Netlify UI → Site configuration → Access & security → OAuth.
# See deploy.md for the full procedure.

[build]
  command = "npm run build"

[build.environment]
  NODE_VERSION = "22.12.0"
  NPM_FLAGS = "--no-audit --no-fund"

# --- Deploy contexts -------------------------------------------------------
# Secrets are set per-context in the Netlify UI. Non-secret context hints go here.

[context.production.environment]
  NODE_ENV = "production"

[context.deploy-preview.environment]
  NODE_ENV = "production"

[context.branch-deploy.environment]
  NODE_ENV = "production"

# --- Redirects -------------------------------------------------------------
# Legacy Keystatic URLs → Decap.

[[redirects]]
  from = "/keystatic"
  to = "/admin"
  status = 301

[[redirects]]
  from = "/keystatic/*"
  to = "/admin"
  status = 301

# --- Security headers ------------------------------------------------------
# Applied to every response; specific paths override below.
# No CSP: htmlContent/headHtml fields allow editor-authored inline scripts.

[[headers]]
  for = "/*"
  [headers.values]
    Strict-Transport-Security = "max-age=63072000; includeSubDomains; preload"
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "DENY"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=(), interest-cohort=()"

# Decap CMS needs to frame its own preview iframe; relax framing for /admin.
[[headers]]
  for = "/admin/*"
  [headers.values]
    X-Frame-Options = "SAMEORIGIN"

[[headers]]
  for = "/admin"
  [headers.values]
    X-Frame-Options = "SAMEORIGIN"

# --- Cache headers ---------------------------------------------------------
# Astro emits hashed filenames under /_astro/*; safe to mark immutable.
[[headers]]
  for = "/_astro/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

# Decap uploads are static assets referenced by hash-stable paths in content.
[[headers]]
  for = "/uploads/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

# SSR HTML must reflect the latest YAML on every request.
[[headers]]
  for = "/*.html"
  [headers.values]
    Cache-Control = "public, max-age=0, must-revalidate"
```

### Key decisions

- **`NODE_VERSION = "22.12.0"`** — exact, matches the `engines` floor in
  `package.json`. Avoids surprise moves when Netlify's `22` alias
  advances.
- **No `[build] publish`** — the adapter writes output to `.netlify/` and
  registers edge/functions. Setting a publish dir breaks SSR.
- **Global `X-Frame-Options: DENY`, overridden to `SAMEORIGIN` on
  `/admin*`** — Decap's preview iframe is same-origin; everywhere else
  stays unframable.
- **No CSP** — intentional, per the non-goals.
- **`/uploads/*` immutable** — Decap writes new filenames on re-upload.
  If an editor overwrites a filename, they need a cache purge; this is
  called out in the troubleshooting table.
- **Deploy-context blocks scaffolded but empty-ish** — so per-context
  divergence (staging URLs, etc.) can be added later without
  restructuring the file.
- **Not added** — build plugins, `[functions]` block (adapter-managed),
  `[dev]` block (`npm run dev` handles local).

### Artifact 3 — `README.md` edit

Replace the existing "Go live on Netlify (quick path)" section
(roughly lines 7–72) with a short pointer:

```markdown
## Deploy to Netlify

First-time launch and operational steps live in [`deploy.md`](deploy.md).
```

Everything after that section (architecture, routing, content model,
protected pages, environment variables, local development, useful
links) stays as-is. The existing "Checklists for handoff" block is
absorbed into `deploy.md` step 16 and removed from the README to avoid
drift between the two documents.

## File layout

| Path | Action | Notes |
|---|---|---|
| `deploy.md` | create | Runbook; repo root. |
| `netlify.toml` | rewrite | Full replacement per section above. |
| `README.md` | edit | Collapse quick-path + handoff checklist to a pointer. |
| `docs/superpowers/specs/2026-04-22-netlify-deploy-design.md` | create | This spec. |

## Commit plan

One commit per logical change so `netlify.toml` is independently
revertable:

1. `docs: add netlify deploy design spec` — adds this file only.
2. `chore(netlify): tighten netlify.toml with headers, cache, contexts`
   — rewrites `netlify.toml` only.
3. `docs: add deploy.md runbook for first Netlify launch` — creates
   `deploy.md` and shortens the README section to a pointer.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Security headers break a page that embeds the site in an iframe. | Global header is `DENY`; if an embed is needed later, add a scoped override like `/admin*` does today. |
| `NODE_VERSION` exact pin diverges from Netlify's supported list. | 22.12 is current LTS; revisit when Node 24 LTS lands. |
| Editors overwrite filenames under `/uploads/`, leaving stale CDN copies. | Troubleshooting section documents manual Netlify cache purge. |
| Netlify's `@astrojs/netlify` expectations change across versions. | Avoid hand-specifying `[functions]` / publish; trust the adapter. |
| README and `deploy.md` drift. | Handoff checklist lives only in `deploy.md`; README just links. |

## Out-of-scope follow-ups

Not blocking launch, track separately:

- Report-only CSP to see what editor-injected scripts actually need.
- Netlify build plugin for Lighthouse budgets.
- A GitHub Actions pre-merge check that runs `npm run check` +
  `npm run build` independently of Netlify.
- Per-context env var audit once a staging URL exists.
