# Memory

## Project
**pbl-com** — Astro SSR site deployed on Netlify. CMS-managed HTML pages via Decap CMS. Content lives as YAML in `src/content/pages/`. Uses `@astrojs/netlify` adapter with edge middleware.

## Stack
| Tech | Details |
|------|---------|
| **Astro** | v6.1+, `output: 'server'` mode |
| **Netlify** | Hosting + serverless/edge SSR |
| **Decap CMS** | Headless CMS at `/admin`, GitHub OAuth backend |
| **Node** | >=22.12.0 |
| **TypeScript** | Strict, via `astro check` |

## Key Paths
| Path | Purpose |
|------|---------|
| `src/content/pages/` | YAML page content (CMS-managed) |
| `src/pages/[...slug].astro` | Dynamic catch-all route |
| `src/pages/index.astro` | Home page |
| `src/middleware.ts` | Edge middleware |
| `src/content.config.ts` | Content collection schema |
| `public/admin/config.yml` | Decap CMS configuration |
| `scripts/` | Build helpers (protected manifest, migration) |

## Commands
| Command | What it does |
|---------|--------------|
| `npm run dev` | Start dev server (generates manifest first) |
| `npm run build` | Production build for Netlify |
| `npm run check` | TypeScript/Astro type checking |
| `npm run preview` | Preview production build locally |

## Me
Salah (zakasalaheddine@gmail.com)

## Preferences
- (Add preferences as they come up)

## Terms
| Term | Meaning |
|------|---------|
| (Add project-specific terms as they come up) |

## People
| Who | Role |
|-----|------|
| (Add collaborators as they come up) |
