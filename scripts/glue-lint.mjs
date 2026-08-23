/**
 * The Astro compiler drops a newline that sits directly between text and an
 * adjacent tag, so
 *
 *   a post's
 *   <code>cover</code> field
 *
 * ships as "post's<code>cover</code>" with the space gone. It renders as two
 * words glued together and nothing warns you; it was found in a screenshot.
 *
 * Any deliberate no-space case (punctuation, an opening bracket) is already
 * written on one line, so requiring the break to be explicit costs nothing.
 * Write &#32; where the space matters.
 */
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";

const files = globSync("apps/*/src/**/*.astro");

/* Only a tag that sits INSIDE a run of prose can glue two words together, and
   only when text is on both sides of the line break.

   Three earlier versions of this check were too broad. Matching any tag gave
   85 hits, all fine. Adding <span> re-flagged the status strip, where the two
   sides are flex children 679px apart: reading textContent across them looks
   glued but renders correctly. <pre> keeps its newlines, so it never glues
   either, and the file is skipped whole.

   What is left is the case actually found in a screenshot: prose, an inline
   <code>, prose. */
const INLINE = "code|a|em|strong|b|i|kbd|abbr|small|sup|sub";
const OPEN = new RegExp(`^<(${INLINE})[\\s>]`, "i");
const CLOSE = new RegExp(`</(${INLINE})>$`, "i");
const WORD = /[\p{L}\p{N}'"),.:;!?]/u;

let bad = 0;
for (const file of files) {
  const src = readFileSync(file, "utf8");
  const body = src
    .replace(/^---[\s\S]*?^---/m, "")
    .replace(/<(style|script)[\s\S]*?<\/\1>/g, "")
    // <pre> preserves newlines, so a break there is never dropped
    .replace(/<pre[\s\S]*?<\/pre>/g, "");

  const lines = body.split("\n");
  for (let i = 0; i < lines.length - 1; i++) {
    const cur = lines[i].replace(/\s+$/, "");
    const nxt = lines[i + 1].replace(/^\s+/, "");
    if (!cur || !nxt) continue;

    // An expression fragment is not prose: "? <a ...>", ") : <span />", "))}"
    const EXPR = /[{}()?:]\s*$|^[)}\]]|^[?:]/;
    if (EXPR.test(cur) || EXPR.test(nxt)) continue;

    // "word" then <code> on the next line
    const opensGlued = WORD.test(cur.at(-1) ?? "") && OPEN.test(nxt);
    // "</code>" then a word on the next line
    const closesGlued = CLOSE.test(cur) && WORD.test(nxt[0] ?? "");

    if (opensGlued || closesGlued) {
      console.log(`  ${file}:${i + 1}`);
      console.log(`    ${cur.trim()}`);
      console.log(`    ${nxt.trim()}`);
      bad++;
    }
  }
}

console.log(
  `\n  ${files.length} files checked, ${bad} place${bad === 1 ? "" : "s"} where a space would be dropped`,
);
if (bad) {
  console.log("  Put the words on one line, or write &#32; for the space.\n");
  process.exit(1);
}
