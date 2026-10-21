# nickbevers.dev

A blank, hand-written Astro frontend and a separate Payload CMS. Both apps target Vercel. Production data lives in Neon; image files live in Hetzner S3. Image processing runs in a separate local / CI worker, with no paid image CDN or Vercel image transformation service.

## Frontend development

Node 24 and pnpm **12.14.0** are pinned. From the workspace root:

```sh
corepack pnpm install
corepack pnpm setup
corepack pnpm dev:web
```

Open http://localhost:4321. You can work on the frontend without running the CMS. `setup` creates ignored `.env` files and a random Payload secret, preserving existing files.

```text
apps/web/
  public/          Static files served as-is
  src/
    assets/        Images imported into Astro
    components/    Reusable UI, including CmsImage.astro
    layouts/       BaseLayout.astro is the document shell
    lib/           CMS and responsive image helpers
    pages/         File-based routes; index.astro starts blank
    styles/        Global CSS; keep component styles in .astro files

apps/cms/
  src/
    app/           Payload admin and REST routes
    collections/   Users and Media; add content models when needed
    lib/           Worker image processing
    migrations/    Initial Postgres schema
    payload.config.ts
  scripts/         Separate image worker
  tests/           Isolated upload and image processing tests
```

Use `@/` imports inside either app. Astro builds static pages, with no React runtime or CMS SDK on the website. The admin currently uses Payload's default appearance; its styling can follow the completed frontend later.

## Local CMS

```sh
pnpm db:up       # Isolated Postgres container on port 54329
pnpm dev         # Website :4321 and CMS :3000
```

Visit http://localhost:3000/admin to create your account. The default environment uses local Postgres and local uploads. Alternatively, point `apps/cms/.env` at a Neon development branch. Development automatically synchronizes schema changes; keep production and preview databases separate from development.

After uploading images, run `pnpm media:process`, or keep `pnpm media:watch` running in another terminal to process pending uploads every five seconds. Local variants are served from the ignored `apps/web/public/media` directory.

## Commands

| Command                                               | Purpose                                                          |
| ----------------------------------------------------- | ---------------------------------------------------------------- |
| `pnpm dev:web` / `pnpm dev:cms`                       | Start one app                                                    |
| `pnpm format`                                         | Oxfmt for general files; Prettier + Astro plugin for `.astro`    |
| `pnpm lint` / `pnpm lint:fix`                         | Oxlint for JS/TS/TSX, with React and accessibility rules for TSX |
| `pnpm check`                                          | Formatting, linting, and type checks for both apps               |
| `pnpm test`                                           | Preview generation and the upload / worker pipeline              |
| `pnpm build`                                          | Production builds for both apps                                  |
| `pnpm cms:types`                                      | Regenerate types after changing collections                      |
| `pnpm --filter @site/cms payload migrate:create name` | Generate a Postgres migration                                    |
| `pnpm cms:migrate`                                    | Apply migrations to the configured database                      |
| `pnpm db:down`                                        | Stop local Postgres, preserving its data volume                  |

VS Code recommendations and format-on-save settings are included.

## Images

The CMS stores the unmodified original and marks it `pending`. The separate worker creates an inline **16 × 16 WebP preview**, plus WebP (quality 78) and AVIF (quality 55, effort 2) variants at 480, 780, 1280, 1920, and 2400 pixels, and at the source's own width when it is smaller. Small sources are never upscaled. Only fully opaque images get the preview, because it would show through transparent areas. Original files are retained, and generated files use content hashes with immutable cache headers.

`CmsImage` uses native `srcset` / `sizes` selection: a 390px slot can use the 480px variant at 1×, 780px at 2×, or 1280px at 3×. It never uses the unprocessed original as its fallback. The preview is embedded in the HTML, dimensions prevent layout shifts, and normal images lazy-load. Use `priority` only for above-the-fold / LCP images.

```astro
---
import CmsImage from '@/components/CmsImage.astro';
import { getMedia } from '@/lib/cms';

const image = await getMedia(1);
---

<CmsImage media={image} sizes="(max-width: 800px) 100vw, 800px" priority />
```

Set `sizes` to the image's actual layout width. Use `alt=""` for decorative images. An image that is not processed yet renders as an empty box at its final size, and the build logs a warning instead of failing. CMS content is fetched from Astro frontmatter at build time, so publishing changes requires a frontend rebuild.

## Vercel, Neon, and Hetzner

Create **two Vercel projects** from this repository, with root directories `apps/web` and `apps/cms`. Enable access to files outside each project's root directory so Vercel can install the workspace. Each app includes `vercel.json`. No Astro server adapter is needed for the static frontend.

For the CMS project, connect Neon through Vercel and provide its pooled `DATABASE_URL` (or `POSTGRES_URL`), a persistent `PAYLOAD_SECRET`, and the S3 variables from `apps/cms/.env.example`. Set `CMS_PUBLIC_URL` and `WEB_URL` to your HTTPS domains. For migrations, use Neon's direct / unpooled connection string and run `pnpm cms:migrate` before deploying schema changes. The initial migration is included. Use a separate Neon branch for Vercel previews.

For the frontend project, set `CMS_URL` to your deployed CMS origin. Only the CMS needs database credentials.

Set Hetzner's endpoint and region to your bucket location. `S3_PUBLIC_URL` is the bucket's public base URL, such as `https://your-bucket.fsn1.your-objectstorage.com`. Objects use the `media/originals` and `media/variants` prefixes. Make the website's media objects publicly readable, and apply the CORS policy in `apps/cms/s3-cors.example.json` with your actual admin origins. Original uploads go directly from the admin browser to S3, bypassing Vercel's function upload-size limit. The CMS does no resizing or encoding.

Each new or replaced upload starts the **Process uploaded images** GitHub Actions workflow when the CMS has `GITHUB_DISPATCH_TOKEN`. Use a fine-grained token for this repository with only the **Actions: write** permission. A burst of uploads folds into one run, and a failed trigger never blocks the upload. Without the token, start the workflow by hand or run the worker on your computer with the production CMS environment. The workflow needs the CMS's Neon connection, Payload secret, and S3 variables as repository secrets. Standard runners are free for public repositories, so this uses no Actions minutes while the repository stays public. `pnpm --filter @site/cms media:process --retry-failed` retries failed uploads. Each invocation processes up to 100 images.

Optionally set `WEB_DEPLOY_HOOK` in the worker environment to trigger a frontend deployment after processing. Otherwise, redeploy the frontend manually. New uploads stay pending until a worker runs. Configure an email adapter before relying on admin password-reset emails; development email currently goes to the console.
