import { defineConfig, envField } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import node from "@astrojs/node";

/**
 * The admin runs on Cloudflare Workers by default and on a plain Node server
 * when DEPLOY_TARGET=node. Which is the Coolify path.
 *
 * That swap is only real if no admin code imports a runtime-specific API.
 * src/platform/ is the seam that keeps it honest, and oxlint bans Cloudflare
 * imports outside it. CI builds BOTH targets so the Node path cannot rot.
 */
const useNode = process.env.DEPLOY_TARGET === "node";

export default defineConfig({
  // ADMIN_PREVIEW is read through import.meta.env because the Cloudflare
  // adapter's dev runtime (workerd) does not populate process.env from the
  // shell. envPrefix lets Vite expose this one non-PUBLIC_ variable.
  vite: { envPrefix: ["PUBLIC_", "ADMIN_"] },

  output: "server",
  adapter: useNode ? node({ mode: "standalone" }) : cloudflare({ imageService: "passthrough" }),

  // astro:env gives typed, validated secrets that resolve identically on both
  // adapters. Astro.locals.runtime.env was removed in v6, so this is also the
  // only portable way to read them.
  env: {
    schema: {
      GITHUB_APP_CLIENT_ID: envField.string({ context: "server", access: "secret" }),
      GITHUB_APP_CLIENT_SECRET: envField.string({ context: "server", access: "secret" }),
      /** Signs the session cookie. `openssl rand -base64 32`. */
      SESSION_SECRET: envField.string({ context: "server", access: "secret" }),
      /** The single GitHub login allowed in. */
      ALLOWED_LOGIN: envField.string({ context: "server", access: "secret" }),
      /** That account's numeric id. Logins can be renamed; ids cannot. */
      ALLOWED_USER_ID: envField.number({ context: "server", access: "secret" }),
      /** owner/repo the editor commits to. */
      CONTENT_REPO: envField.string({ context: "server", access: "secret" }),
      PUBLIC_SITE_URL: envField.string({
        context: "client",
        access: "public",
        default: "https://nickbevers.dev",
      }),
    },
  },
});
