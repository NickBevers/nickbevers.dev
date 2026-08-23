/**
 * UI preview mode: run the admin without GitHub, for working on the interface.
 *
 * Two independent guards, both of which must hold:
 *
 *   1. import.meta.env.DEV: true only under `astro dev`. A production build
 *      folds it to false, so PREVIEW is a compile-time constant `false` there
 *      and every guarded branch is unreachable. The module still appears in
 *      the bundle, but setting ADMIN_PREVIEW=1 against a built server changes
 *      nothing: verified: it still redirects to /login.
 *   2. ADMIN_PREVIEW=1 in the environment, so `pnpm dev` on its own still
 *      exercises the real auth path, and the bypass is always deliberate.
 *      Read through import.meta.env, not process.env: the Cloudflare adapter
 *      runs dev in workerd, where process.env is not populated from the
 *      shell. Vite exposes it via envPrefix in astro.config.
 *
 * When active the middleware injects a fake session and every GitHub call is
 * served from the fixtures below. Nothing reaches the network, and no token
 * exists to leak.
 */
import type { SessionPayload } from "@/platform";
import type { Frontmatter } from "./frontmatter";

export const PREVIEW = import.meta.env.DEV && import.meta.env.ADMIN_PREVIEW === "1";

export const previewSession: SessionPayload = {
  login: "preview",
  userId: 0,
  // Not a credential. Any request carrying it is intercepted before it
  // reaches fetch(), and PREVIEW is false in every build.
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

/* A mutable copy, so saving in preview behaves like saving: the list updates,
   the sha advances, and a second save with the old sha conflicts exactly as
   it would against GitHub. */
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
