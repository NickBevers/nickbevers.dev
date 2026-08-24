import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

/**
 * Entries are the logbook. Numbered like a logbook too (No. 047), descending
 * from the newest. The number is derived at read time from publication order,
 * not stored, so it can never drift from reality.
 */
const entries = defineCollection({
  loader: glob({ base: "./src/content/entries", pattern: "**/*.{md,mdx}" }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string().max(90),
        description: z.string().max(200),
        pubDate: z.coerce.date(),
        updatedDate: z.coerce.date().optional(),
        tag: z.string(),
        draft: z.boolean().default(false),
        /** Marks scaffolding so it can be filtered or badged, never mistaken for real writing. */
        placeholder: z.boolean().default(false),
        cover: image().optional(),
        coverAlt: z.string().optional(),
        /** Optional "mentioned in this entry" card at the foot of the post. */
        mentions: z
          .object({
            name: z.string(),
            blurb: z.string(),
            href: z.string().url(),
            cta: z.string().optional(),
          })
          .optional(),
      })
      // An image without a text alternative is a build failure, not a warning.
      // This is the cheapest possible place to enforce it: the admin panel
      // physically cannot commit an inaccessible post.
      .refine((d) => !d.cover || d.coverAlt, {
        message: "coverAlt is required whenever cover is set",
        path: ["coverAlt"],
      }),
});

/** Off-the-clock cards. Same shape, different section: deliberately not entries. */
const life = defineCollection({
  loader: glob({ base: "./src/content/life", pattern: "**/*.{md,mdx}" }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string().max(90),
        kicker: z.string(),
        blurb: z.string().max(200),
        pubDate: z.coerce.date(),
        draft: z.boolean().default(false),
        placeholder: z.boolean().default(false),
        photo: image().optional(),
        photoAlt: z.string().optional(),
        /** Shown inside the empty frame when no photo exists yet. */
        photoPrompt: z.string().default("Photo to come"),
      })
      .refine((d) => !d.photo || d.photoAlt, {
        message: "photoAlt is required whenever photo is set",
        path: ["photoAlt"],
      }),
});

/**
 * Things I've built. A collection rather than a hand-written array because
 * every project now has a detail page, so it needs a body.
 *
 * `order` drives both the displayed number and the sort, so the numbering
 * on the home page cannot drift from the order things actually appear in.
 * `href` is the project's home on the web, if it has one: it is a field on
 * the detail page, not the row's link target, so every row goes to the
 * detail page and nothing looks clickable without being clickable.
 */
const work = defineCollection({
  loader: glob({ base: "./src/content/work", pattern: "**/*.{md,mdx}" }),
  schema: () =>
    z.object({
      name: z.string().max(90),
      year: z.string(),
      status: z.string(),
      blurb: z.string().max(200),
      order: z.number().int().positive(),
      href: z.string().url().optional(),
      repo: z.string().url().optional(),
      draft: z.boolean().default(false),
      placeholder: z.boolean().default(false),
    }),
});

export const collections = { entries, life, work };
