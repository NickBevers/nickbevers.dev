import rss from "@astrojs/rss";
import type { APIRoute } from "astro";
import { getEntries } from "../lib/collections";
import { SITE } from "../lib/nav";

export const GET: APIRoute = async (context) => {
  const entries = await getEntries();
  return rss({
    title: `${SITE.title} · the logbook`,
    description: SITE.description,
    site: context.site!,
    items: entries.map(({ entry, href }) => ({
      title: entry.data.title,
      description: entry.data.description,
      pubDate: entry.data.pubDate,
      link: href,
      categories: [entry.data.tag],
    })),
    customData: "<language>en</language>",
    // Points feed readers at the styled page rather than raw XML.
    stylesheet: "/rss.xsl",
  });
};
