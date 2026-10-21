# To do

## Automatic image processing

Until these are done, uploads stay `pending` until you run the worker yourself.

- [ ] Create a fine-grained personal access token on GitHub. Limit it to `NickBevers/nickbevers.dev`, with only **Actions: Read and write**.
- [ ] Add it to the CMS project on Vercel as `GITHUB_DISPATCH_TOKEN`.
- [ ] Note the token's expiry date somewhere you will see it. Once it expires, the trigger fails quietly and uploads stay pending. The failure only shows in the CMS logs.
- [ ] Add these repository secrets for the **Process uploaded images** workflow: `DATABASE_URL`, `PAYLOAD_SECRET`, `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL`, and optionally `WEB_DEPLOY_HOOK`.
- [ ] Add `GITHUB_DISPATCH_TOKEN=` to `apps/cms/.env.example`.
- [ ] Upload one image in production and check that a workflow run starts.

The runs only stay free while the repository is public.

## First deploy

- [ ] Run `pnpm cms:migrate` against Neon's direct connection before the first CMS deploy. It creates the whole schema in one migration.
- [ ] Drop the local `nickbevers_migration_check` database if the old initial migration ran there. It no longer matches the migration files.

## Open from earlier

- [ ] Set the crop preview ratios in `apps/cms/src/lib/crops.ts` to the site's real slots. Card 16:9, Square 1:1 and Portrait 4:5 are placeholders.
- [ ] Give `CmsImage` a `ratio` prop that uses the focal point (`object-fit: cover` and `object-position`). Until then the site ignores the point.
- [ ] Replace the default description in `apps/web/src/layouts/Seo.astro` with your own wording.
- [ ] Remove the spaced hyphen from the OG image's title bar (`NICKBEVERS.DEV - A PERSONAL SITE`) in the design file.
- [ ] Move `apps/web/public/fonts/README.md` out of `public/`. Everything in `public/` is published.
- [ ] Run `pnpm format` for `apps/web/src/styles/a11y.css`. It uses double quotes.
