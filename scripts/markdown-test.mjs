/**
 * Tests the editor's markdown handling.
 *
 * The renderer produces HTML from text that will be committed to a
 * repository, so escaping is the first thing checked. The highlighter must
 * also never lose or add a character: it sits behind a textarea, and any
 * length change makes the caret drift from the glyph under it.
 */
import { highlight, render } from "../apps/admin/src/scripts/markdown.ts";

let fails = 0;
const ok = (m) => console.log(`  ok ${m}`);
const bad = (m) => { console.log(`  !! ${m}`); fails++; };
const check = (c, g, b) => (c ? ok(g) : bad(b));

const strip = (h) => h.replace(/<[^>]+>/g, "");
const unescape = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

console.log("\n  MARKDOWN");

/* ---- the highlighter must be lossless ---- */
const samples = [
  "## A heading\n\nSome **bold** and *italic* text.",
  "- one\n- two\n\n1. first\n2. second",
  "```css\n--green-700: oklch(0.42 0.03 165);\n```",
  "A [link](https://example.com) and `inline code`.",
  "<CodeWindow filename=\"palette.css\">\n\ncontent\n\n</CodeWindow>",
  "> A quote that carries on\n> across two lines.",
  "Text with <angle> brackets & an ampersand.",
  "",
];
for (const [i, s] of samples.entries()) {
  const back = unescape(strip(highlight(s)));
  check(back === s, `highlight is lossless (sample ${i + 1})`,
    `highlight changed the text (sample ${i + 1})\n       in:  ${JSON.stringify(s)}\n       out: ${JSON.stringify(back)}`);
}

/* ---- the highlighter must colour the right things ---- */
check(/t-head/.test(highlight("## Heading")), "headings are marked", "heading not marked");
check(/t-bold/.test(highlight("**x**")), "bold is marked", "bold not marked");
check(/t-link/.test(highlight("[a](b)")), "links are marked", "link not marked");
check(/t-fence/.test(highlight("```css")), "code fences are marked", "fence not marked");
check(/t-mdx/.test(highlight("<CodeWindow />")), "MDX components are marked", "MDX not marked");
check(/t-list/.test(highlight("- item")), "list markers are marked", "list marker not marked");
{
  const h = highlight("```\n**not bold in a fence**\n```");
  check(!/t-bold/.test(h), "inline syntax inside a fence is not highlighted", "bold was highlighted inside a code fence");
}

/* ---- the renderer must escape ---- */
{
  const html = render('<script>alert(1)</script>\n\nAfter.');
  check(!/<script/i.test(html), "a script tag is escaped, not emitted", `RAW SCRIPT IN OUTPUT: ${html.slice(0, 90)}`);
}
{
  const html = render("[click](javascript:alert(1))");
  check(!/href="javascript:/i.test(html), "a javascript: href is refused", `javascript: URL survived: ${html}`);
}
{
  const html = render("[ok](https://example.com)");
  check(/href="https:\/\/example.com"/.test(html), "an https link is kept", `https link lost: ${html}`);
}
{
  const html = render("Tom & Jerry <3");
  check(/&amp;/.test(html) && /&lt;3/.test(html), "ampersands and angle brackets are escaped", `not escaped: ${html}`);
}

/* ---- the renderer must produce the right blocks ---- */
const cases = [
  ["## Heading", /<h2>Heading<\/h2>/, "h2"],
  ["### Deeper", /<h3>Deeper<\/h3>/, "h3"],
  ["- a\n- b", /<ul><li>a<\/li><li>b<\/li><\/ul>/, "unordered list"],
  ["1. a\n2. b", /<ol><li>a<\/li><li>b<\/li><\/ol>/, "ordered list"],
  ["> quoted", /<blockquote>quoted<\/blockquote>/, "blockquote"],
  ["```\nx\n```", /<pre><code>x<\/code><\/pre>/, "code fence"],
  ["**b**", /<strong>b<\/strong>/, "bold"],
  ["*i*", /<em>i<\/em>/, "italic"],
  ["`c`", /<code>c<\/code>/, "inline code"],
  ["one\ntwo", /<p>one two<\/p>/, "paragraph joins soft-wrapped lines"],
];
for (const [src, re, label] of cases) {
  check(re.test(render(src)), `renders ${label}`, `${label} wrong: ${render(src)}`);
}

/* ---- MDX is shown as a placeholder, never executed ---- */
{
  const html = render("<CodeWindow filename=\"x\">");
  check(/class="mdx"/.test(html) && !/<CodeWindow/.test(html),
    "an MDX component renders as a labelled placeholder",
    `MDX handled wrong: ${html}`);
}

console.log(`\n  ${fails} failure(s)\n`);
process.exit(fails ? 1 : 0);
