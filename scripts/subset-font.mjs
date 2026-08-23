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


/**
 * Rename the font family in place.
 *
 * OpenDyslexic is under the SIL Open Font License with "OpenDyslexic" as a
 * Reserved Font Name. A subset is a Modified Version, and clause 3 says a
 * Modified Version must not use the Reserved Font Name. Shipping these files
 * still calling themselves OpenDyslexic would breach the licence we are
 * relying on to ship them at all.
 *
 * Only the name strings change. Glyphs, metrics and the copyright notice are
 * left exactly as they were.
 *
 * Strings are edited in place rather than rebuilt, so every offset in the
 * table stays valid. That means the new name must be no longer than the old
 * one; it is padded with spaces when it is shorter, and the OpenType spec
 * allows trailing whitespace in name records.
 */
function renameFamily(buf) {
  const d = Buffer.from(buf);
  const numTables = d.readUInt16BE(4);
  let off = null;
  for (let i = 0; i < numTables; i++) {
    const e = 12 + i * 16;
    if (d.subarray(e, e + 4).toString("latin1") === "name") off = d.readUInt32BE(e + 8);
  }
  if (off === null) return d;

  const count = d.readUInt16BE(off + 2);
  const stringOffset = d.readUInt16BE(off + 4);

  /* 1 family, 4 full, 6 postscript, 16 typographic family. These are the
     records that carry the Reserved Font Name. */
  const RENAME = new Set([1, 4, 6, 16]);

  for (let i = 0; i < count; i++) {
    const r = off + 6 + i * 12;
    const platformID = d.readUInt16BE(r);
    const nameID = d.readUInt16BE(r + 6);
    const length = d.readUInt16BE(r + 8);
    const stringOff = d.readUInt16BE(r + 10);
    if (!RENAME.has(nameID)) continue;

    const start = off + stringOffset + stringOff;
    const utf16 = platformID === 3;
    const current = utf16
      ? Buffer.from(d.subarray(start, start + length)).swap16().toString("utf16le")
      : d.subarray(start, start + length).toString("latin1");

    if (!current.includes("OpenDyslexic")) continue;

    /* "NB Reading" is the same length as "OpenDyslexic" minus two, so every
       replacement fits and is padded back out to the original byte length. */
    const next = current.replace(/OpenDyslexic/g, "NB Reading").padEnd(current.length, " ");
    const encoded = utf16
      ? Buffer.from(next, "utf16le").swap16()
      : Buffer.from(next, "latin1");
    encoded.copy(d, start, 0, length);
  }
  return d;
}

/* argv is [node, script, ...args], so the user's first argument is index 2.
   Destructuring from index 1 bound `input` to this file's own path, and the
   subsetter then rejected it with "Unrecognized font signature: /**". */
const [input, output] = process.argv.slice(2);

if (!input || !output) {
  console.error("  usage: node scripts/subset-font.mjs <input> <output.woff2>");
  process.exit(1);
}
if (!existsSync(input)) {
  console.error(`  not found: ${input}`);
  process.exit(1);
}

const src = readFileSync(input);

/* Subset to truetype first so the name table is readable, rename, then
   compress. Going straight to woff2 would leave the name buried behind
   Brotli with no way to edit it here. */
const renamed = renameFamily(
  await subsetFont(src, CHARS, { targetFormat: "truetype" }),
);
const out = await subsetFont(renamed, CHARS, { targetFormat: "woff2" });

writeFileSync(output, out);

const pct = (100 - (out.length / src.length) * 100).toFixed(1);
const kb = (n) => `${(n / 1024).toFixed(1)}KB`;
console.log(
  `  ${basename(input)} ${kb(src.length)} -> ${basename(output)} ${kb(out.length)}  (-${pct}%, ${[...CHARS].length} glyphs)`,
);
