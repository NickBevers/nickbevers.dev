# Fonts

## opendyslexic-400.woff2 / opendyslexic-700.woff2

Subsets of OpenDyslexic by Abbie Gonzalez, licensed under the SIL Open Font
License 1.1. The full licence is in `OFL.txt` alongside these files, where the
licence requires it to travel.

The accessibility menu's "Dyslexia-friendly font" toggle uses these two paths.
If they are missing the toggle is a no-op: `@font-face` fails to load and the
browser falls through to Hanken Grotesk, so nothing breaks.

### Why they are called "NB Reading" inside

"OpenDyslexic" is a Reserved Font Name under the OFL, and a subset is a
Modified Version. Clause 3 says a Modified Version must not carry the Reserved
Font Name, so `pnpm subset` rewrites the family to "NB Reading" and the CSS
asks for that. The copyright notice is left untouched.

The filenames still say opendyslexic, which is fine: the restriction is on the
name the font presents, not on what the file is called. Keeping it makes the
origin obvious to anyone reading the directory.

## Subset them first

`@fontsource/opendyslexic` ships **115KB for the 400 weight alone**, against
34KB for the whole of Hanken Grotesk's variable 400–800 range. That is not
the letterforms being complex; it is glyph coverage this site never renders.

`pnpm subset` cuts it to the characters actually used:

```
pnpm subset ~/Downloads/OpenDyslexic-Regular.otf apps/site/public/fonts/opendyslexic-400.woff2
pnpm subset ~/Downloads/OpenDyslexic-Bold.otf    apps/site/public/fonts/opendyslexic-700.woff2
```

Measured against the real files:

|     | Source  | Subset     | Saving |
| --- | ------- | ---------- | ------ |
| 400 | 171.7KB | **16.4KB** | −90.4% |
| 700 | 179.7KB | **16.8KB** | −90.6% |

170 glyphs: Latin letters and digits, the punctuation the design uses (→ ← ·
…, curly quotes), and accents for Dutch, French and Belgian names, café,
naïve, résumé all render. Verified in a browser, no missing-glyph boxes.

Takes any format: `.otf`, `.ttf` or `.woff2`.

## Why these are not bundled

Inlining as a `data:` URI was considered and rejected. Base64 inflates the
file by 33%, and because it lands in CSS it downloads for **everyone**:

|                            | Bundled as data: URI | Served from public/ |
| -------------------------- | -------------------- | ------------------- |
| Bytes added to every page  | 64KB                 | 0                   |
| Fetched when toggle is off | yes                  | **no**              |

`@font-face` is lazy by spec. A face is only fetched when something actually
uses it, and nothing does unless `[data-a11y-font="dyslexic"]` is set. That
was verified in a browser, not assumed: with the setting off, zero dyslexic
fonts are requested.

OpenDyslexic is OFL-1.1, so self-hosting and subsetting are both permitted.
