# nickbevers.dev

My personal site and logbook, plus a small admin that edits it.

Astro with modular CSS. No framework, no Tailwind, no database. Content is
Markdown in this repository, and the admin commits to it through the GitHub
API.

## What is here

```
apps/site      the public site
apps/admin     the editor, deployed separately behind GitHub auth
packages/ui    components shared by both
packages/tokens  colour, type and spacing tokens
scripts/       the verification gates
```

## Running it

Needs Node 22.12 or newer and pnpm.

```sh
pnpm install
pnpm --filter site dev      # the site on :4321
pnpm admin:ui               # the admin with fixtures, no GitHub login needed
```

The admin normally requires a GitHub App and a login allowlist. Copy
`apps/admin/.env.example` and fill it in for that. `pnpm admin:ui` skips all of
it and serves fixtures instead, which is enough for working on the interface.

## Verification

```sh
pnpm verify     # fifteen gates, about a minute
pnpm lh         # Lighthouse, separate because it is slower
```

The gates are the interesting part of this repository. They cover lint, house
style, dead scoped styles, spaces the compiler silently drops, content
structure, colour contrast in both themes with the scanline composited in,
frontmatter round-tripping, markdown escaping, per-page weight budgets,
structural accessibility, and four behavioural suites driven in a real
browser.

Each one exists because something broke. Each was proven to fail when its bug
is put back, because a check that has never failed is not a check.

## Accessibility

Targeted at WCAG 2.2 AA, enforced at build time rather than audited
afterwards.

The skip menu offers section navigation and opens from anywhere with `Alt+/`.
Display settings live at `Alt+D`: a dyslexia-friendly face, scanlines off,
reduced motion, always-underlined links, and root font size.

Every colour pair is measured against both the plain background and the
scanlined one. The overlay changes the ratio, so checking the raw token would
pass combinations that fail on screen.

## Use

Public to read, not licensed for reuse. Default copyright applies to the code,
the writing and the design alike. Ask me if you want to use something.
