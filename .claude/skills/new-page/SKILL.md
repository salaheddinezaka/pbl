---
name: new-page
description: Create a new CMS draft page for the pbl-com Astro site and push it to Decap CMS via git. Use when the user says "new page", "create page", "add page", "publish page", "Lincx zone page", "preview page", or wants to add content to the site. Guides non-technical users through the process step by step.
---

# New Page — Decap CMS Draft Creator

Create a YAML page file in `src/content/pages/`, commit, and push so it appears instantly in Decap CMS at `/admin` ready for final review and publish.

## Workflow Overview

```
1. Ask: Lincx zone page or custom HTML page?
2. Collect required fields (only the relevant ones)
3. Generate the YAML file with correct filename
4. Commit + push to main
5. Confirm with link to Decap admin
```

## Step 1 — Determine Page Type

Use the AskUserQuestion tool to ask the user:

**Question:** "What kind of page do you want to create?"

| Option | Description |
|--------|-------------|
| **Lincx zone page** | Quick page with a Lincx ad zone embed — just needs a zone ID and URL path |
| **Custom HTML page** | Full custom HTML content — paste your own markup |

## Step 2 — Collect Fields

### If Lincx Zone Page

Ask these questions using AskUserQuestion (combine into one call):

1. **Zone ID** — "What's the Lincx zone ID?" (e.g. `7shme6`, `cc5x46`). Free text, no options needed — let the user type via "Other".
2. **URL Path** — "What URL path should this page live at?" Hint: typically follows the pattern `clients/preview/{client-code}/{page-name}`. Free text.
3. **Title** — "What title should this page have?" Suggest the format `Zone: {zoneId}` as a default. Free text.
4. **Test mode?** — "Should the Lincx script run in test mode?"
   - Yes, test mode (Recommended) — adds `data-test-mode` attribute
   - No, production mode — no test mode attribute

### If Custom HTML Page

Ask these questions using AskUserQuestion (combine into one call):

1. **Title** — "What title should this page have?" Free text.
2. **URL Path** — "What URL path should this page live at?" Free text.
3. **HTML Content** — "Paste or describe the HTML content for the page body." Free text. If the user describes what they want instead of pasting HTML, help them write the HTML.

Then ask a follow-up:

4. **Head HTML?** — "Do you need any custom HTML in the `<head>` (styles, scripts, meta tags)?"
   - No, skip — No custom head HTML needed
   - Yes — Let user provide it via free text

### Protection (Both Types)

After collecting the main fields, ask:

**"Should this page be email-protected?"**
- No (Recommended) — Anyone with the URL can view it
- Yes — Only specific email addresses can access it

If yes, ask: **"Which email addresses should have access?"** (free text, comma-separated)

## Step 3 — Generate the YAML File

### Filename Convention

Decap CMS generates filenames as: `{slug}--{8-char-hex}.yaml`

The slug is derived from the `urlPath` by replacing `/` with `-`.

Generate the filename like this:

```javascript
// Pseudo-logic for filename
const slug = urlPath.replace(/^\/+|\/+$/g, '').replace(/\//g, '-');
const hash = crypto.randomBytes(4).toString('hex'); // 8 hex chars
const filename = `${slug}--${hash}.yaml`;
```

Use this bash command to generate the hash:
```bash
openssl rand -hex 4
```

### YAML Content

#### Lincx Zone Page Template

```yaml
title: 'Zone: {zoneId}'
urlPath: '{urlPath}'
htmlContent: |-
  <script src="https://api.lincx.com/load" data-zone-id="{zoneId}"{testModeAttr}></script>
isProtected: false
allowedEmails: []
```

Where `{testModeAttr}` is either ` data-test-mode` or empty string.

#### Custom HTML Page Template

```yaml
title: '{title}'
urlPath: '{urlPath}'
htmlContent: |-
  {htmlContent — indent every line by 2 spaces for YAML block scalar}
headHtml: |-
  {headHtml — only include this field if provided}
isProtected: {true|false}
allowedEmails: {list of emails or empty array}
```

### YAML Formatting Rules

CRITICAL — follow these exactly:

1. **Use `|-` block scalar** for `htmlContent` and `headHtml` — this strips trailing newlines and preserves internal newlines.
2. **Indent content by 2 spaces** under the block scalar indicator.
3. **Quote strings** that contain colons or special YAML characters.
4. **`allowedEmails`** format:
   - Empty: `allowedEmails: []`
   - With emails:
     ```yaml
     allowedEmails:
       - email: user@example.com
       - email: other@example.com
     ```
5. **Boolean** values: use `true` / `false` (lowercase, no quotes).
6. **Do NOT include `headHtml`** field at all if the user didn't provide any — omit it entirely.

### Write the File

Write the file to: `src/content/pages/{filename}`

Use the Write tool. Do NOT use echo or bash for file creation.

## Step 4 — Commit and Push

After writing the file, run these git commands:

```bash
cd /path/to/pbl-com
git add src/content/pages/{filename}
git commit -m "content: add page '{title}' at /{urlPath}"
git push origin main
```

IMPORTANT:
- Only `git add` the specific new file — never use `git add .`
- Use a clear commit message prefixed with `content:`
- Push to `main` (the branch configured in Decap CMS)

## Step 5 — Confirm to the User

After a successful push, tell the user:

1. The page was created and pushed.
2. It will be live after Netlify rebuilds (usually ~1 minute).
3. They can review/edit it in Decap CMS admin.
4. Show the URL path where the page will be accessible.

Example confirmation:
> Your new page **"Zone: 7shme6"** has been created and pushed!
>
> - **Site URL:** `/{urlPath}` (live after Netlify rebuilds, ~1 min)
> - **Edit in CMS:** Go to `/admin` → Pages → find "{title}"
>
> The page is ready — you can review or tweak it in the CMS admin.

## Error Handling

- **Git push fails:** Tell the user what happened. Suggest `git pull --rebase` then retry.
- **File already exists with same slug:** Generate a new random hash and retry.
- **Invalid zone ID format:** Zone IDs are typically 6 alphanumeric chars. Warn but don't block.
- **Missing fields:** Never write the file until all required fields are collected.

## Field Reference

| Field | Required | Default | Notes |
|-------|----------|---------|-------|
| `title` | Yes | `Zone: {id}` for Lincx pages | Short descriptive name |
| `urlPath` | Yes | — | No leading slash, e.g. `clients/preview/twc/demo` |
| `htmlContent` | Yes | Auto-generated for Lincx | Full HTML body content |
| `headHtml` | No | *omitted* | Only include if user provides it |
| `isProtected` | Yes | `false` | Boolean |
| `allowedEmails` | Conditional | `[]` | Required if `isProtected: true` |
