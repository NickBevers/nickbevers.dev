import { getCollection, type CollectionEntry } from "astro:content";

export type Entry = CollectionEntry<"entries">;
export type Life = CollectionEntry<"life">;

/** Drafts render in dev so you can preview them; production never sees them. */
const visible = <T extends { data: { draft: boolean } }>(e: T) =>
  import.meta.env.PROD ? !e.data.draft : true;

const byNewest = (a: { data: { pubDate: Date } }, b: { data: { pubDate: Date } }) =>
  b.data.pubDate.getTime() - a.data.pubDate.getTime();

/**
 * Entries, newest first, each carrying its logbook number.
 *
 * The number counts up from the oldest post, so the newest always holds the
 * highest. Deriving it here rather than storing it in frontmatter means
 * deleting or backdating a post renumbers the set automatically.
 */
export async function getEntries() {
  const all = (await getCollection("entries")).filter(visible).toSorted(byNewest);
  const total = all.length;
  return all.map((entry, i) => ({
    entry,
    number: `No. ${String(total - i).padStart(3, "0")}`,
    href: `/writing/${entry.id}/`,
  }));
}

export type NumberedEntry = Awaited<ReturnType<typeof getEntries>>[number];

export async function getLife() {
  return (await getCollection("life")).filter(visible).toSorted(byNewest);
}

/** Previous and next in reading order, for the entry footer. */
export function neighbours(list: NumberedEntry[], id: string) {
  const i = list.findIndex((e) => e.entry.id === id);
  return {
    newer: i > 0 ? list[i - 1] : undefined,
    older: i >= 0 && i < list.length - 1 ? list[i + 1] : undefined,
  };
}

/** Tag list with counts, "All" first, the rest by frequency then name. */
export function tagsOf(list: NumberedEntry[]) {
  const counts = new Map<string, number>();
  for (const { entry } of list) counts.set(entry.data.tag, (counts.get(entry.data.tag) ?? 0) + 1);
  const rest = [...counts.entries()]
    .toSorted(([an, ac], [bn, bc]) => bc - ac || an.localeCompare(bn))
    .map(([name, count]) => ({ name, count }));
  return [{ name: "All", count: list.length }, ...rest];
}

/** 12 Aug 2026. The brand's date format, always tabular. */
export function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Reading time from rendered body text, at 220wpm. */
export function readingTime(body: string) {
  const words = body.trim().split(/\s+/).length;
  return `${Math.max(1, Math.round(words / 220))} min`;
}
