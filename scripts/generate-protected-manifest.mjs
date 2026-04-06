#!/usr/bin/env node
/**
 * Build-time manifest of protected CMS pages for edge middleware.
 * Mirrors urlPath + isProtected + allowedEmails semantics from src/content.config.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const pagesDir = path.join(root, "src/content/pages");
const outFile = path.join(root, "src/generated/protected-pages.json");

function normalizePath(p) {
  return String(p ?? "").replace(/^\/+|\/+$/g, "");
}

function normalizeAllowedEmails(val) {
  if (!Array.isArray(val)) return [];
  return val
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "email" in item) {
        return String(item.email ?? "");
      }
      return "";
    })
    .filter(Boolean);
}

function main() {
  const manifest = {};
  if (!fs.existsSync(pagesDir)) {
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(manifest, null, 0) + "\n");
    console.warn("generate-protected-manifest: no pages dir, wrote empty manifest");
    return;
  }

  const files = fs.readdirSync(pagesDir).filter((f) => f.endsWith(".yaml"));
  for (const file of files) {
    const raw = fs.readFileSync(path.join(pagesDir, file), "utf8");
    let data;
    try {
      data = parseYaml(raw);
    } catch (e) {
      console.error(`generate-protected-manifest: skip ${file}: ${e.message}`);
      continue;
    }
    if (!data || typeof data !== "object") continue;
    if (!data.isProtected) continue;

    const urlPath = normalizePath(data.urlPath);
    const allowedEmails = normalizeAllowedEmails(data.allowedEmails);
    manifest[urlPath] = { allowedEmails };
  }

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(manifest, null, 0) + "\n");
  console.log(
    `generate-protected-manifest: wrote ${Object.keys(manifest).length} protected path(s) to ${path.relative(root, outFile)}`
  );
}

main();
