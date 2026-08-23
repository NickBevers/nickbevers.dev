/**
 * Measures contrast in the browser, from resolved computed values.
 *
 * Reading the token file would tell you what the CSS *says*; resolving it on
 * a live element tells you what a visitor actually gets, including whichever
 * theme is active and any var() chain. The numbers therefore re-measure when
 * the theme is switched.
 */
import { contrastRatio, parseColor, composite, type RGB } from "@nb/ui/lib/contrast.ts";

const root = document.documentElement;

function resolve(token: string): string {
  return getComputedStyle(root).getPropertyValue(token).trim();
}

function toRGB(value: string, over?: RGB): RGB | null {
  const c = parseColor(value);
  if (!c) return null;
  return c.a < 1 && over ? composite(c, over) : { r: c.r, g: c.g, b: c.b };
}

/**
 * What each token is FOR decides how it is judged.
 *
 * Measuring a background against a background gives 1.00 and flags it red,
 * which is noise: --bg-alt is not meant to be legible on --bg, it is meant to
 * sit beside it. Only foregrounds get a ratio; surfaces are shown as swatches
 * and marked as such.
 */
const SURFACE = /^--(bg|bg-alt|surface|accent-bg|accent-bg-strong|warm-bg|warm-dim|band|footer-hover-bg)$/;
const NON_TEXT = /accent-2|focus-ring|logo/;

/**
 * Decoration, not information. A hairline, a hard shadow and the scanline
 * carry no meaning, so WCAG's 3:1 does not apply; what matters is that they
 * are visible at all. The site's own gate uses a 1.35 floor for exactly
 * these, and this table mirrors it rather than inventing a stricter rule the
 * design deliberately does not meet.
 */
const DECORATIVE = /^--(line|line-strong|shadow|soft-shadow|warm|warm-2)$/;
const DECORATIVE_MIN = 1.35;

/**
 * --scan is a 1px-on-4px overlay at low alpha. Compositing it as a solid fill
 * gives a ratio it was never meant to meet: the honest figure is the mean
 * across the pattern, which is a quarter of the declared alpha. It is texture,
 * so it is reported without a pass or fail at all.
 */
const TEXTURE = /^--scan$/;

/**
 * Several tokens are only ever used on one specific surface, and judging them
 * against --bg says nothing. --accent-on lives on --accent, --band-text on
 * --band. Pairing each with the surface it is actually painted on is the
 * difference between a useful table and a wall of false failures.
 */
const PAIRED: Record<string, string> = {
  "--accent-on": "--accent",
  "--band-text": "--band",
  "--warm-on": "--warm",
  "--pill-on": "--accent-2",
  "--footer-hover-on": "--footer-hover-bg",
  "--footer-hover-2": "--footer-hover-bg",
};

function paint() {
  const bg = toRGB(resolve("--bg"));
  const surface = toRGB(resolve("--surface"));

  for (const row of document.querySelectorAll<HTMLElement>("[data-token]")) {
    const token = row.dataset.token!;
    const value = resolve(token);

    const swatch = row.querySelector<HTMLElement>("[data-swatch]");
    const valueEl = row.querySelector<HTMLElement>("[data-value]");
    if (swatch) swatch.style.background = value;
    if (valueEl) valueEl.textContent = value || "(unset)";

    /* A surface has no foreground role, so a ratio against another surface
       would be meaningless. Say so rather than printing a red 1.00. */
    if (SURFACE.test(token)) {
      for (const sel of ["[data-on-bg]", "[data-on-surface]"]) {
        const cell = row.querySelector<HTMLElement>(sel);
        if (cell) cell.innerHTML = '<span class="muted">surface</span>';
      }
      continue;
    }

    if (TEXTURE.test(token)) {
      for (const sel of ["[data-on-bg]", "[data-on-surface]"]) {
        const cell = row.querySelector<HTMLElement>(sel);
        if (cell) cell.innerHTML = '<span class="muted">texture</span>';
      }
      continue;
    }

    const min = DECORATIVE.test(token)
      ? DECORATIVE_MIN
      : NON_TEXT.test(token)
        ? 3
        : 4.5;

    /* A token with a fixed home is measured there, in one column, and the
       other is left blank rather than filled with a number nobody wants. */
    const pairedWith = PAIRED[token];
    const columns: [string, RGB | null, string][] = pairedWith
      ? [
          ["[data-on-bg]", toRGB(resolve(pairedWith)), pairedWith],
          ["[data-on-surface]", null, ""],
        ]
      : [
          ["[data-on-bg]", bg, "--bg"],
          ["[data-on-surface]", surface, "--surface"],
        ];

    for (const [sel, against, label] of columns) {
      const cell = row.querySelector<HTMLElement>(sel);
      if (!cell) continue;

      const fg = toRGB(value, against ?? undefined);
      if (!fg || !against) { cell.innerHTML = '<span class="muted">-</span>'; continue; }

      const r = contrastRatio(fg, against);
      const pass = Math.round(r * 100) / 100 >= min;
      cell.innerHTML =
        `<span class="ratio" data-pass="${pass}">${r.toFixed(2)}</span>` +
        `<span class="muted"> / ${min}${label && label !== "--bg" && label !== "--surface" ? ` on ${label}` : ""}</span>`;
    }
  }
}

paint();

/* Re-measure when the theme changes: the same token resolves to a different
   colour, and a stale number here would be worse than none. */
new MutationObserver(paint).observe(root, {
  attributes: true,
  attributeFilter: ["data-theme"],
});
