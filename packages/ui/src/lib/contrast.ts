/** WCAG 2.2 contrast math. Shared by the CI gate and the admin inspector. */

export type RGB = { r: number; g: number; b: number };

/** Parse #rgb, #rrggbb, or rgba(r,g,b,a). Returns null for anything else. */
export function parseColor(input: string): (RGB & { a: number }) | null {
  const s = input.trim();

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (hex) {
    let h = hex[1]!;
    if (h.length === 3) h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: 1,
    };
  }

  const fn = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (fn) {
    const parts = fn[1]!
      .split(/[,\s/]+/)
      .filter(Boolean)
      .map(Number);
    if (parts.length < 3 || parts.slice(0, 3).some(Number.isNaN)) return null;
    return {
      r: parts[0]!,
      g: parts[1]!,
      b: parts[2]!,
      a: parts.length > 3 && !Number.isNaN(parts[3]!) ? parts[3]! : 1,
    };
  }

  return null;
}

/** Composite a translucent foreground over an opaque background. */
export function composite(fg: RGB & { a: number }, bg: RGB): RGB {
  return {
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
  };
}

/** sRGB gamma expansion for one 0-255 channel. */
function linearize(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance, WCAG 2.x definition. */
export function luminance({ r, g, b }: RGB): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** Contrast ratio between two opaque colours. Always >= 1. */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export type Level = "AA" | "AAA";
export type TextSize = "normal" | "large" | "non-text";

/** Required ratio for a given level and size class. */
export function required(level: Level, size: TextSize): number {
  if (size === "non-text") return 3;
  if (level === "AAA") return size === "large" ? 4.5 : 7;
  return size === "large" ? 3 : 4.5;
}

export function passes(ratio: number, level: Level, size: TextSize): boolean {
  // Round to 2dp first: 4.499 should not fail a 4.5 bar on float noise.
  return Math.round(ratio * 100) / 100 >= required(level, size);
}

/** Ratio between two CSS colour strings, resolving alpha against `over`. */
export function ratioOf(fg: string, bg: string, over?: string): number | null {
  const f = parseColor(fg);
  const b = parseColor(bg);
  if (!f || !b) return null;
  const base = over ? parseColor(over) : null;
  const bgSolid = b.a < 1 && base ? composite(b, base) : b;
  const fgSolid = f.a < 1 ? composite(f, bgSolid) : f;
  return contrastRatio(fgSolid, bgSolid);
}
