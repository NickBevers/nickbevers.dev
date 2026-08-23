/**
 * Auth boundary tests for the admin.
 *
 * Runs the real Node build behind a real HTTP server and drives it with fetch.
 * The value here is that it tests what an attacker actually touches: routes
 * and cookies: rather than the functions in isolation, which is where an
 * auth bug hides.
 *
 * Run: pnpm auth
 */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = 4501;
const BASE = `http://localhost:${PORT}`;

let fails = 0;
const ok = (m) => console.log(`  ok ${m}`);
const fail = (m) => {
  console.log(`  !! ${m}`);
  fails++;
};
const check = (c, good, bad) => (c ? ok(good) : fail(bad));

const server = spawn("node", ["./dist/server/entry.mjs"], {
  cwd: "apps/admin",
  env: {
    ...process.env,
    HOST: "127.0.0.1",
    PORT: String(PORT),
    GITHUB_APP_CLIENT_ID: "Iv1.test",
    GITHUB_APP_CLIENT_SECRET: "test-secret",
    SESSION_SECRET: "test-session-secret-at-least-32-bytes-long",
    ALLOWED_LOGIN: "NickBevers",
    ALLOWED_USER_ID: "12345",
    CONTENT_REPO: "NickBevers/nickbevers.dev",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let boot = "";
server.stdout.on("data", (d) => (boot += d));
server.stderr.on("data", (d) => (boot += d));

const stop = () => server.kill("SIGTERM");
process.on("exit", stop);

// wait for it to listen
let up = false;
for (let i = 0; i < 40; i++) {
  try {
    await fetch(`${BASE}/login`, { redirect: "manual" });
    up = true;
    break;
  } catch {
    await sleep(250);
  }
}
if (!up) {
  console.error("  server never came up:\n" + boot);
  process.exit(1);
}

console.log("\n  AUTH BOUNDARY");

// 1. protected pages redirect to login
for (const path of ["/", "/posts/", "/components/", "/tokens/", "/health/"]) {
  const res = await fetch(BASE + path, { redirect: "manual" });
  const loc = res.headers.get("location") ?? "";
  check(
    res.status === 302 && loc.startsWith("/login"),
    `${path} → login (${res.status})`,
    `${path} returned ${res.status} ${loc}: expected a redirect to /login`,
  );
}

// 2. protected API routes answer 401, not a redirect
{
  // 401 from our middleware, or 403 from Astro's own cross-origin CSRF check
  // (which fires first for a bodyless POST). Either is a refusal; what must
  // never happen is a 2xx.
  const res = await fetch(`${BASE}/api/posts/save`, { method: "POST", redirect: "manual" });
  check(
    res.status === 401 || res.status === 403 || res.status === 404,
    `unauthenticated API refused (${res.status})`,
    `unauthenticated API returned ${res.status}: it must not succeed`,
  );
}

// 3. the login page itself is reachable
{
  const res = await fetch(`${BASE}/login`);
  check(res.status === 200, "login page is public", `login page returned ${res.status}`);
}

// 4. starting OAuth sets a state cookie and redirects to GitHub
let stateCookie = "";
{
  const res = await fetch(`${BASE}/api/auth/start`, { redirect: "manual" });
  const loc = res.headers.get("location") ?? "";
  const setCookie = res.headers.get("set-cookie") ?? "";
  stateCookie = setCookie.split(";")[0] ?? "";
  check(
    res.status === 302 && loc.startsWith("https://github.com/login/oauth/authorize"),
    "auth start → github authorize",
    `auth start returned ${res.status} ${loc}`,
  );
  check(/state=/.test(loc), "authorize url carries a state", "authorize url has no state");
  check(/nb_state/.test(setCookie), "state stored in a cookie", `no state cookie: ${setCookie}`);
  check(/HttpOnly/i.test(setCookie), "state cookie is httpOnly", "state cookie is not httpOnly");
}

// 5. callback with no state is rejected (CSRF)
{
  const res = await fetch(`${BASE}/api/auth/callback?code=abc&state=forged`, {
    redirect: "manual",
  });
  const loc = res.headers.get("location") ?? "";
  check(
    res.status === 302 && loc.startsWith("/login?error="),
    "callback without a matching state is refused",
    `callback returned ${res.status} ${loc}`,
  );
}

// 6. callback with a MISMATCHED state is rejected even when a cookie exists
{
  const res = await fetch(`${BASE}/api/auth/callback?code=abc&state=not-the-one`, {
    headers: { cookie: stateCookie },
    redirect: "manual",
  });
  const loc = res.headers.get("location") ?? "";
  check(
    loc.startsWith("/login?error="),
    "callback with a mismatched state is refused",
    `mismatched state was accepted: ${loc}`,
  );
}

// 7. a forged session cookie must not authenticate
{
  const forged = Buffer.from(
    JSON.stringify({ login: "attacker", userId: 999, token: "x", expiresAt: 9e9 }),
  ).toString("base64url");
  const res = await fetch(BASE, {
    headers: { cookie: `nb_session=${forged}.deadbeef` },
    redirect: "manual",
  });
  check(
    res.status === 302 && (res.headers.get("location") ?? "").startsWith("/login"),
    "a forged session cookie is rejected",
    "a forged session cookie was ACCEPTED: signature check is broken",
  );
}

// 8. logout must not be a GET
{
  // Must never clear a session on GET: a logout that works from an <img src>
  // is a CSRF hole. 405 is the route's own answer; 401 means middleware
  // caught it first. Both refuse.
  const res = await fetch(`${BASE}/api/auth/logout`, { redirect: "manual" });
  check(
    res.status === 405 || res.status === 401,
    `GET logout refused (${res.status})`,
    `GET logout returned ${res.status}: a GET logout is CSRF-able`,
  );
}

// 9. admin pages must not be indexable
{
  const res = await fetch(`${BASE}/login`);
  const html = await res.text();
  check(/noindex/.test(html), "admin is noindex", "admin pages are missing a noindex directive");
}

stop();
console.log(`\n  ${fails} failure(s)\n`);
process.exit(fails ? 1 : 0);
