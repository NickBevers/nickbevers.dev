# admin

The admin panel for nickbevers.dev. Hosted separately from the site.

## Running it

Copy `.env.example` to `.dev.vars` (Cloudflare) or `.env` (Node) and fill it in.

```
pnpm --filter admin dev          # workerd, the production runtime
pnpm --filter admin build        # Cloudflare Workers
pnpm --filter admin build:node   # Node. The Coolify path
```

## The GitHub App

A GitHub **App**, not an OAuth App. An OAuth App's `repo` scope grants write
to every repository the account can reach; a GitHub App is installed on one
repository with `contents: write`, and its user tokens expire in eight hours.

Create it at <https://github.com/settings/apps/new>:

- Callback URL: `https://your-admin-host/api/auth/callback`
- Request user authorization (OAuth) during installation: **on**
- Permissions → Repository → Contents: **Read and write**
- Install it on the content repository only

Then set the secrets. `ALLOWED_USER_ID` is the numeric id from
`https://api.github.com/users/NickBevers`: logins can be renamed and
re-registered by someone else, ids cannot, which is why both are checked.

## Why src/platform/ exists

Astro's adapter is one config line, but that only makes the host swappable if
no code reaches for a runtime API. `src/platform/` declares everything the app
needs from its host behind an interface, and oxlint refuses a Cloudflare
import anywhere else. CI builds both targets so the Node path cannot rot
unnoticed.

## Tests

`pnpm auth` builds the Node target, starts the real server, and drives the
auth boundary over HTTP: unauthenticated access, CSRF state, forged session
cookies, GET logout. It tests routes rather than functions because that is
what an attacker touches.
