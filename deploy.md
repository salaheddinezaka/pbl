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
8. Enable Netlify Identity (invite-only), copy the JWT secret to `IDENTITY_JWT_SECRET`, and set `PUBLIC_NETLIFY_IDENTITY_URL`.
9. Edit `public/admin/config.yml` so `backend.repo` and `backend.branch` match.
10. Verify first deploy, `/admin` login (Identity → Decap), CMS edit round-trip, protected pages.
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
| `IDENTITY_JWT_SECRET` | **Yes** (for /admin) | *set in step 9 — leave blank or placeholder for now* | All contexts |
| `PUBLIC_NETLIFY_IDENTITY_URL` | **Yes** (for /admin) | *set in step 9 — e.g. `https://YOUR-SITE.netlify.app/.netlify/identity`* | All contexts |

The two Identity vars gate the Decap CMS UI at `/admin`. You create
them now (any placeholder value is fine) and fill them in during
step 9 once Netlify Identity is enabled and the JWT secret is
revealed. The `PUBLIC_` prefix on the second variable is required —
Astro exposes only `PUBLIC_*` values to the client bundle, where the
Netlify Identity widget reads the API URL. If you rename it, the
widget cannot initialize. If the vars are left unset, `/admin`
redirects to `/admin-login` and shows a "not configured" notice.

Trigger a redeploy after saving (**Deploys** → **Trigger deploy** →
**Deploy site**).

## 8. Enable Netlify's GitHub OAuth provider

Netlify → your site → **Site configuration** → **Access & security** →
**OAuth** → **Authentication providers**.

1. Enable **GitHub**.
2. Paste the OAuth App's **Client ID** and **Client secret** from
   step 4.6.
3. Save. Netlify stores the secret; it never enters the repo.

## 9. Enable Netlify Identity for admin access

Netlify Identity gates who can reach the Decap CMS UI at `/admin`.
Decap's own GitHub OAuth still governs who can actually commit
changes — Identity is the outer door, Decap's GitHub sign-in is the
inner one.

1. Netlify → your site → **Site configuration** → **Identity** →
   **Enable Identity**.
2. **Registration preferences** → set to **Invite only**. Open
   signup would let anyone with the site URL create an account.
3. **Services** → **JWT** → copy the **Secret**. Return to
   **Site configuration** → **Environment variables**, open the
   `IDENTITY_JWT_SECRET` entry created in step 7, and paste the
   secret as its value. Save.
4. Copy the Identity API URL — it is
   `https://YOUR-SITE.netlify.app/.netlify/identity` (replace
   `YOUR-SITE` with your real Netlify or custom domain). Return to
   **Environment variables** and paste it as the value of
   `PUBLIC_NETLIFY_IDENTITY_URL`. Save.
5. **Invite admins** → Identity → **Invite users** → enter each
   admin's email address. Invited users receive a confirmation
   email and choose a password on first sign-in. For Decap to
   actually save their edits, the same humans must also have
   GitHub write access to `YOUR_ORG/YOUR_REPO`.
6. Trigger a redeploy (**Deploys** → **Trigger deploy** → **Deploy
   site**) so the two env vars take effect.

## 10. Align Decap to the repo

Edit `public/admin/config.yml`:

- `backend.repo: YOUR_ORG/YOUR_REPO`
- `backend.branch: <production branch>` (match step 5.3)

Commit and push to the production branch. Netlify rebuilds
automatically; wait for the deploy to go green.

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

1. Open `https://YOUR-SITE.netlify.app/admin`. You are redirected to
   `/admin-login`. Sign in with the invited Netlify Identity
   account. On success you land back on `/admin` and Decap loads.
2. Log in with GitHub when Decap prompts. You must have write
   access to `YOUR_ORG/YOUR_REPO` for Decap to save edits.
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
| `/admin` redirects to `/admin-login` in a loop. | `IDENTITY_JWT_SECRET` is missing, or its value doesn't match Netlify Identity → Services → JWT. | Re-copy the secret from the Netlify UI into env vars under **All contexts**. Trigger a redeploy. Clear cookies and retry. |
| `/admin-login` shows "Netlify Identity not configured". | `PUBLIC_NETLIFY_IDENTITY_URL` is missing or wrong. | Paste `https://YOUR-SITE.netlify.app/.netlify/identity` (with your real site URL). Redeploy so the `PUBLIC_*` value reaches the client bundle. |

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
- [ ] GitHub OAuth App created with callback **exactly**
      `https://api.netlify.com/auth/done`.
- [ ] Netlify GitHub OAuth provider enabled with Client ID + secret.
- [ ] Netlify Identity enabled, registration set to **Invite only**,
      at least one admin invited and confirmed.
- [ ] `IDENTITY_JWT_SECRET` and `PUBLIC_NETLIFY_IDENTITY_URL` set in
      Netlify env vars under **All contexts**.
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
