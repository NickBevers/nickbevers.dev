---
name: "oklch-picker"
year: "2026"
status: "MIT · open source"
blurb: "A colour picker built around OKLCH. Paste a colour, get an honest scale, see what clips before you ship it."
order: 1
href: "https://github.com/NickBevers"
repo: "https://github.com/NickBevers"
---

Most colour pickers still think in hex and HSL, which means they will happily
hand you a scale that looks even on screen and falls apart the moment it meets
a wider gamut. OKLCH fixes the maths. This is a picker built on it.

## What it does

Paste a colour and it gives you a scale that is perceptually even, so the steps
between shades actually look like steps. It also tells you what clips before you
ship it, rather than after someone opens the page on a display you did not test.

## Why I built it

I kept doing the same conversion by hand while building this site's own palette,
and hand-checking contrast against a spec every time I nudged a value. The
contrast gate in this repo came out of the same frustration.
