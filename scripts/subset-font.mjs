/**
 * Subsets a font to the characters this site actually renders.
 *
 * OpenDyslexic ships at 115KB for one weight. Not because the letterforms
 * are complex, but because it carries glyph coverage a personal blog in
 * English and Dutch will never use. Cutting to the characters below took it
 * to ~24KB, an 80% saving, with every accented character and typographic mark
 * the site uses still intact.
 *
 * Usage:
 *   node scripts/subset-font.mjs <input.otf|ttf|woff2> <output.woff2>
 *
 * OpenDyslexic is OFL-1.1, which permits subsetting and redistribution.
 */
import subsetFont from "subset-font";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { basename } from "node:path";

/* Latin letters, digits, and the punctuation the design uses: the arrows in
   "Read the entry →", the middot in the status strip, curly quotes, the em
   dash, and the currency/degree marks that show up in prose. */
const CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789" +
  " .,:;!?'\"’‘“”, –-()[]{}@#&*/\\|_+=<>%$€£°" +
  "→←↑↓·•…©®™" +
  /* Accents for Dutch, French and Belgian names: "café", "naïve", "résumé",
     and anyone whose name this site might mention. */
  "àáâäãåèéêëìíîïòóôöõùúûüçñýÿœæßÀÁÂÄÃÅÈÉÊËÌÍÎÏÒÓÔÖÕÙÚÛÜÇÑŸŒÆ";

const [, input, output] = process.argv;

if (!input || !output) {
  console.error("  usage: node scripts/subset-font.mjs <input> <output.woff2>");
  process.exit(1);
}
if (!existsSync(input)) {
  console.error(`  not found: ${input}`);
  process.exit(1);
}

const src = readFileSync(input);
const out = await subsetFont(src, CHARS, { targetFormat: "woff2" });

writeFileSync(output, out);

const pct = (100 - (out.length / src.length) * 100).toFixed(1);
const kb = (n) => `${(n / 1024).toFixed(1)}KB`;
console.log(
  `  ${basename(input)} ${kb(src.length)} -> ${basename(output)} ${kb(out.length)}  (-${pct}%, ${[...CHARS].length} glyphs)`,
);
