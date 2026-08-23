/* Regenerates src/tokens.json from the CSS token files.
   The admin inspector reads the JSON; the site reads the CSS. Generating one
   from the other means they cannot disagree. */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(resolve(root, "src", f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const decls = (s) =>
  Object.fromEntries([...s.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

const colors = read("colors.css");
const scopes = {};
for (const m of colors.matchAll(/(:root(?:\[data-theme="(\w+)"\])?)\s*\{([^}]*)\}/g)) {
  const t = m[2] || "light";
  scopes[t] = { ...scopes[t], ...decls(m[3]) };
}
const ramps = {},
  light = {},
  dark = {};
for (const [k, v] of Object.entries(scopes.light)) (k.startsWith("--nb-") ? ramps : light)[k] = v;
for (const [k, v] of Object.entries(scopes.dark || {})) if (!k.startsWith("--nb-")) dark[k] = v;

writeFileSync(
  resolve(root, "src/tokens.json"),
  JSON.stringify(
    {
      $comment:
        "GENERATED from the .css token files by `pnpm --filter @nb/tokens gen`. Do not edit by hand.",
      ramps,
      semantic: { light, dark },
      typography: decls(read("typography.css")),
      spacing: decls(read("spacing.css")),
      effects: decls(read("effects.css")),
    },
    null,
    2,
  ) + "\n",
);
console.log("tokens.json regenerated");
