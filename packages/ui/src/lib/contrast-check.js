/**
 * Contrast gate. Parses packages/tokens/src/colors.css, resolves every var()
 * chain to a literal colour, and asserts each semantic pair meets WCAG 2.2 AA.
 *
 * Reads the real CSS rather than a hand-kept list, so a token edit that breaks
 * a pair fails CI instead of shipping. Run: pnpm contrast
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const CSS = resolve(here, "../../../tokens/src/colors.css");

/* ---------- colour maths (mirrors contrast.ts; kept dependency-free) ---------- */
const parse = (s) => {
  s = String(s).trim();
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (m) {
    let h = m[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: 1,
    };
  }
  m = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (m) {
    const p = m[1]
      .split(/[,\s/]+/)
      .filter(Boolean)
      .map(Number);
    if (p.length < 3 || p.slice(0, 3).some(Number.isNaN)) return null;
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 && !Number.isNaN(p[3]) ? p[3] : 1 };
  }
  return null;
};
const over = (f, b) => ({
  r: f.r * f.a + b.r * (1 - f.a),
  g: f.g * f.a + b.g * (1 - f.a),
  b: f.b * f.a + b.b * (1 - f.a),
});
const chan = (v) => {
  const x = v / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};
const lum = ({ r, g, b }) => 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
const ratio = (a, b) => {
  const [hi, lo] = lum(a) >= lum(b) ? [lum(a), lum(b)] : [lum(b), lum(a)];
  return (hi + 0.05) / (lo + 0.05);
};

/* ---------- parse the token file into light/dark scopes ---------- */
const src = readFileSync(CSS, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const scopes = {};
/* Selector lists, not just :root. The semantic layers are re-assertable on any
   element (":root, [data-theme=\"light\"]"), so match the whole list and take
   the theme from whichever part names one. Matching only :root here made the
   parser skip the light block entirely and report every pair as unresolved. */
for (const m of src.matchAll(/((?::root|\[data-theme="\w+"\])[^{]*)\{([^}]*)\}/g)) {
  const theme = /\[data-theme="(\w+)"\]/.exec(m[1])?.[1] || "light";
  scopes[theme] ??= {};
  for (const d of m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) scopes[theme][d[1]] = d[2].trim();
}
// dark inherits every light token it does not itself override
scopes.dark = { ...scopes.light, ...scopes.dark };

const resolveVar = (name, theme, seen = new Set()) => {
  let v = scopes[theme][name];
  if (v == null) return null;
  while (v.startsWith("var(")) {
    const ref = /^var\(\s*(--[\w-]+)/.exec(v)?.[1];
    if (!ref || seen.has(ref)) return null;
    seen.add(ref);
    v = scopes[theme][ref];
    if (v == null) return null;
  }
  return v.trim();
};

/* ---------- the pairs that must hold ----------
   size: "normal" needs 4.5, "large" 3.0, "non-text" 3.0 (WCAG 1.4.3 / 1.4.11) */
const PAIRS = [
  // body + secondary text on all three surfaces
  ["--text", "--bg", "normal"],
  ["--text", "--bg-alt", "normal"],
  ["--text", "--surface", "normal"],
  ["--text-2", "--bg", "normal"],
  ["--text-2", "--bg-alt", "normal"],
  ["--text-2", "--surface", "normal"],
  ["--text-3", "--bg", "normal"],
  ["--text-3", "--bg-alt", "normal"],
  ["--text-3", "--surface", "normal"],
  // links
  ["--accent", "--bg", "normal"],
  ["--accent", "--bg-alt", "normal"],
  ["--accent", "--surface", "normal"],
  ["--accent", "--accent-bg", "normal"],
  // metadata set in --warm-text (eyebrows, entry numbers)
  ["--warm-text", "--bg", "normal"],
  ["--warm-text", "--bg-alt", "normal"],
  ["--warm-text", "--surface", "normal"],
  // text sitting on a filled block
  ["--accent-on", "--accent", "normal"],
  ["--warm-on", "--warm", "normal"],
  // the NEW badge blinks between these two fills; both phases carry text
  ["--warm-on", "--warm-dim", "normal"],
  // 10px status pill on a mid-green fill
  ["--pill-on", "--accent-2", "normal"],
  // the hover wash used on top of --warm-bg strips
  ["--text", "--accent-bg-strong", "normal"],
  ["--accent", "--accent-bg-strong", "normal"],
  // Anything that may sit on --accent-bg when a link is hovered. The global
  // prose-link wash once reached the fixed-dark footer and put sand-500 text
  // on green-200 at 1.60. Neither rule knew about the other.
  ["--text-2", "--accent-bg", "normal"],
  // The footer's own hover pair. Fixed colours in both themes, so they are
  // checked against each other rather than against a themed surface.
  ["--footer-hover-on", "--footer-hover-bg", "normal"],
  ["--footer-hover-2", "--footer-hover-bg", "normal"],
  ["--band-text", "--band", "normal"],
  // non-text: focus ring and structural borders must be perceivable
  ["--focus-ring", "--bg", "non-text"],
  ["--focus-ring", "--bg-alt", "non-text"],
  ["--focus-ring", "--surface", "non-text"],
  ["--line-strong", "--bg", "non-text"],
  ["--accent-2", "--bg", "non-text"],
  // the accessibility figure on the floating button
  ["--logo-on-surface", "--surface", "non-text"],
];

/**
 * Decorative depth. The hard offset block is the brand's ONLY depth cue ,
 * nothing is blurred and nothing is rounded, so a shadow that disappears
 * into its background silently removes the device. These are not WCAG
 * requirements (a shadow conveys no information), so the bar is "visible",
 * not 3:1: a 1.35 floor separates "reads as an edge" from "invisible".
 * --soft-shadow was clay-100 at 1.16 and looked like no shadow at all.
 */
const DEPTH = [
  ["--soft-shadow", "--bg"],
  ["--shadow", "--bg"],
  ["--warm-2", "--bg"],
  // A hover wash that barely differs from the surface it covers reads as
  // no hover at all. --accent-bg on --warm-bg was 1.04: invisible.
  ["--accent-bg-strong", "--warm-bg"],
  ["--accent-bg", "--bg"],
];
const DEPTH_MIN = 1.15;

const NEED = { normal: 4.5, large: 3, "non-text": 3 };

/* The scanline overlay darkens every background slightly. Text must still pass
   underneath it, so each pair is checked against the scanlined background too. */
const scanned = (bgHex, theme) => {
  const scan = parse(resolveVar("--scan", theme));
  const bg = parse(bgHex);
  if (!scan || !bg) return bg;
  // 1px of --scan every 4px => mean alpha is a quarter of the declared alpha
  return over({ ...scan, a: scan.a / 4 }, bg);
};

let failed = 0,
  checked = 0;
for (const theme of ["light", "dark"]) {
  console.log(`\n  ${theme.toUpperCase()}`);
  for (const [fgName, bgName, size] of PAIRS) {
    const fgRaw = resolveVar(fgName, theme);
    const bgRaw = resolveVar(bgName, theme);
    if (!fgRaw || !bgRaw) {
      console.log(`  ?? ${fgName} on ${bgName}: unresolved`);
      failed++;
      continue;
    }

    const bgSolid = parse(bgRaw);
    let fg = parse(fgRaw);
    if (!fg || !bgSolid) {
      console.log(`  ?? ${fgName} on ${bgName}: unparseable`);
      failed++;
      continue;
    }
    if (fg.a < 1) fg = { ...over(fg, bgSolid), a: 1 };

    const plain = ratio(fg, bgSolid);
    const withScan = ratio(fg, scanned(bgRaw, theme));
    const worst = Math.min(plain, withScan);
    const need = NEED[size];
    const ok = Math.round(worst * 100) / 100 >= need;

    checked++;
    if (!ok) failed++;
    const label = `${fgName} on ${bgName}`.padEnd(38);
    console.log(
      `  ${ok ? "ok" : "!!"} ${label} ${worst.toFixed(2).padStart(6)}  need ${need}  ${ok ? "" : "FAIL"}`,
    );
  }
}

for (const theme of ["light", "dark"]) {
  console.log(`\n  ${theme.toUpperCase()}: decorative depth (min ${DEPTH_MIN})`);
  for (const [fgName, bgName] of DEPTH) {
    const fg = parse(resolveVar(fgName, theme));
    const bg = parse(resolveVar(bgName, theme));
    if (!fg || !bg) {
      console.log(`  ?? ${fgName} on ${bgName}: unresolved`);
      failed++;
      continue;
    }
    const r = ratio(fg.a < 1 ? over(fg, bg) : fg, bg);
    const ok = Math.round(r * 100) / 100 >= DEPTH_MIN;
    checked++;
    if (!ok) failed++;
    console.log(
      `  ${ok ? "ok" : "!!"} ${`${fgName} on ${bgName}`.padEnd(38)} ${r.toFixed(2).padStart(6)}  need ${DEPTH_MIN}  ${ok ? "" : "INVISIBLE"}`,
    );
  }
}

console.log(`\n  ${checked} pairs checked, ${failed} failing\n`);
process.exit(failed ? 1 : 0);
