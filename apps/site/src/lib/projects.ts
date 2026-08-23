/**
 * Projects are hand-maintained here rather than a content collection: there
 * are two of them, they have no body copy, and a collection would add a
 * schema and a loader to hold four fields.
 */
export const PROJECTS = [
  {
    index: "01",
    name: "oklch-picker",
    year: "2026",
    status: "MIT · open source",
    blurb:
      "A colour picker built around OKLCH. Paste a colour, get an honest scale, see what clips before you ship it.",
    href: "https://github.com/NickBevers",
  },
  {
    index: "02",
    name: "Personal finance tracker",
    year: "2025",
    status: "Side project",
    blurb:
      "Where the money actually goes, without handing a third party my bank login. Built for one very specific user: me.",
  },
] as const;
