// Regenerates src/tokens.json from the CSS token files
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(resolve(root, "src", f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const decls = (s) =>
  Object.fromEntries([...s.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));

const colors = read("colors.css");
const scopes = {};
// Selectors may be grouped (":root, [data-theme=\"light\"]") or bare
// ("[data-theme=\"dark\"]"), so match the whole prelude and read the theme from it.
for (const m of colors.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
  const prelude = m[1];
  if (!/:root|\[data-theme=/.test(prelude)) continue;
  const theme = prelude.match(/\[data-theme="(\w+)"\]/)?.[1] ?? "light";
  scopes[theme] = { ...scopes[theme], ...decls(m[2]) };
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
