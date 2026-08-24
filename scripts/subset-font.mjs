// Subsets a font to the characters this site actually renders
import subsetFont from "subset-font";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { basename } from "node:path";

const CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789" +
  " .,:;!?'\"’‘“”, –-()[]{}@#&*/\\|_+=<>%$€£°" +
  "→←↑↓·•…©®™" +
  "àáâäãåèéêëìíîïòóôöõùúûüçñýÿœæßÀÁÂÄÃÅÈÉÊËÌÍÎÏÒÓÔÖÕÙÚÛÜÇÑŸŒÆ";

// Rename the font family in place
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

  // 1 family, 4 full, 6 postscript, 16 typographic family
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
      ? Buffer.from(d.subarray(start, start + length))
          .swap16()
          .toString("utf16le")
      : d.subarray(start, start + length).toString("latin1");

    if (!current.includes("OpenDyslexic")) continue;

    const next = current.replace(/OpenDyslexic/g, "NB Reading").padEnd(current.length, " ");
    const encoded = utf16 ? Buffer.from(next, "utf16le").swap16() : Buffer.from(next, "latin1");
    encoded.copy(d, start, 0, length);
  }
  return d;
}

// argv is [node, script, ...args], so the user's first argument is index 2
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

const renamed = renameFamily(await subsetFont(src, CHARS, { targetFormat: "truetype" }));
const out = await subsetFont(renamed, CHARS, { targetFormat: "woff2" });

writeFileSync(output, out);

const pct = (100 - (out.length / src.length) * 100).toFixed(1);
const kb = (n) => `${(n / 1024).toFixed(1)}KB`;
console.log(
  `  ${basename(input)} ${kb(src.length)} -> ${basename(output)} ${kb(out.length)}  (-${pct}%, ${[...CHARS].length} glyphs)`,
);
