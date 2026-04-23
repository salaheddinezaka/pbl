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
8. Enable Netlify Identity (invite-only) and Git Gateway; invite admins.
9. Edit `public/admin/config.yml` so the backend matches (see step 10).
10. Verify first deploy, CMS login via Decap, CMS edit round-trip, protected pages.
11. (Optional) custom domain.

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
| `IDENTITY_JWT_SECRET` | No (optional) | legacy HS256 shared secret; needed only if you layer Identity on top of the content-page email gate | All contexts |
| `PUBLIC_NETLIFY_IDENTITY_URL` | No (optional) | Identity API URL for the widget on `/access`; e.g. `https://YOUR-SITE.netlify.app/.netlify/identity` | All contexts |

Only `ACCESS_COOKIE_SECRET` is strictly required. The two Identity
vars are optional: they only affect the content-page email gate at
`/access`, letting it accept a signed-in Identity user as an alternative
to the email form. Admin access to `/admin` is handled entirely by
Decap + Netlify Identity + Git Gateway (see step 9) — no env vars on
our side.

Trigger a redeploy after saving (**Deploys** → **Trigger deploy** →
**Deploy site**).

## 8. Enable Netlify's GitHub OAuth provider

Netlify → your site → **Site configuration** → **Access & security** →
**OAuth** → **Authentication providers**.

1. Enable **GitHub**.
2. Paste the OAuth App's **Client ID** and **Client secret** from
   step 4.6.
3. Save. Netlify stores the secret; it never enters the repo.

## 9. Enable Netlify Identity + Git Gateway for CMS access

On the free Netlify plan, the cleanest way to secure the Decap CMS
without giving every editor direct GitHub write access is **Identity
+ Git Gateway**. Identity controls who may sign in to Decap; Git
Gateway lets Decap commit content on editors' behalf using a single
site-level GitHub token, so editors don't need individual GitHub
access to the content repo.

This supersedes the "GitHub OAuth per editor" path in §§ 4 and 8 for
teams that don't want to add every editor to the repo. You can keep
§§ 4/8 configured as a fallback or skip them if you'll rely entirely
on Git Gateway.

1. Netlify → your site → **Project configuration** → **Identity** →
   **Enable Identity**.
2. **Registration preferences** → set to **Invite only**. Open signup
   would let anyone with the site URL create an account.
3. **Services** → **Git Gateway** → **Enable Git Gateway**. Netlify
   prompts you to authorize a GitHub access token; grant repo scope
   on the content repository. Git Gateway stores the token
   server-side; editors never see it.
4. **Invite admins** → Identity → **Invite users** → enter each
   admin's email address. Invited users receive a confirmation email
   and choose a password on first sign-in.
5. Confirm each admin accepts the invite — they must click the email
   link and finish setting a password before they can reach the CMS.
6. (Skip if you already set `config.yml` in step 10.) Ensure
   `public/admin/config.yml` uses `backend: { name: git-gateway,
   branch: <production branch> }` — see step 10.

No env vars are required on the app side for this path; Identity and
Git Gateway are configured entirely in the Netlify UI. An unauthenticated
visitor can still load the `/admin` page skeleton but cannot read or
save any content without signing in via Decap's own Identity prompt.

## 10. Align Decap to the repo

Edit `public/admin/config.yml`. Pick the `backend` that matches the
auth model you enabled:

- **Git Gateway path (recommended, step 9):**
  ```yaml
  backend:
    name: git-gateway
    branch: <production branch>
  ```
  No `repo` field needed — Git Gateway already knows which repo it
  was authorized on.

- **GitHub OAuth path (steps 4 + 8):**
  ```yaml
  backend:
    name: github
    repo: YOUR_ORG/YOUR_REPO
    branch: <production branch>
  ```

Pick one. Don't set both. Commit and push to the production branch.
Netlify rebuilds automatically; wait for the deploy to go green.

## 11. First-deploy verification

- Deploy log ends with **Build succeeded**.
- `https://YOUR-SITE.netlify.app/` responds (home page loads, assuming
  a `pages` YAML entry resolves to `/` — see README's Content model).
- `https://YOUR-SITE.netlify.app/keystatic` returns a **301** to
  `/admin` (confirms `netlify.toml` redirects are applied).
- Response headers on any page include
  `strict-transport-security`, `x-frame-options: DENY`,
  `referrer-policy: strict-origin-when-cross-origin` (check with
  browser devtools or `curl -sI https://YOUR-SITE.netlify.app/`).

## 12. CMS smoke test

1. Open `https://YOUR-SITE.netlify.app/admin`. Decap loads.
2. Decap prompts for a login. Sign in with the invited Netlify
   Identity account (Git Gateway path) or with GitHub (OAuth path).
   Collections load only after a successful login.
3. Open the **Pages** collection; confirm existing entries load.
4. Make a trivial edit (e.g. change a title), save.
5. On GitHub, confirm a commit appears on the configured branch with
   Decap as the author.
6. Wait for Netlify rebuild, then reload the page on the live site and
   confirm the edit is visible.

## 13. Protected-page smoke test

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

## 14. Custom domain (optional)

1. Netlify → **Domain management** → **Add custom domain**.
2. Follow Netlify's DNS instructions (CNAME or Netlify DNS).
3. Wait for DNS propagation, then confirm **HTTPS** is issued
   (Let's Encrypt, automatic).
4. If the OAuth App's Homepage URL still points at the
   `*.netlify.app` URL, update it to the custom domain.

## 15. Rollback

Netlify → **Deploys** → pick a previous green deploy → **Publish
deploy**. The published version becomes live within seconds. No code
changes or git operations required.

## 16. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Decap login redirects in a loop on `/admin`. | OAuth App callback URL wrong. | Must be **exactly** `https://api.netlify.com/auth/done`. No trailing slash, no path variation. |
| Netlify build fails with "Node version mismatch" or similar. | `netlify.toml` pin is `22.12.0`; Netlify's Node image list may have moved. | Update `NODE_VERSION` in `netlify.toml` to a supported minor that still satisfies `package.json` `engines`. |
| `/admin` loads blank or spinner forever. | Decap CDN unreachable or `config.yml` has a YAML parse error. | Open devtools Network tab; look for 4xx on the Decap script. Re-validate `public/admin/config.yml` with a YAML linter. |
| Every protected page returns 404, even with allowed email. | `ACCESS_COOKIE_SECRET` missing on Netlify. | Re-check env vars under **All contexts**; trigger a redeploy after adding. |
| Edits don't appear after a successful deploy. | HTML cached upstream, or wrong `backend.branch`. | Confirm `Cache-Control: public, max-age=0, must-revalidate` on the HTML response. Confirm `public/admin/config.yml` `backend.branch` matches the production branch. |
| Editor re-uploaded a filename but old image still shows. | `/uploads/*` is `immutable` in `netlify.toml`. | Netlify → **Deploys** → **Trigger deploy** → **Clear cache and deploy site**. Recommend editors upload new filenames instead. |
| Decap loads but shows "failed to load entries" or a repo-access error on login. | `config.yml` backend doesn't match what's enabled on Netlify: `git-gateway` requires Git Gateway enabled (step 9); `github` requires the OAuth provider enabled (step 8). | Pick one model, enable the matching Netlify feature, and align `public/admin/config.yml` per step 10. |
| Identity invite email never arrives. | Sent to spam, or Identity's sender domain is blocked. | Resend from Netlify → Identity → Users → the user → resend invite. Check spam. If still blocked, test with a different email domain. |

## 17. Post-launch checklist

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
- [ ] Netlify Identity enabled, registration set to **Invite only**,
      at least one admin invited and confirmed (password set).
- [ ] **Git Gateway path:** Git Gateway enabled on Netlify with a
      repo-scoped GitHub access token; `public/admin/config.yml`
      uses `backend.name: git-gateway`. *— OR —*
      **GitHub OAuth path:** OAuth App created with callback exactly
      `https://api.netlify.com/auth/done`; Netlify GitHub provider
      enabled with Client ID + secret; every editor has GitHub write
      access to the content repo; `public/admin/config.yml` uses
      `backend.name: github`.
- [ ] Reviewer/merger is assigned for protected branches, if any.

### Production hardening
- [ ] `ACCESS_COOKIE_SECRET` set in Netlify env vars (required for
      protected content pages).
- [ ] Response headers verified in production: `strict-transport-security`,
      `x-frame-options: DENY` on non-`/admin` routes, `x-frame-options: SAMEORIGIN`
      on `/admin`.
- [ ] Rollback procedure confirmed (pick an old deploy → Publish deploy).
