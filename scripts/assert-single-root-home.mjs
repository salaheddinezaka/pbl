import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const pagesDir = join(rootDir, "src/content/pages");

function normalizePath(path) {
  return path.replace(/^\/+|\/+$/g, "");
}

let rootCount = 0;
const files = readdirSync(pagesDir).filter((name) => name.endsWith(".yaml"));

for (const name of files) {
  const text = readFileSync(join(pagesDir, name), "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^urlPath:\s*(.+)$/);
    if (!m) continue;
    let v = m[1].trim();
    if (
      (v.startsWith("'") && v.endsWith("'")) ||
      (v.startsWith('"') && v.endsWith('"'))
    ) {
      v = v.slice(1, -1);
    }
    if (normalizePath(v) === "") rootCount++;
    break;
  }
}

if (rootCount !== 1) {
  console.error(
    `assert-single-root-home: expected exactly 1 page with root urlPath, found ${rootCount}`
  );
  process.exit(1);
}

console.log("assert-single-root-home: ok (1 root urlPath)");
