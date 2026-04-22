# Netlify first-launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare `pbl-com` for its first production launch on Netlify by (a) replacing `netlify.toml` with a production baseline (security headers, cache rules, deploy contexts, existing redirects), (b) creating a top-to-bottom `deploy.md` runbook at the repo root, and (c) collapsing the README's long "Go live" + "Checklists for handoff" sections into a one-line pointer.

**Architecture:** Three independent file operations, one commit each. No application code changes. Verification is local `npm run build` (for the toml) and markdown link checks (for the docs). The spec this plan implements lives at `docs/superpowers/specs/2026-04-22-netlify-deploy-design.md`.

**Tech Stack:** Astro 6 SSR, `@astrojs/netlify` v7 (edge middleware), Decap CMS, Node ≥22.12.0.

---

## File structure

| Path | Action | Responsibility |
|---|---|---|
| `netlify.toml` | rewrite (full replacement) | Build + security headers + cache rules + deploy contexts + redirects. |
| `deploy.md` | create (repo root) | First-time launch runbook. |
| `README.md` | edit (delete lines 5–96, re-insert shorter block) | Pointer to `deploy.md` in place of the old quick-path + handoff checklists. |

One commit per file so `netlify.toml` can be reverted independently if a header causes trouble in production.

---

## Task 1: Rewrite `netlify.toml`

**Files:**
- Modify: `netlify.toml` (full replacement; previous content is 25 lines)

- [ ] **Step 1: Replace `netlify.toml` with the production baseline**

Overwrite the file with exactly this content:

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

- [ ] **Step 2: Verify the build still succeeds locally**

Run: `npm run build`
Expected: exits 0, ends with a line like `[build] Complete!` or similar Astro/Netlify success output. If it fails with a `netlify.toml` parse error, re-check indentation (TOML is whitespace-tolerant but keys must not be misspelled).

- [ ] **Step 3: Verify `netlify.toml` parses as TOML**

Run: `node -e "const fs=require('fs');const s=fs.readFileSync('netlify.toml','utf8');console.log('bytes:',s.length,'lines:',s.split(/\n/).length)"`
Expected: bytes and line counts print without error (sanity check the file is well-formed UTF-8; full TOML validation happens in Netlify's builder, which Step 2 exercises indirectly via build).

- [ ] **Step 4: Commit**

```bash
git add netlify.toml
git commit -m "$(cat <<'EOF'
chore(netlify): tighten netlify.toml with headers, cache, contexts

- Pin NODE_VERSION to 22.12.0 (matches engines floor).
- Add security headers (HSTS, X-Frame-Options, Referrer-Policy,
  X-Content-Type-Options, Permissions-Policy) with SAMEORIGIN
  override for /admin so Decap's preview iframe still works.
- Add cache rules: immutable for /_astro/* and /uploads/*, no-cache
  for HTML so SSR updates propagate.
- Scaffold deploy contexts (production, deploy-preview, branch-deploy)
  for future per-context env divergence.
- Preserve legacy /keystatic* → /admin redirects.
- No CSP: htmlContent/headHtml fields intentionally allow editor-authored
  inline scripts.
EOF
)"
```

---

## Task 2: Create `deploy.md` runbook

**Files:**
- Create: `deploy.md` (repo root)

- [ ] **Step 1: Create the file with the full runbook**

Write this exact content to `deploy.md`:

````markdown
# Deploy `pbl-com` to Netlify

First-time production launch runbook. Follow top-to-bottom. Replace
placeholders (`YOUR_ORG`, `YOUR_REPO`, production branch — usually
`main`) with your values.

## TL;DR

1. Repo pushed to GitHub on the production branch.
2. `npm run check` and `npm run build` pass locally.
3. Generate `ACCESS_COOKIE_SECRET` (48-byte hex).
4. Create a GitHub OAuth App for Decap (callback `https://api.netlify.com/auth/done`).
5. Create the Netlify site from the GitHub repo.
6. Set `ACCESS_COOKIE_SECRET` in Netlify env vars.
7. Enable Netlify's GitHub OAuth provider with the OAuth App credentials.
8. Edit `public/admin/config.yml` so `backend.repo` and `backend.branch` match.
9. Verify first deploy, CMS login, CMS edit round-trip, protected pages.
10. (Optional) custom domain.

## 1. Prerequisites

- GitHub admin on `YOUR_ORG/YOUR_REPO` (the content repo).
- Netlify account with permission to create sites on the target team.
- Node `>=22.12.0` installed locally (matches `package.json` engines).
- A GitHub account for creating the OAuth App (can be the same personal
  account; the OAuth App belongs to an owner, not to the repo).
- The email addresses of editors who will appear in `allowedEmails` on
  any protected pages.

## 2. Pre-flight (local)

On a fresh clone of the production branch, run:

```bash
npm install
npm run check
npm run verify:root-home
npm run build
```

All four must succeed. If `npm run build` fails locally, it will fail on
Netlify. Fix before continuing.

## 3. Generate `ACCESS_COOKIE_SECRET`

```bash
openssl rand -hex 48
```

Copy the output. Keep it in a password manager; you'll paste it into
Netlify in step 7. **Do not commit this value.**

## 4. Create the GitHub OAuth App (for Decap login)

Decap CMS logs users in through Netlify's OAuth proxy, which needs a
GitHub OAuth App.

1. GitHub → **Settings** → **Developer settings** → **OAuth Apps** →
   **New OAuth App**.
2. **Application name**: anything recognizable (e.g. `pbl-com CMS`).
3. **Homepage URL**: your Netlify site URL — you won't know this until
   step 5. You can come back and fill it in, or pre-create the Netlify
   site first and return here.
4. **Authorization callback URL** (exact, no trailing slash):
   `https://api.netlify.com/auth/done`
5. Create the app, then **Generate a new client secret**.
6. Record both **Client ID** and **Client secret**; you'll paste them
   into Netlify in step 8. The secret is shown once — save it.

Reference: <https://decapcms.org/docs/github-backend/>

## 5. Create the Netlify site

1. Netlify → **Add new site** → **Import an existing project** →
   **GitHub**.
2. Authorize Netlify for `YOUR_ORG` if prompted. Select `YOUR_REPO`.
3. **Production branch**: pick your GitHub default (usually `main`).
4. **Build settings**: Netlify should auto-detect from `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: *leave blank — the Astro Netlify adapter sets
     this. Do not override.*
5. Click **Deploy**. The first deploy will probably fail (no
   `ACCESS_COOKIE_SECRET` yet). That's fine; continue.

## 6. (Optional) Return to the OAuth App for the Homepage URL

If you deferred step 4.3, paste the Netlify-assigned URL (e.g.
`https://YOUR-SITE.netlify.app`) into the OAuth App's Homepage URL and
save.

## 7. Set Netlify environment variables

Netlify → your site → **Site configuration** → **Environment variables**.

| Variable | Required | Value | Scope |
|---|---|---|---|
| `ACCESS_COOKIE_SECRET` | **Yes** | the hex string from step 3 | All contexts |
| `IDENTITY_JWT_SECRET` | No | Netlify Identity → Services → JWT | All contexts |
| `PUBLIC_NETLIFY_IDENTITY_URL` | No | e.g. `https://YOUR-SITE.netlify.app/.netlify/identity` | All contexts |

Set the optional two only if you plan to use Netlify Identity alongside
the email form gate on `/access`.

Trigger a redeploy after saving (**Deploys** → **Trigger deploy** →
**Deploy site**).

## 8. Enable Netlify's GitHub OAuth provider

Netlify → your site → **Site configuration** → **Access & security** →
**OAuth** → **Authentication providers**.

1. Enable **GitHub**.
2. Paste the OAuth App's **Client ID** and **Client secret** from
   step 4.6.
3. Save. Netlify stores the secret; it never enters the repo.

## 9. Align Decap to the repo

Edit `public/admin/config.yml`:

- `backend.repo: YOUR_ORG/YOUR_REPO`
- `backend.branch: <production branch>` (match step 5.3)

Commit and push to the production branch. Netlify rebuilds
automatically; wait for the deploy to go green.

## 10. First-deploy verification

- Deploy log ends with **Build succeeded**.
- `https://YOUR-SITE.netlify.app/` responds (home page loads, assuming
  a `pages` YAML entry resolves to `/` — see README's Content model).
- `https://YOUR-SITE.netlify.app/keystatic` returns a **301** to
  `/admin` (confirms `netlify.toml` redirects are applied).
- Response headers on any page include
  `strict-transport-security`, `x-frame-options: DENY`,
  `referrer-policy: strict-origin-when-cross-origin` (check with
  browser devtools or `curl -sI https://YOUR-SITE.netlify.app/`).

## 11. CMS smoke test

1. Open `https://YOUR-SITE.netlify.app/admin`.
2. Log in with GitHub when prompted. You must have write access to
   `YOUR_ORG/YOUR_REPO`.
3. Open the **Pages** collection; confirm existing entries load.
4. Make a trivial edit (e.g. change a title), save.
5. On GitHub, confirm a commit appears on the configured branch with
   Decap as the author.
6. Wait for Netlify rebuild, then reload the page on the live site and
   confirm the edit is visible.

## 12. Protected-page smoke test

1. In `src/content/pages/`, pick (or create) a test page and set:
   - `isProtected: true`
   - `allowedEmails: [your@email.example]`
2. Commit, push, wait for redeploy.
3. In a private window, visit the page's `urlPath`. You should be
   redirected to `/access?next=...`.
4. Submit a **non-listed** email → the page returns **404** (not 403).
5. Submit the **listed** email → you're redirected back to the page and
   it renders.
6. Clear the `pbl_access` cookie and confirm the gate re-engages.

If any protected page returns 404 for every email, `ACCESS_COOKIE_SECRET`
is likely missing or mis-set in Netlify env vars — see Troubleshooting.

## 13. Custom domain (optional)

1. Netlify → **Domain management** → **Add custom domain**.
2. Follow Netlify's DNS instructions (CNAME or Netlify DNS).
3. Wait for DNS propagation, then confirm **HTTPS** is issued
   (Let's Encrypt, automatic).
4. If the OAuth App's Homepage URL still points at the
   `*.netlify.app` URL, update it to the custom domain.

## 14. Rollback

Netlify → **Deploys** → pick a previous green deploy → **Publish
deploy**. The published version becomes live within seconds. No code
changes or git operations required.

## 15. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Decap login redirects in a loop on `/admin`. | OAuth App callback URL wrong. | Must be **exactly** `https://api.netlify.com/auth/done`. No trailing slash, no path variation. |
| Netlify build fails with "Node version mismatch" or similar. | `netlify.toml` pin is `22.12.0`; Netlify's Node image list may have moved. | Update `NODE_VERSION` in `netlify.toml` to a supported minor that still satisfies `package.json` `engines`. |
| `/admin` loads blank or spinner forever. | Decap CDN unreachable or `config.yml` has a YAML parse error. | Open devtools Network tab; look for 4xx on the Decap script. Re-validate `public/admin/config.yml` with a YAML linter. |
| Every protected page returns 404, even with allowed email. | `ACCESS_COOKIE_SECRET` missing on Netlify. | Re-check env vars under **All contexts**; trigger a redeploy after adding. |
| Edits don't appear after a successful deploy. | HTML cached upstream, or wrong `backend.branch`. | Confirm `Cache-Control: public, max-age=0, must-revalidate` on the HTML response. Confirm `public/admin/config.yml` `backend.branch` matches the production branch. |
| Editor re-uploaded a filename but old image still shows. | `/uploads/*` is `immutable` in `netlify.toml`. | Netlify → **Deploys** → **Trigger deploy** → **Clear cache and deploy site**. Recommend editors upload new filenames instead. |

## 16. Post-launch checklist

Tick once everything above is green.

### Repository and hosting
- [ ] GitHub repo exists and contains this codebase on the production branch.
- [ ] Netlify site is linked to the correct repo and production branch.
- [ ] Latest deploy passed (build log green).
- [ ] `public/admin/config.yml` `backend.repo` and `backend.branch` match.
- [ ] `NODE_VERSION` in `netlify.toml` satisfies `package.json` engines (≥ 22.12.0).
- [ ] Home page: at least one `pages` YAML entry has a `urlPath` that
      resolves to the site root (see README's Routing section).
- [ ] Uploads folder is writable (Decap `media_folder: public/uploads`;
      folder may be created on first upload).

### CMS and access
- [ ] GitHub OAuth App created with callback **exactly**
      `https://api.netlify.com/auth/done`.
- [ ] Netlify GitHub OAuth provider enabled with Client ID + secret.
- [ ] Every editor has GitHub write access to the content repo (or the
      branch-protection workflow supports Decap's commit style).
- [ ] Reviewer/merger is assigned for protected branches, if any.

### Production hardening
- [ ] `ACCESS_COOKIE_SECRET` set in Netlify env vars (required for
      protected pages).
- [ ] Response headers verified in production: `strict-transport-security`,
      `x-frame-options: DENY` on non-`/admin` routes, `x-frame-options: SAMEORIGIN`
      on `/admin`.
- [ ] Rollback procedure confirmed (pick an old deploy → Publish deploy).
````

- [ ] **Step 2: Verify all internal relative links resolve**

The file references `public/admin/config.yml`, `src/content/pages/`,
`package.json`, `netlify.toml`, `README.md`. Confirm each exists:

Run: `for f in public/admin/config.yml package.json netlify.toml README.md; do test -e "$f" && echo "OK $f" || echo "MISSING $f"; done && test -d src/content/pages && echo "OK src/content/pages" || echo "MISSING src/content/pages"`

Expected: all six print `OK`.

- [ ] **Step 3: Verify no `YOUR-SITE.netlify.app` / `YOUR_ORG` typos**

Placeholders are intentional. Confirm they only appear as placeholders, not in real URLs:

Run: `grep -nE "YOUR[-_]?(ORG|REPO|SITE)" deploy.md | wc -l`
Expected: a positive number (e.g. ~10–20). These are the placeholders the operator will replace when following the runbook — their presence is correct.

- [ ] **Step 4: Commit**

```bash
git add deploy.md
git commit -m "$(cat <<'EOF'
docs: add deploy.md runbook for first Netlify launch

Top-to-bottom playbook: prerequisites, local pre-flight, GitHub OAuth
App, Netlify site creation, env vars, Decap alignment, verification,
CMS + protected-page smoke tests, rollback, troubleshooting, and a
post-launch checklist.
EOF
)"
```

---

## Task 3: Collapse the README deploy section to a pointer

**Files:**
- Modify: `README.md` (delete lines 5–95 as they exist before this task, re-insert a short pointer)

Lines to remove (as of the pre-change README): the trailing `---` on
line 5 through the closing `---` on line 96. That removes:
- "Go live on Netlify (quick path)" (lines 7–71)
- The `---` separator (line 73)
- "Checklists for handoff" (lines 75–95)
- The `---` separator (line 96)

Lines 1–4 (title + intro paragraph) and lines 97+ (`## What this
application does` and everything after) are preserved.

- [ ] **Step 1: Read the current README to confirm line numbers haven't shifted**

Run: `sed -n '1,6p;95,100p' README.md`
Expected: line 5 is `---`, line 7 starts with `## Go live on Netlify`, line 96 is `---`, line 98 starts with `## What this application does`. If the file has shifted, adjust the delete range in Step 2 accordingly.

- [ ] **Step 2: Replace lines 5–96 with the short pointer block**

Use the Edit tool to replace the exact text block starting at the first
`---` on line 5 through the `---` on line 96 with the pointer block.

Old (the text to be replaced, top and bottom anchors only — engineer will select the full range including everything between):

```
---

## Go live on Netlify (quick path)
```
*…through…*
```
- [ ] Team knows who **reviews/merges** if the target branch is protected.

---
```

New content that replaces the entire range:

```markdown
---

## Deploy to Netlify

First-time launch, environment setup, smoke tests, rollback, and the
post-launch checklist live in [`deploy.md`](deploy.md). Follow it
top-to-bottom for a production launch.

---
```

The concrete Edit call the engineer should make:

- `old_string`: the **full block** from `---\n\n## Go live on Netlify (quick path)` down through `- [ ] Team knows who **reviews/merges** if the target branch is protected.\n\n---` inclusive.
- `new_string`: the new markdown block above.

Because the old block is long and contains unique anchors at both ends (`## Go live on Netlify (quick path)` and `Team knows who **reviews/merges**`), a single Edit call with the full block as `old_string` is the cleanest approach.

- [ ] **Step 3: Verify the surrounding content is intact**

Run: `sed -n '1,20p' README.md`
Expected: line 1 `# pbl-com`, line 3 the intro paragraph, line 5 `---`, line 7 `## Deploy to Netlify`, line 9 starts with `First-time launch`, line 13 `---`, line 15 `## What this application does`.

Run: `wc -l README.md`
Expected: ~110 lines (down from 188). Exact count not critical; what matters is that the architecture / content model / env vars sections below are still present.

Run: `grep -nE "^## (Architecture|Content model|Routing|What this application does|Local development|Useful links)" README.md | wc -l`
Expected: at least 1 (the "What this application does" heading survived). Architecture/Routing/Content model are `### ` subheadings under it — they'll also appear if you extend the grep: `grep -nE "^#+ (Architecture|Content model|Routing|Local development|Useful links)" README.md` — expect 5 matches.

- [ ] **Step 4: Verify no surviving intra-doc anchor links are dangling**

List every `](#anchor)` link remaining in the README and check each
target still exists as a heading:

Run: `grep -nE '\]\(#[a-z0-9-]+\)' README.md`

For each result, the anchor after `](#` must correspond to a heading
that is still in the file (run
`grep -nE '^#+ ' README.md` to see surviving headings). Anchors from
removed sections (`#go-live-*`, `#checklists-for-handoff`, `#pre-launch-*`,
`#cms-and-access`) must not appear as link targets. If any do, edit the
link to point at the surviving heading or at `deploy.md` as appropriate.

Expected: every listed anchor resolves to a surviving heading, or the
command prints nothing (no anchor links at all).

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs(readme): collapse deploy section to a deploy.md pointer

The Go-live quick-path and handoff-checklist content now lives in
deploy.md as the single canonical runbook; README just points at it
to prevent drift.
EOF
)"
```

---

## Final verification

- [ ] **Step 1: Confirm the three commits landed in order**

Run: `git log --oneline -5`
Expected: three new commits on top (deploy.md, netlify.toml, README) plus the earlier spec commits. Order between the three new commits doesn't matter for correctness.

- [ ] **Step 2: Re-run the build one more time**

Run: `npm run build`
Expected: exits 0. Re-confirms that the combined state (new toml + unchanged app code) still builds cleanly.

- [ ] **Step 3: Sanity-check the tree**

Run: `ls -la netlify.toml deploy.md && head -3 netlify.toml && head -3 deploy.md`
Expected: both files exist; `netlify.toml` starts with the `# Astro SSR on Netlify…` comment; `deploy.md` starts with `# Deploy \`pbl-com\` to Netlify`.

---

## Self-review notes

- Spec coverage: every artifact in the spec file layout is produced by one of the three tasks above. Non-goals (no code changes, no CSP, no build plugins, no CI) are respected.
- No TDD steps because there is no code under test — verification is
  build-success + link/content checks, which is appropriate for
  docs + config.
- README line numbers are read at runtime in Task 3 Step 1 so the plan
  degrades gracefully if the file shifts before execution.
- Commits are one-per-file so `netlify.toml` can be reverted
  independently, matching the spec's risk mitigation.
