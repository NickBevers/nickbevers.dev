/**
 * The /now page's cards. Hand-maintained: four short entries, edited whenever
 * they stop being true. A now page is only worth having if it is current.
 *
 * Bump NOW_UPDATED whenever you touch this list.
 */
export const NOW_UPDATED = new Date("2026-08-23");

export const NOW_ITEMS = [
  {
    kicker: "Where I am",
    meta: "Belgium",
    title: "Home, mostly",
    body: "Working from Antwerp at Spatie, with the occasional detour out of the city when the weather cooperates.",
  },
  {
    kicker: "Recently shipped",
    meta: "Aug 2026",
    title: "oklch-picker v1.2",
    body: "Clipping warnings and a proper keyboard mode. Small release, long overdue.",
  },
  {
    kicker: "Working on",
    meta: "Ongoing",
    title: "The finance tracker rewrite",
    body: "Placeholder. Swap this for what you are actually building.",
  },
  {
    kicker: "Learning",
    meta: "Ongoing",
    title: "Placeholder",
    body: "Reading, listening, currently obsessed with: your call. This card holds the shape.",
  },
] as const;
