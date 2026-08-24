// Measures contrast in the browser, from resolved computed values
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

// What each token is FOR decides how it is judged
const SURFACE =
  /^--(bg|bg-alt|surface|accent-bg|accent-bg-strong|warm-bg|warm-dim|band|footer-hover-bg)$/;
const NON_TEXT = /accent-2|focus-ring|logo/;

// Decoration, not information
const DECORATIVE = /^--(line|line-strong|shadow|soft-shadow|warm|warm-2)$/;
const DECORATIVE_MIN = 1.35;

// --scan is a 1px-on-4px overlay at low alpha
const TEXTURE = /^--scan$/;

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

    const min = DECORATIVE.test(token) ? DECORATIVE_MIN : NON_TEXT.test(token) ? 3 : 4.5;

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
      if (!fg || !against) {
        cell.innerHTML = '<span class="muted">-</span>';
        continue;
      }

      const r = contrastRatio(fg, against);
      const pass = Math.round(r * 100) / 100 >= min;
      cell.innerHTML =
        `<span class="ratio" data-pass="${pass}">${r.toFixed(2)}</span>` +
        `<span class="muted"> / ${min}${label && label !== "--bg" && label !== "--surface" ? ` on ${label}` : ""}</span>`;
    }
  }
}

paint();

new MutationObserver(paint).observe(root, {
  attributes: true,
  attributeFilter: ["data-theme"],
});
