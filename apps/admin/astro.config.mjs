import { defineConfig, envField } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import node from "@astrojs/node";

const useNode = process.env.DEPLOY_TARGET === "node";

export default defineConfig({
  vite: { envPrefix: ["PUBLIC_", "ADMIN_"] },

  output: "server",
  adapter: useNode ? node({ mode: "standalone" }) : cloudflare({ imageService: "passthrough" }),

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
