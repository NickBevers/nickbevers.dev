/**
 * Lints .md/.mdx content, because oxlint cannot.
 *
 * oxlint 1.79 reports "No files found to lint" for .mdx: verified against an
 * identical .jsx file that produced three jsx-a11y warnings. Native Markdown
 * support is on the oxc Q3 2026 roadmap; until then the a11y rules that matter
 * most in prose (images without alt text, links that say "click here") are
 * unchecked. This covers that gap.
 *
 * Deliberately small: it checks what actually goes wrong in a blog post, and
 * defers anything structural to the Zod schema in content.config.ts, which
 * already fails the build on a cover image without coverAlt.
 *
 * Run: pnpm content
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative, extname } from "node:path";

const ROOT = "apps/site/src/content";

/** Link text that tells a screen-reader user nothing out of context. */
const VAGUE = /^(click here|here|read more|more|link|this|this link)$/i;

async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else if ([".md", ".mdx"].includes(extname(e.name))) out.push(p);
  }
  return out;
}

/** Strip frontmatter and fenced code so neither is scanned as prose. */
function body(src) {
  const noFm = src.replace(/^---\n[\s\S]*?\n---\n/, (m) => "\n".repeat(m.split("\n").length - 1));
  return noFm.replace(/```[\s\S]*?```/g, (m) => "\n".repeat(m.split("\n").length - 1));
}

const at = (src, index) => src.slice(0, index).split("\n").length;

let problems = 0;
const report = (file, line, msg) => {
  console.log(`  !! ${file}:${line}  ${msg}`);
  problems++;
};

const files = await walk(ROOT).catch(() => []);
if (files.length === 0) {
  console.log("\n  no content files found\n");
  process.exit(0);
}

for (const path of files.toSorted()) {
  const file = relative(ROOT, path);
  const src = await readFile(path, "utf8");
  const text = body(src);

  // Markdown images must carry alt text.
  for (const m of text.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) {
    if (m[1].trim() === "") report(file, at(text, m.index), `image has empty alt: ${m[2]}`);
  }

  // JSX <img> in MDX: oxlint's alt-text rule never sees these.
  for (const m of text.matchAll(/<img\b([^>]*)>/g)) {
    if (!/\balt\s*=/.test(m[1])) report(file, at(text, m.index), "<img> without an alt attribute");
  }

  // Link text that conveys nothing when read out of context (WCAG 2.4.4).
  for (const m of text.matchAll(/\[([^\]]+)\]\([^)]+\)/g)) {
    if (VAGUE.test(m[1].trim()))
      report(file, at(text, m.index), `uninformative link text: "${m[1].trim()}"`);
  }

  // Heading levels must not skip: an h2 followed by an h4 breaks the outline.
  let prev = 0;
  for (const m of text.matchAll(/^(#{1,6})\s+\S/gm)) {
    const level = m[1].length;
    if (prev && level > prev + 1) {
      report(file, at(text, m.index), `heading jumps from h${prev} to h${level}`);
    }
    prev = level;
  }

  // Em dashes are not used anywhere on this site, in copy or in code.
  for (const m of text.matchAll(/[^\n]{0,40}\u2014[^\n]{0,40}/g)) {
    report(file, at(text, m.index), `em dash: ${m[0].trim()}`);
  }

  // The title is the page's h1; a second one in the body creates two.
  const h1s = [...text.matchAll(/^#\s+\S/gm)];
  if (h1s.length > 0) {
    report(
      file,
      at(text, h1s[0].index),
      "body contains an h1. The frontmatter title is already the h1",
    );
  }
}

console.log(
  problems === 0
    ? `\n  ${files.length} content file(s), no problems\n`
    : `\n  ${problems} problem(s) in ${files.length} file(s)\n`,
);
process.exit(problems ? 1 : 0);
