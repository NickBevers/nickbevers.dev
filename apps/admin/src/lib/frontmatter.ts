/**
 * YAML frontmatter, parsed and serialised without a YAML dependency.
 *
 * Deliberately small: this handles the shapes content.config.ts declares ,
 * strings, booleans, dates, and one nested object, and refuses anything it
 * does not understand rather than guessing. A general YAML parser in the
 * admin would be a much larger surface for the sake of fields no post uses.
 */

export interface Frontmatter {
  title: string;
  description: string;
  pubDate: string;
  updatedDate?: string;
  tag: string;
  draft?: boolean;
  placeholder?: boolean;
  cover?: string;
  coverAlt?: string;
  mentions?: { name: string; blurb: string; href: string; cta?: string };
}

export interface ParsedEntry {
  data: Partial<Frontmatter>;
  body: string;
}

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** Strip surrounding quotes and unescape what `quote()` escaped. */
function unquote(raw: string): string {
  const v = raw.trim();
  if (
    v.length > 1 &&
    ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
  ) {
    return v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  return v;
}

function coerce(v: string): string | boolean {
  const t = v.trim();
  if (t === "true") return true;
  if (t === "false") return false;
  return unquote(t);
}

export function parse(source: string): ParsedEntry {
  const m = FENCE.exec(source);
  if (!m) return { data: {}, body: source };

  const data: Record<string, unknown> = {};
  const lines = m[1].split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    // top-level key only; indented lines belong to the block above
    if (/^\s/.test(line)) continue;

    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const rest = line.slice(idx + 1).trim();

    if (rest === "") {
      // a nested block: collect the indented lines beneath it
      const nested: Record<string, unknown> = {};
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) {
        const child = lines[++i];
        const ci = child.indexOf(":");
        if (ci < 0) continue;
        nested[child.slice(0, ci).trim()] = coerce(child.slice(ci + 1));
      }
      data[key] = nested;
    } else {
      data[key] = coerce(rest);
    }
  }

  return { data: data as Partial<Frontmatter>, body: source.slice(m[0].length) };
}

/** Quote only when needed, so hand-edited files stay readable in git. */
function quote(v: string): string {
  const needs = /^[\s>|*&!%@`{[]|[:#]\s|["'\\\n]|^$|^(true|false|null|~|-?\d)/i.test(v);
  if (!needs) return v;
  return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function serialise(data: Partial<Frontmatter>, body: string): string {
  const lines: string[] = ["---"];

  /* Fixed order rather than object order: a stable field order means a save
     that changes one value produces a one-line diff, not a reshuffle. */
  const ORDER: (keyof Frontmatter)[] = [
    "title",
    "description",
    "pubDate",
    "updatedDate",
    "tag",
    "draft",
    "placeholder",
    "cover",
    "coverAlt",
    "mentions",
  ];

  for (const key of ORDER) {
    const v = data[key];
    if (v === undefined || v === null || v === "") continue;

    if (key === "mentions" && typeof v === "object") {
      const m = v as Record<string, string>;
      if (!m.name) continue;
      lines.push("mentions:");
      for (const k of ["name", "blurb", "href", "cta"] as const) {
        if (m[k]) lines.push(`  ${k}: ${quote(m[k])}`);
      }
      continue;
    }

    lines.push(`${key}: ${typeof v === "boolean" ? String(v) : quote(String(v))}`);
  }

  lines.push("---");
  /* The body is written back byte for byte, including whatever blank line
     follows the closing fence. Normalising it here looked tidy but meant
     every save rewrote the author's spacing. A diff on a file nobody
     edited, and content changed without being asked. */
  return lines.join("\n") + "\n" + body;
}

/** A filename from a title: lowercase, hyphenated, ASCII only. */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60)
    .replace(/-$/, "");
}
