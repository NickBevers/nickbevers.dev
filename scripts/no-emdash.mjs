/**
 * No em dashes, anywhere.
 *
 * A house style rule, enforced rather than remembered. Covers source and the
 * built output, so one cannot slip in through a component that renders it.
 *
 * Run: pnpm dashes
 */
import { readdir, readFile } from "node:fs/promises";
import { join, extname, relative } from "node:path";

/* Written as an escape so this file does not trip its own check. */
const DASH = "\u2014";

const ROOTS = ["apps", "packages", "scripts"];
const EXTS = new Set([
  ".astro",
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".css",
  ".md",
  ".mdx",
  ".json",
  ".jsonc",
  ".html",
  ".xsl",
]);
const SKIP = new Set(["node_modules", "dist", ".astro", "reports", ".git"]);

async function walk(dir, out = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else if (EXTS.has(extname(e.name))) out.push(p);
  }
  return out;
}

let hits = 0;
for (const root of ROOTS) {
  for (const path of (await walk(root)).toSorted()) {
    const src = await readFile(path, "utf8");
    if (!src.includes(DASH)) continue;
    const lines = src.split("\n");
    for (const [i, line] of lines.entries()) {
      if (!line.includes(DASH)) continue;
      console.log(`  !! ${relative(process.cwd(), path)}:${i + 1}  ${line.trim().slice(0, 80)}`);
      hits++;
    }
  }
}

console.log(hits === 0 ? "\n  no em dashes\n" : `\n  ${hits} em dash(es)\n`);
process.exit(hits ? 1 : 0);
