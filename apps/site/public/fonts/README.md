# Fonts

## opendyslexic-400.woff2 / opendyslexic-700.woff2

Not committed: drop your own files here. The accessibility menu's
"Dyslexia-friendly font" toggle looks for these two paths. Until they exist
the toggle is a no-op: `@font-face` fails to load and the browser falls
through to Hanken Grotesk, so nothing breaks.

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
| 400 | 112.6KB | **23.5KB** | −79.1% |
| 700 | 117.5KB | **23.9KB** | −79.7% |

169 glyphs: Latin letters and digits, the punctuation the design uses (→ ← ·
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
