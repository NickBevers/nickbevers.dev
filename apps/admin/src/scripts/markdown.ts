/**
 * A small markdown tokeniser and renderer for the editor.
 *
 * Deliberately not the site's pipeline. The site renders MDX through Astro at
 * build time, which needs a build; this runs on every keystroke in a browser.
 * The preview is a reading aid, not a proof of the final render, and it is
 * labelled as such.
 *
 * Everything is escaped before any markup is produced. The input is the
 * author's own text, but the same function renders content that will be
 * committed, and an editor that executes its own draft is a bad habit.
 */

export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* ---------------------------------------------------------------- highlight */

/**
 * Wrap markdown syntax in spans for the highlight layer.
 *
 * Line-oriented: block syntax is decided per line, inline syntax within it.
 * A full parser would be more correct and much slower, and this only has to
 * be right enough to help the eye.
 */
export function highlight(src: string): string {
  const lines = src.split("\n");
  let inFence = false;
  const out: string[] = [];

  for (const line of lines) {
    const esc = escapeHtml(line);

    // fenced code: everything between the fences is one colour
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      out.push(`<span class="t-fence">${esc}</span>`);
      continue;
    }
    if (inFence) {
      out.push(`<span class="t-code">${esc}</span>`);
      continue;
    }

    // frontmatter-ish or headings
    if (/^\s{0,3}#{1,6}\s/.test(line)) {
      out.push(`<span class="t-head">${esc}</span>`);
      continue;
    }
    if (/^\s*>/.test(line)) {
      out.push(`<span class="t-quote">${esc}</span>`);
      continue;
    }
    // an MDX component on its own line
    if (/^\s*<\/?[A-Z][\w.]*/.test(line)) {
      out.push(`<span class="t-mdx">${esc}</span>`);
      continue;
    }

    out.push(inline(esc));
  }

  return out.join("\n");
}

function inline(esc: string): string {
  let s = esc;

  // list markers, only at the head of the line
  s = s.replace(/^(\s*)([-*+]|\d+\.)(\s)/, '$1<span class="t-list">$2</span>$3');

  // `code`
  s = s.replace(/(`[^`\n]+`)/g, '<span class="t-code">$1</span>');

  // [text](url)
  s = s.replace(
    /(\[)([^\]\n]*)(\])(\()([^)\n]*)(\))/g,
    '<span class="t-punct">$1</span><span class="t-link">$2</span>' +
      '<span class="t-punct">$3$4</span><span class="t-url">$5</span><span class="t-punct">$6</span>',
  );

  // **bold** then *italic*, bold first so ** is not eaten as two *
  s = s.replace(/(\*\*[^*\n]+\*\*)/g, '<span class="t-bold">$1</span>');
  s = s.replace(/(?<![*\w])(\*[^*\n]+\*)(?![*\w])/g, '<span class="t-em">$1</span>');

  // an inline MDX tag
  s = s.replace(/(&lt;\/?[A-Z][\w.]*[^&]*?&gt;)/g, '<span class="t-mdx">$1</span>');

  return s;
}

/* ------------------------------------------------------------------ preview */

/** Render markdown to HTML for the preview pane. */
export function render(src: string): string {
  const lines = src.split("\n");
  const out: string[] = [];
  let i = 0;

  const inlineMd = (t: string) => {
    let s = escapeHtml(t);
    s = s.replace(/`([^`\n]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(?<![*\w])\*([^*\n]+)\*(?![*\w])/g, "<em>$1</em>");
    s = s.replace(
      /\[([^\]\n]*)\]\(([^)\s]+)[^)]*\)/g,
      (_m, text, href) =>
        /^(https?:|\/|#)/.test(href)
          ? `<a href="${href}" rel="noreferrer">${text}</a>`
          : `<a>${text}</a>`, // refuse javascript: and friends
    );
    return s;
  };

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*```/.test(line)) {
      const lang = line.replace(/^\s*```/, "").trim();
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
      i++;
      out.push(
        `<pre${lang ? ` data-lang="${escapeHtml(lang)}"` : ""}><code>${escapeHtml(body.join("\n"))}</code></pre>`,
      );
      continue;
    }

    // An MDX component: shown as a placeholder rather than executed. The
    // preview cannot run the site's components, and pretending otherwise
    // would misrepresent the final page.
    const mdx = /^\s*<\/?([A-Z][\w.]*)/.exec(line);
    if (mdx) {
      out.push(`<div class="mdx">&lt;${escapeHtml(mdx[1])} /&gt; renders on the site</div>`);
      i++;
      continue;
    }

    const h = /^\s{0,3}(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = Math.min(h[1].length, 6);
      out.push(`<h${level}>${inlineMd(h[2])}</h${level}>`);
      i++;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        body.push(lines[i++].replace(/^\s*>\s?/, ""));
      }
      out.push(`<blockquote>${inlineMd(body.join(" "))}</blockquote>`);
      continue;
    }

    if (/^\s*([-*+]|\d+\.)\s/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s/.test(lines[i])) {
        items.push(`<li>${inlineMd(lines[i++].replace(/^\s*([-*+]|\d+\.)\s+/, ""))}</li>`);
      }
      out.push(ordered ? `<ol>${items.join("")}</ol>` : `<ul>${items.join("")}</ul>`);
      continue;
    }

    if (!line.trim()) { i++; continue; }

    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*(```|>|#{1,6}\s|[-*+]\s|\d+\.\s|<[A-Z])/.test(lines[i])
    ) {
      para.push(lines[i++]);
    }
    out.push(`<p>${inlineMd(para.join(" "))}</p>`);
  }

  return out.join("\n");
}

/* ------------------------------------------------------------------ toolbar */

export interface Wrap {
  before: string;
  after?: string;
  /** Prefix each selected line instead of wrapping the whole selection. */
  linePrefix?: string;
  placeholder?: string;
}

export const TOOLS: Record<string, Wrap> = {
  bold: { before: "**", after: "**", placeholder: "bold text" },
  italic: { before: "*", after: "*", placeholder: "italic text" },
  link: { before: "[", after: "](https://)", placeholder: "link text" },
  code: { before: "`", after: "`", placeholder: "code" },
  h2: { before: "", linePrefix: "## ", placeholder: "Heading" },
  ul: { before: "", linePrefix: "- ", placeholder: "List item" },
  ol: { before: "", linePrefix: "1. ", placeholder: "List item" },
  quote: { before: "", linePrefix: "> ", placeholder: "Quoted text" },
};

/**
 * Apply a tool to a textarea, preserving undo.
 *
 * Uses execCommand("insertText") where available: assigning to .value wipes
 * the browser's undo stack, so Cmd+Z after a toolbar press would throw away
 * everything typed before it.
 */
export function applyTool(el: HTMLTextAreaElement, tool: Wrap) {
  const { selectionStart: start, selectionEnd: end, value } = el;
  const selected = value.slice(start, end);

  let replacement: string;
  let caretStart: number;
  let caretEnd: number;

  if (tool.linePrefix) {
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = end + (value.slice(end).indexOf("\n") + 1 || value.length - end);
    const block = value.slice(lineStart, Math.min(lineEnd, value.length));
    const body = block || tool.placeholder || "";
    const numbered = tool.linePrefix === "1. ";

    replacement = body
      .split("\n")
      .map((l, n) => (l.trim() ? `${numbered ? `${n + 1}. ` : tool.linePrefix}${l}` : l))
      .join("\n");

    el.setSelectionRange(lineStart, Math.min(lineEnd, value.length));
    caretStart = lineStart;
    caretEnd = lineStart + replacement.length;
  } else {
    const body = selected || tool.placeholder || "";
    replacement = `${tool.before}${body}${tool.after ?? ""}`;
    caretStart = start + tool.before.length;
    caretEnd = caretStart + body.length;
  }

  el.focus();
  if (!document.execCommand?.("insertText", false, replacement)) {
    // Fallback for browsers that have dropped execCommand.
    const s = el.selectionStart;
    el.value = value.slice(0, s) + replacement + value.slice(el.selectionEnd);
  }
  el.setSelectionRange(caretStart, caretEnd);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}
