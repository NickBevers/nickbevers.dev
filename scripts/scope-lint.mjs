/**
 * Catches styles that silently match nothing.
 *
 * Astro scopes a component's <style> with a hash applied to the elements that
 * component renders. Pass a class to a child component: <Reveal class="sec">
 *, and the element belongs to the CHILD's scope, so a bare `.sec { }` rule in
 * the parent compiles fine, ships, and matches nothing.
 *
 * That is how the homepage lost every section's padding without a single
 * error. This flags any class handed to a child component that the same file
 * then styles without :global().
 *
 * Run: pnpm scope
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative, extname } from "node:path";

const ROOTS = ["apps/site/src", "apps/admin/src", "packages/ui/src"];

async function walk(dir, out = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else if (extname(e.name) === ".astro") out.push(p);
  }
  return out;
}

let problems = 0;

for (const root of ROOTS) {
  for (const path of (await walk(root)).toSorted()) {
    const src = await readFile(path, "utf8");

    const styleMatch = /<style(?![^>]*\bis:global\b)[^>]*>([\s\S]*?)<\/style>/.exec(src);
    if (!styleMatch) continue;
    // Strip comments first: a rule discussed in prose ("a bare `.sec` rule
    // matches nothing") is not a rule. Replace with spaces so offsets hold.
    const css = styleMatch[1].replace(/\/\*[\s\S]*?\*\//g, (c) => " ".repeat(c.length));

    // Only IMPORTED components own their own scope. A capitalised name that
    // is a local variable holding a tag string: `const Tag = href ? "a" : "div"`
    //: renders a plain element in THIS file's scope, so it is not a problem.
    const imported = new Set(
      [...src.matchAll(/^\s*import\s+([A-Z][\w]*)\s+from/gm)].map((m) => m[1]),
    );
    if (imported.size === 0) continue;

    const isChild = (tag) => imported.has(tag);

    const passed = new Set();
    for (const m of src.matchAll(/<([A-Z][\w]*)\b[^>]*?\bclass="([^"]+)"/g)) {
      if (!isChild(m[1])) continue;
      for (const cls of m[2].split(/\s+/).filter(Boolean)) passed.add(cls);
    }
    for (const m of src.matchAll(/<([A-Z][\w]*)\b[^>]*?\bclass:list=\{\[([^\]]+)\]/g)) {
      if (!isChild(m[1])) continue;
      for (const q of m[2].matchAll(/["']([\w-]+)["']/g)) passed.add(q[1]);
    }

    for (const cls of passed) {
      // does this file style it, outside a :global()?
      const bare = new RegExp(`(^|[^(\\w-])\\.${cls}(?![\\w-])`, "gm");
      let flagged = false;
      for (const m of css.matchAll(bare)) {
        // Is this occurrence inside a :global(...)? Count unbalanced opens
        // back to the start of the selector (the previous } or ;).
        const selStart = Math.max(css.lastIndexOf("}", m.index), css.lastIndexOf(";", m.index)) + 1;
        const before = css.slice(selStart, m.index);
        const opens = (before.match(/:global\(/g) ?? []).length;
        const closes = (before.match(/\)/g) ?? []).length;
        if (opens <= closes) {
          flagged = true;
          break;
        }
      }
      if (flagged) {
        console.log(
          `  !! ${relative(process.cwd(), path)}  .${cls} is passed to a child component ` +
            `but styled without :global(). It will match nothing`,
        );
        problems++;
      }
    }
  }
}

console.log(
  problems === 0
    ? "\n  no orphaned scoped styles\n"
    : `\n  ${problems} rule(s) that will never match\n`,
);
process.exit(problems ? 1 : 0);
