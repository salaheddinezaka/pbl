# Admin Identity Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Protect `/admin` (the Decap CMS UI) with a Netlify Identity login via the existing Astro edge middleware; add a `/admin-login` page that hosts the Identity widget; expand `deploy.md` with the operator steps.

**Architecture:** One middleware modification (three edits to `src/middleware.ts`), one new Astro page (`src/pages/admin-login.astro`), one env-var comment refresh (`.env.example`), one docs expansion (`deploy.md`). Content-page gate is untouched. Two commits: code, then docs.

**Tech Stack:** Astro 6 SSR with `@astrojs/netlify` edge middleware, `jose` for JWT verification (already installed), legacy Netlify Identity widget from `https://identity.netlify.com/v1/netlify-identity-widget.js`. The spec this plan implements lives at `docs/superpowers/specs/2026-04-22-admin-identity-gate-design.md`.

---

## File structure

| Path | Action | Responsibility |
|---|---|---|
| `src/middleware.ts` | modify | Gate `/admin*` with `nf_jwt` verification; let `/admin-login` through unauthenticated. |
| `src/pages/admin-login.astro` | create | Identity-widget login page; redirects to `next` (default `/admin`) on success. |
| `.env.example` | edit | Reclassify Identity vars from *Optional* to *Required for /admin access*. |
| `deploy.md` | edit | Add TL;DR item, update § 7 env-var table, insert new § 9, renumber §§ 9–16 → 10–17, expand smoke test, add troubleshooting row + checklist item. |

Two commits:
1. `feat(admin): gate /admin with Netlify Identity via edge middleware` — files 1–3.
2. `docs(deploy): add Netlify Identity setup for /admin access` — file 4.

---

## Task 1: Add the `/admin` Identity gate (code + commit)

**Files:**
- Modify: `src/middleware.ts`
- Create: `src/pages/admin-login.astro`
- Modify: `.env.example`

No automated tests (spec non-goal). Verification is `npm run check` and `npm run build`.

- [ ] **Step 1: Remove `/admin` skip from `skipMiddleware`**

In `src/middleware.ts`, delete the line inside `skipMiddleware` that bypasses `/admin`. Use this exact Edit:

- `old_string`:
  ```
    if (pathname.startsWith("/_astro")) return true;
    if (pathname.startsWith("/admin")) return true;
    if (pathname.startsWith("/access")) return true;
  ```
- `new_string`:
  ```
    if (pathname.startsWith("/_astro")) return true;
    if (pathname === "/admin-login" || pathname.startsWith("/admin-login/")) return true;
    if (pathname.startsWith("/access")) return true;
  ```

This both removes the `/admin` skip and inserts the `/admin-login` skip in one edit, preserving surrounding context.

- [ ] **Step 2: Add the `/admin*` gate block in `onRequest`**

In `src/middleware.ts`, insert a new block directly after the early-return for `skipMiddleware` and before the protected-manifest lookup. Use this exact Edit:

- `old_string`:
  ```
    if (skipMiddleware(pathname)) {
      return next();
    }

    const man = manifest as ProtectedManifest;
    const entry = getProtectedEntry(pathname, man);
  ```
- `new_string`:
  ```
    if (skipMiddleware(pathname)) {
      return next();
    }

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

    const man = manifest as ProtectedManifest;
    const entry = getProtectedEntry(pathname, man);
  ```

`verifyIdentityEmail` is already imported at `src/middleware.ts:6` — no new imports needed.

- [ ] **Step 3: Verify the middleware file looks right**

Run: `sed -n '22,35p;60,90p' src/middleware.ts`

Expected: lines 22–35 show `skipMiddleware` with `/admin-login` in place of `/admin`, and lines 60–90 show `onRequest` with the new `/admin*` gate block appearing between `skipMiddleware(pathname)` check and the `getProtectedEntry` call. No compile errors will surface yet; that's Step 7.

- [ ] **Step 4: Create `src/pages/admin-login.astro`**

Write this exact content to the new file:

```astro
---
import { safeNextPath } from "../lib/access-gate";

export const prerender = false;

const rawNext = Astro.url.searchParams.get("next");
const nextPath = safeNextPath(rawNext, Astro.url.origin) ?? "/admin";

const identityUrl = import.meta.env.PUBLIC_NETLIFY_IDENTITY_URL ?? "";
const configured = identityUrl.length > 0;
---

<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Admin sign-in</title>
    <style>
      :root {
        font-family: system-ui, sans-serif;
        line-height: 1.5;
        color: #1a1a1a;
        background: #e6e6e6;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 1.5rem;
      }
      .card {
        background: #fff;
        padding: 1.75rem 2rem;
        border-radius: 8px;
        max-width: 26rem;
        width: 100%;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      }
      h1 {
        font-size: 1.125rem;
        margin: 0 0 0.75rem;
      }
      p {
        margin: 0 0 1rem;
        font-size: 0.9375rem;
        color: #444;
      }
      button {
        margin-top: 0.5rem;
        width: 100%;
        padding: 0.55rem 1rem;
        font-size: 1rem;
        border: none;
        border-radius: 4px;
        background: #1a1a1a;
        color: #fff;
        cursor: pointer;
      }
      .err {
        color: #7a1a1a;
        font-size: 0.875rem;
      }
      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 0.875rem;
        background: #f2f2f2;
        padding: 0.1rem 0.3rem;
        border-radius: 3px;
      }
    </style>
  </head>
  <body>
    <div class="card">
      {
        configured ? (
          <>
            <h1>Admin sign-in</h1>
            <p>
              Sign in with the Netlify Identity account that was invited
              for this site's CMS.
            </p>
            <button type="button" id="netlify-login">
              Sign in
            </button>
          </>
        ) : (
          <>
            <h1>Netlify Identity not configured</h1>
            <p class="err">
              The site operator has not yet set
              <code>PUBLIC_NETLIFY_IDENTITY_URL</code>. The CMS cannot be
              reached until Netlify Identity is enabled and the
              environment variables are configured. See
              <code>deploy.md</code>.
            </p>
          </>
        )
      }
    </div>
    {
      configured ? (
        <script is:inline define:vars={{ identityUrl, nextPath }}>
          (function () {
            var url = identityUrl;
            var target = nextPath;
            var btn = document.getElementById("netlify-login");
            if (!btn) return;
            var s = document.createElement("script");
            s.src =
              "https://identity.netlify.com/v1/netlify-identity-widget.js";
            s.onload = function () {
              if (!window.netlifyIdentity) return;
              window.netlifyIdentity.init({ APIUrl: url });
              window.netlifyIdentity.on("login", function () {
                window.location.href = target;
              });
              btn.addEventListener("click", function () {
                window.netlifyIdentity.open();
              });
            };
            document.head.appendChild(s);
          })();
        </script>
      ) : null
    }
  </body>
</html>
```

- [ ] **Step 5: Update `.env.example`**

Replace the two Identity entries with tighter comments reflecting their new required status. Use this exact Edit:

- `old_string`:
  ```
  # Optional: Netlify Identity JWT secret (Site settings → Identity → Services → JWT)
  # Enables nf_jwt cookie validation in middleware alongside the email form cookie.
  IDENTITY_JWT_SECRET=

  # Optional: Netlify Identity API URL for the widget on /access
  # Example: https://your-site.netlify.app/.netlify/identity
  PUBLIC_NETLIFY_IDENTITY_URL=
  ```
- `new_string`:
  ```
  # Required for /admin access. Site JWT secret from Netlify →
  # Identity → Services → JWT. Middleware verifies the nf_jwt cookie
  # against this secret to gate the Decap CMS UI.
  IDENTITY_JWT_SECRET=

  # Required for /admin access. Identity API URL for the widget on
  # /admin-login (and /access, if that flow is used).
  # Example: https://your-site.netlify.app/.netlify/identity
  PUBLIC_NETLIFY_IDENTITY_URL=
  ```

- [ ] **Step 6: Run type check**

Run: `npm run check`
Expected: exits 0 (or prints the same `astro check` baseline warnings the codebase already has — no new errors introduced by the edits). If TypeScript flags the middleware edits, revisit Steps 1–2 to confirm the Edit anchors matched.

- [ ] **Step 7: Run production build**

Run: `npm run build`
Expected: exits 0 and ends with `[build] Complete!`. Confirms the new `admin-login.astro` page compiles and the middleware still parses.

- [ ] **Step 8: Spot-check the new login page renders**

Start the dev server in the background:

Run (background): `npm run dev`

Once listening on port 4321, fetch the unauthenticated pages:

```bash
curl -sS -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:4321/admin
curl -sS http://localhost:4321/admin-login | grep -Eo "<h1[^>]*>[^<]+</h1>" | head -1
```

Expected:
- `/admin` returns `302` with `redirect_url` ending in `/admin-login?next=%2Fadmin` (the middleware gate fired because `IDENTITY_JWT_SECRET` is empty in `.env`).
- `/admin-login` returns HTML containing `<h1>Netlify Identity not configured</h1>` (because `PUBLIC_NETLIFY_IDENTITY_URL` is empty in `.env`).

Stop the dev server. (Kill the background process when done.)

- [ ] **Step 9: Commit**

```bash
git add src/middleware.ts src/pages/admin-login.astro .env.example
git commit -m "$(cat <<'EOF'
feat(admin): gate /admin with Netlify Identity via edge middleware

- Remove /admin from skipMiddleware and add /admin-login in its place.
- Add an /admin* gate block in onRequest that verifies the nf_jwt
  cookie against IDENTITY_JWT_SECRET using the existing
  verifyIdentityEmail helper; redirects to /admin-login on miss.
- New /admin-login page hosts the Netlify Identity widget; on
  successful login redirects to ?next= (default /admin). Shows a
  config-missing notice if PUBLIC_NETLIFY_IDENTITY_URL is unset.
- Reclassify IDENTITY_JWT_SECRET and PUBLIC_NETLIFY_IDENTITY_URL in
  .env.example as required for /admin access.

Content-page protected-route system is intentionally unchanged.
EOF
)"
```

---

## Task 2: Expand `deploy.md` with Identity setup (docs + commit)

**Files:**
- Modify: `deploy.md`

Six edits, each scoped to a specific region. Apply in order so anchors don't collide.

- [ ] **Step 1: Add Identity step to TL;DR**

Use this exact Edit:

- `old_string`:
  ```
  7. Enable Netlify's GitHub OAuth provider with the OAuth App credentials.
  8. Edit `public/admin/config.yml` so `backend.repo` and `backend.branch` match.
  9. Verify first deploy, CMS login, CMS edit round-trip, protected pages.
  10. (Optional) custom domain.
  ```
- `new_string`:
  ```
  7. Enable Netlify's GitHub OAuth provider with the OAuth App credentials.
  8. Enable Netlify Identity (invite-only), copy the JWT secret to `IDENTITY_JWT_SECRET`, and set `PUBLIC_NETLIFY_IDENTITY_URL`.
  9. Edit `public/admin/config.yml` so `backend.repo` and `backend.branch` match.
  10. Verify first deploy, `/admin` login (Identity → Decap), CMS edit round-trip, protected pages.
  11. (Optional) custom domain.
  ```

- [ ] **Step 2: Update the § 7 env-vars table**

Use this exact Edit:

- `old_string`:
  ```
  | Variable | Required | Value | Scope |
  |---|---|---|---|
  | `ACCESS_COOKIE_SECRET` | **Yes** | the hex string from step 3 | All contexts |
  | `IDENTITY_JWT_SECRET` | No | Netlify Identity → Services → JWT | All contexts |
  | `PUBLIC_NETLIFY_IDENTITY_URL` | No | e.g. `https://YOUR-SITE.netlify.app/.netlify/identity` | All contexts |

  Set the optional two only if you plan to use Netlify Identity alongside
  the email form gate on `/access`.
  ```
- `new_string`:
  ```
  | Variable | Required | Value | Scope |
  |---|---|---|---|
  | `ACCESS_COOKIE_SECRET` | **Yes** | the hex string from step 3 | All contexts |
  | `IDENTITY_JWT_SECRET` | **Yes** (for /admin) | Netlify Identity → Services → JWT (obtained in step 9) | All contexts |
  | `PUBLIC_NETLIFY_IDENTITY_URL` | **Yes** (for /admin) | e.g. `https://YOUR-SITE.netlify.app/.netlify/identity` | All contexts |

  The two Identity vars gate the Decap CMS UI at `/admin`. If unset,
  `/admin` redirects to `/admin-login` and shows a "not configured"
  notice. You'll paste their values after step 9 enables Identity and
  reveals the JWT secret.
  ```

- [ ] **Step 3: Insert the new § 9 "Enable Netlify Identity for admin access"**

Insert the new section between § 8 and the current § 9 ("Align Decap to the repo"). Use this exact Edit — note the two visible `## 9.` markers are the insertion anchor; the new block goes before the old one and renames the old one to `## 10.`:

- `old_string`:
  ```
  1. Enable **GitHub**.
  2. Paste the OAuth App's **Client ID** and **Client secret** from
     step 4.6.
  3. Save. Netlify stores the secret; it never enters the repo.

  ## 9. Align Decap to the repo
  ```
- `new_string`:
  ```
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
  3. **Services** → **JWT** → copy the **Secret**. Paste it into the
     `IDENTITY_JWT_SECRET` env var you added in step 7.
  4. Copy the Identity API URL — it is
     `https://YOUR-SITE.netlify.app/.netlify/identity` (swap in your
     Netlify-assigned URL or custom domain). Paste it into
     `PUBLIC_NETLIFY_IDENTITY_URL` in step 7.
  5. **Invite admins** → Identity → **Invite users** → enter each
     admin's email address. Invited users receive a confirmation
     email and choose a password on first sign-in. For Decap to
     actually save their edits, the same humans must also have
     GitHub write access to `YOUR_ORG/YOUR_REPO`.
  6. Trigger a redeploy (**Deploys** → **Trigger deploy** → **Deploy
     site**) so the two env vars take effect.

  ## 10. Align Decap to the repo
  ```

- [ ] **Step 4: Renumber §§ 10 through 16 to 11 through 17**

Each subsequent section heading gets +1. Apply seven sequential Edits (4a–4g) to avoid collisions. Do them in the order listed so each Edit's `old_string` remains unique at the moment it runs.

Edit 4a:

- `old_string`: `## 10. First-deploy verification`
- `new_string`: `## 11. First-deploy verification`

Edit 4b:

- `old_string`: `## 11. CMS smoke test`
- `new_string`: `## 12. CMS smoke test`

Edit 4c:

- `old_string`: `## 12. Protected-page smoke test`
- `new_string`: `## 13. Protected-page smoke test`

Edit 4d:

- `old_string`: `## 13. Custom domain (optional)`
- `new_string`: `## 14. Custom domain (optional)`

Edit 4e:

- `old_string`: `## 14. Rollback`
- `new_string`: `## 15. Rollback`

Edit 4f:

- `old_string`: `## 15. Troubleshooting`
- `new_string`: `## 16. Troubleshooting`

Edit 4g:

- `old_string`: `## 16. Post-launch checklist`
- `new_string`: `## 17. Post-launch checklist`

- [ ] **Step 5: Expand the CMS smoke-test section with the Identity note**

Use this exact Edit:

- `old_string`:
  ```
  ## 12. CMS smoke test

  1. Open `https://YOUR-SITE.netlify.app/admin`.
  2. Log in with GitHub when prompted. You must have write access to
     `YOUR_ORG/YOUR_REPO`.
  ```
- `new_string`:
  ```
  ## 12. CMS smoke test

  1. Open `https://YOUR-SITE.netlify.app/admin`. You are redirected to
     `/admin-login`. Sign in with the invited Netlify Identity
     account. On success you land back on `/admin` and Decap loads.
  2. Log in with GitHub when Decap prompts. You must have write
     access to `YOUR_ORG/YOUR_REPO` for Decap to save edits.
  ```

- [ ] **Step 6: Add an Identity troubleshooting row**

Use this exact Edit — the anchor is the last troubleshooting row we want to keep above the new one:

- `old_string`:
  ```
  | Editor re-uploaded a filename but old image still shows. | `/uploads/*` is `immutable` in `netlify.toml`. | Netlify → **Deploys** → **Trigger deploy** → **Clear cache and deploy site**. Recommend editors upload new filenames instead. |
  ```
- `new_string`:
  ```
  | Editor re-uploaded a filename but old image still shows. | `/uploads/*` is `immutable` in `netlify.toml`. | Netlify → **Deploys** → **Trigger deploy** → **Clear cache and deploy site**. Recommend editors upload new filenames instead. |
  | `/admin` redirects to `/admin-login` in a loop. | `IDENTITY_JWT_SECRET` is missing, or its value doesn't match Netlify Identity → Services → JWT. | Re-copy the secret from the Netlify UI into env vars under **All contexts**. Trigger a redeploy. Clear cookies and retry. |
  | `/admin-login` shows "Netlify Identity not configured". | `PUBLIC_NETLIFY_IDENTITY_URL` is missing or wrong. | Paste `https://YOUR-SITE.netlify.app/.netlify/identity` (with your real site URL). Redeploy so the `PUBLIC_*` value reaches the client bundle. |
  ```

- [ ] **Step 7: Add the Identity post-launch checklist item**

Use this exact Edit:

- `old_string`:
  ```
  ### CMS and access
  - [ ] GitHub OAuth App created with callback **exactly**
        `https://api.netlify.com/auth/done`.
  - [ ] Netlify GitHub OAuth provider enabled with Client ID + secret.
  - [ ] Every editor has GitHub write access to the content repo (or the
        branch-protection workflow supports Decap's commit style).
  - [ ] Reviewer/merger is assigned for protected branches, if any.
  ```
- `new_string`:
  ```
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
  ```

- [ ] **Step 8: Verify the renumbering and new sections**

Run: `grep -nE '^## [0-9]+\. ' deploy.md`

Expected: exactly 17 numbered headings in sequence, 1 through 17, with `## 9. Enable Netlify Identity for admin access` and `## 10. Align Decap to the repo` both present. If any number is skipped or duplicated, re-check Step 4's sub-edits.

- [ ] **Step 9: Verify the env-vars table reads consistently**

Run: `grep -nE '(IDENTITY_JWT_SECRET|PUBLIC_NETLIFY_IDENTITY_URL)' deploy.md | head`

Expected: the two variables appear in the § 7 table marked `**Yes** (for /admin)`, in the § 9 setup narrative, in the troubleshooting rows, and in the § 17 checklist item. No stray references to them as "optional".

- [ ] **Step 10: Commit**

```bash
git add deploy.md
git commit -m "$(cat <<'EOF'
docs(deploy): add Netlify Identity setup for /admin access

- TL;DR and § 7 env-vars table now reflect that IDENTITY_JWT_SECRET
  and PUBLIC_NETLIFY_IDENTITY_URL are required for /admin.
- New § 9 "Enable Netlify Identity for admin access" walks through
  enabling Identity, invite-only mode, copying the JWT secret,
  setting the Identity API URL, and inviting admins.
- Renumbered subsequent sections (9–16 → 10–17).
- Expanded the CMS smoke test so operators know the /admin →
  /admin-login → Decap → GitHub flow.
- Added two troubleshooting rows (redirect loop; not-configured notice)
  and a post-launch checklist item for Identity.
EOF
)"
```

---

## Final verification

- [ ] **Step 1: Confirm the two commits landed**

Run: `git log --oneline -4`

Expected: the two new commits (`feat(admin): …` and `docs(deploy): …`) on top of the earlier Identity-spec commit.

- [ ] **Step 2: Re-run the full build**

Run: `npm run build`

Expected: exits 0. Confirms the combined state (new middleware + new page + docs) still builds cleanly.

- [ ] **Step 3: Tree sanity check**

Run: `ls -la src/pages/admin-login.astro && grep -c "admin-login" src/middleware.ts && grep -c "## 9. Enable Netlify Identity" deploy.md`

Expected: the `.astro` file exists; `grep -c` on `src/middleware.ts` returns `1` (the `/admin-login` skip line); `grep -c` on `deploy.md` returns `1` (the new § 9 heading).

---

## Self-review notes

- **Spec coverage:** every spec section maps to a step.
  - Middleware three-edit plan → Task 1 Steps 1–3.
  - `admin-login.astro` contents + widget loader → Task 1 Step 4.
  - `.env.example` reclassification → Task 1 Step 5.
  - `deploy.md` § 7 table, new § 9, renumbering, smoke-test note,
    troubleshooting rows, checklist item → Task 2 Steps 1–7.
  - Two-commit plan → Task 1 Step 9 + Task 2 Step 10.
  - Non-goals (no test harness, no `netlify.toml` edit, no Decap
    config touch) respected: no steps touch those files.
- **Placeholders:** none. `YOUR-SITE` / `YOUR_ORG` placeholders inside
  the `deploy.md` content are intentional operator-facing template
  strings, not plan gaps.
- **Type consistency:** `verifyIdentityEmail`, `safeNextPath`,
  `ACCESS_COOKIE`, `nf_jwt` cookie name used consistently with their
  current definitions in `src/lib/access-gate.ts` and
  `src/middleware.ts`.
- **Edit-anchor safety:** renumbering in Task 2 Step 4 is split into
  seven sub-edits applied in ascending order so each `old_string`
  remains unique when its turn comes.
