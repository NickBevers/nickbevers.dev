import { readFileSync } from "node:fs";
import { globSync } from "node:fs";

const files = globSync("apps/*/src/**/*.astro");

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
