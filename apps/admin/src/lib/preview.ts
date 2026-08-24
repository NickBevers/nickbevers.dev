import type { SessionPayload } from "@/platform";
import type { Frontmatter } from "./frontmatter";

export const PREVIEW = import.meta.env.DEV && import.meta.env.ADMIN_PREVIEW === "1";

export const previewSession: SessionPayload = {
  login: "preview",
  userId: 0,
  // Not a credential
  token: "preview-no-token",
  expiresAt: Math.floor(Date.now() / 1000) + 86400,
};

interface Fixture {
  slug: string;
  path: string;
  sha: string;
  data: Partial<Frontmatter>;
  body: string;
}

/** Enough shapes to see the UI honestly: published, draft, long, and short. */
const FIXTURES: Fixture[] = [
  {
    slug: "picking-colours-in-oklch",
    path: "apps/site/src/content/entries/picking-colours-in-oklch.mdx",
    sha: "fixture-1",
    data: {
      title: "Picking colours in OKLCH, and why I stopped guessing at hex",
      description:
        "A short tour of the colour space that finally made my palettes behave, and the small package I wrote to stop switching tabs.",
      pubDate: "2026-08-12",
      tag: "CSS",
      draft: false,
    },
    body: `For years I picked colours the way most people do: open the picker, drag until
it looks right, copy the hex, move on. That works until you need a scale.

## The three numbers

Every OKLCH colour is lightness, chroma and hue. That is it.
`,
  },
  {
    slug: "a-draft-in-progress",
    path: "apps/site/src/content/entries/a-draft-in-progress.mdx",
    sha: "fixture-2",
    data: {
      title: "A draft in progress",
      description: "Unpublished, so the list can show what a draft looks like.",
      pubDate: "2026-08-20",
      tag: "Process",
      draft: true,
    },
    body: "Half a thought, saved but not published.\n",
  },
  {
    slug: "two-weeks-off-the-internet",
    path: "apps/site/src/content/entries/two-weeks-off-the-internet.mdx",
    sha: "fixture-3",
    data: {
      title: "Two weeks off the internet in the Ardennes",
      description:
        "No signal, one paper map, and a surprising amount of rain. What a fortnight without a screen did to my attention span.",
      pubDate: "2026-07-24",
      tag: "Personal",
      draft: false,
    },
    body: "No signal, one paper map, and a surprising amount of rain.\n",
  },
];

let store = structuredClone(FIXTURES);
let shaCounter = 100;

export const previewList = () => store.map((f) => ({ slug: f.slug, path: f.path, sha: f.sha }));

export const previewLoad = (slug: string) => store.find((f) => f.slug === slug) ?? null;

export function previewSave(opts: {
  slug: string;
  data: Partial<Frontmatter>;
  body: string;
  sha?: string;
}) {
  const existing = store.find((f) => f.slug === opts.slug);

  if (existing && opts.sha && opts.sha !== existing.sha) {
    // Same shape the real client throws, so the conflict UI can be exercised.
    return { conflict: true as const, current: existing };
  }

  const sha = `fixture-${++shaCounter}`;
  if (existing) {
    Object.assign(existing, { data: opts.data, body: opts.body, sha });
  } else {
    store.push({
      slug: opts.slug,
      path: `apps/site/src/content/entries/${opts.slug}.mdx`,
      sha,
      data: opts.data,
      body: opts.body,
    });
  }
  return { conflict: false as const, sha, commit: `preview-${shaCounter}` };
}

/** Force the next save of this slug to conflict, to exercise the diff UI. */
export function previewForceConflict(slug: string) {
  const f = store.find((x) => x.slug === slug);
  if (f) f.sha = `fixture-${++shaCounter}`;
}

export const previewReset = () => {
  store = structuredClone(FIXTURES);
  shaCounter = 100;
};

export const previewHead = () => "preview-head";

// Generic collection fixtures, keyed by collection
interface GenericFixture {
  slug: string;
  path: string;
  sha: string;
  data: Record<string, unknown>;
  body: string;
}

const GENERIC: Record<string, GenericFixture[]> = {
  work: [
    {
      slug: "oklch-picker",
      path: "apps/site/src/content/work/oklch-picker.md",
      sha: "work-1",
      data: {
        name: "oklch-picker",
        year: "2026",
        status: "MIT · open source",
        blurb: "A colour picker built around OKLCH.",
        order: 1,
        href: "https://github.com/NickBevers",
      },
      body: "Most colour pickers still think in hex.\n",
    },
  ],
  life: [
    {
      slug: "placeholder",
      path: "apps/site/src/content/life/placeholder.md",
      sha: "life-1",
      data: {
        title: "A placeholder, waiting on a photo",
        kicker: "Off the clock",
        blurb: "The empty frame is the point.",
        pubDate: "2026-08-23",
        placeholder: true,
      },
      body: "",
    },
  ],
};

let genericStore: Record<string, GenericFixture[]> = structuredClone(GENERIC);

export const previewListItems = (key: string) =>
  (genericStore[key] ?? []).map((f) => ({ slug: f.slug, path: f.path, sha: f.sha }));

export const previewLoadItem = (key: string, slug: string) =>
  (genericStore[key] ?? []).find((f) => f.slug === slug) ?? null;

export function previewSaveItem(
  key: string,
  opts: {
    slug: string;
    data: Record<string, unknown>;
    body: string;
    sha?: string;
    dir: string;
    ext: string;
  },
) {
  const list = (genericStore[key] ??= []);
  const existing = list.find((f) => f.slug === opts.slug);
  if (existing && opts.sha && opts.sha !== existing.sha) {
    return { conflict: true as const, current: existing };
  }
  const sha = `${key}-${++shaCounter}`;
  if (existing) Object.assign(existing, { data: opts.data, body: opts.body, sha });
  else
    list.push({
      slug: opts.slug,
      path: `${opts.dir}/${opts.slug}${opts.ext}`,
      sha,
      data: opts.data,
      body: opts.body,
    });
  return { conflict: false as const, sha, commit: `preview-${shaCounter}` };
}
