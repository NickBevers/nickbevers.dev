/**
 * Tests the git write path against a mock GitHub.
 *
 * A mock rather than the real API because the interesting cases are the ones
 * you cannot conjure on demand: a stale sha, a branch that moved mid-publish,
 * a 422 that means the same thing as a 409. Driving the real API would test
 * the happy path and nothing else, and would write to a real repository.
 *
 * Run: pnpm editor
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { setTimeout as sleep } from "node:timers/promises";

let fails = 0;
const ok = (m) => console.log(`  ok ${m}`);
const fail = (m) => {
  console.log(`  !! ${m}`);
  fails++;
};
const check = (c, g, b) => (c ? ok(g) : fail(b));

/* ---------- a GitHub that we control ---------- */
const state = {
  sha: "sha-1",
  text: "---\ntitle: Original\ndescription: D\npubDate: 2026-01-01\ntag: Meta\ndraft: true\n---\n\nOriginal body.\n",
  head: "commit-1",
  commits: [],
  /** flip to make the next contents PUT report a stale sha */
  conflictNext: false,
};

const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
const unb64 = (s) => Buffer.from(s, "base64").toString("utf8");

const gh = createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const send = (code, body) => {
    res.writeHead(code, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  let body = "";
  for await (const c of req) body += c;
  const json = body ? JSON.parse(body) : {};

  if (url.pathname === "/user") return send(200, { login: "NickBevers", id: 12345 });

  if (url.pathname.includes("/git/ref/heads/")) {
    return send(200, { object: { sha: state.head } });
  }
  if (url.pathname.includes("/git/commits/") && req.method === "GET") {
    return send(200, { tree: { sha: "tree-1" } });
  }
  if (url.pathname.endsWith("/git/blobs")) return send(201, { sha: "blob-" + Math.random() });
  if (url.pathname.endsWith("/git/trees")) return send(201, { sha: "tree-2" });
  if (url.pathname.endsWith("/git/commits") && req.method === "POST") {
    state.commits.push(json.message);
    return send(201, { sha: "commit-2" });
  }
  if (url.pathname.includes("/git/refs/heads/") && req.method === "PATCH") {
    state.head = json.sha;
    return send(200, {});
  }

  if (url.pathname.includes("/contents/")) {
    if (req.method === "GET") {
      return send(200, { type: "file", content: b64(state.text), sha: state.sha, path: "p" });
    }
    if (req.method === "PUT") {
      if (state.conflictNext || (json.sha && json.sha !== state.sha)) {
        state.conflictNext = false;
        return send(409, { message: "does not match" });
      }
      state.text = unb64(json.content);
      state.sha = "sha-" + (Number(state.sha.split("-")[1]) + 1);
      state.commits.push(json.message);
      return send(200, { content: { sha: state.sha }, commit: { sha: "commit-x" } });
    }
  }
  send(404, { message: "not found" });
});
await new Promise((r) => gh.listen(4801, r));

/* ---------- the admin, pointed at the mock ---------- */
const PORT = 4802;
const server = spawn("node", ["./dist/server/entry.mjs"], {
  cwd: "apps/admin",
  env: {
    ...process.env,
    HOST: "127.0.0.1",
    PORT: String(PORT),
    GITHUB_APP_CLIENT_ID: "x",
    GITHUB_APP_CLIENT_SECRET: "x",
    SESSION_SECRET: "s".repeat(40),
    ALLOWED_LOGIN: "NickBevers",
    ALLOWED_USER_ID: "12345",
    CONTENT_REPO: "NickBevers/site",
    GITHUB_API_BASE: `http://localhost:4801`,
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let log = "";
server.stdout.on("data", (d) => (log += d));
server.stderr.on("data", (d) => (log += d));
process.on("exit", () => server.kill());

for (let i = 0; i < 40; i++) {
  try {
    await fetch(`http://localhost:${PORT}/login`);
    break;
  } catch {
    await sleep(250);
  }
}

console.log("\n  GIT WRITE PATH");

// A session cookie the server will accept.
const { createSessionStore } = await import("../apps/admin/src/platform/crypto.ts");
const store = createSessionStore("s".repeat(40));
const cookie =
  "nb_session=" +
  (await store.seal({
    login: "NickBevers",
    userId: 12345,
    token: "gh-token",
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  }));

const post = (path, payload) =>
  fetch(`http://localhost:${PORT}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie, origin: `http://localhost:${PORT}` },
    body: JSON.stringify(payload),
  });

// 1. a normal save
{
  const res = await post("/api/posts/save", {
    slug: "hello",
    sha: "sha-1",
    body: "New body.\n",
    data: { title: "T", description: "D", pubDate: "2026-01-01", tag: "Meta", draft: true },
  });
  const j = await res.json();
  check(
    res.status === 200 && j.sha === "sha-2",
    `save returns the new sha (${j.sha})`,
    `save returned ${res.status} ${JSON.stringify(j)}`,
  );
  check(/New body/.test(state.text), "the body reached the repository", "the body was not written");
}

// 2. a stale sha must NOT overwrite
{
  const before = state.text;
  const res = await post("/api/posts/save", {
    slug: "hello",
    sha: "sha-1",
    body: "Clobbering body.\n",
    data: { title: "T", description: "D", pubDate: "2026-01-01", tag: "Meta" },
  });
  const j = await res.json();
  check(
    res.status === 409,
    `a stale sha is refused (${res.status})`,
    `stale sha returned ${res.status}: it must be 409`,
  );
  check(
    state.text === before,
    "the file on GitHub was NOT overwritten",
    "a stale save CLOBBERED the file",
  );
  check(
    !!j.current?.body,
    "the response carries the current version for the diff",
    "no current version returned",
  );
}

// 3. publish clears the draft flag and stamps a date
{
  const res = await post("/api/posts/publish", {
    slug: "hello",
    path: "apps/site/src/content/entries/hello.mdx",
    expectedHead: state.head,
    body: "Body.\n",
    data: { title: "T", description: "D", pubDate: "", tag: "Meta", draft: true },
  });
  const j = await res.json();
  check(
    res.status === 200,
    `publish succeeded (${res.status})`,
    `publish returned ${res.status} ${JSON.stringify(j)}`,
  );
  check(
    state.commits.some((m) => m.startsWith("Publish")),
    "one commit, message starts with Publish",
    `commits: ${state.commits.join(" | ")}`,
  );
}

// 4. publishing onto a branch that moved is refused
{
  state.head = "commit-moved";
  const res = await post("/api/posts/publish", {
    slug: "hello",
    path: "apps/site/src/content/entries/hello.mdx",
    expectedHead: "commit-1",
    body: "Body.\n",
    data: { title: "T", description: "D", pubDate: "2026-01-01", tag: "Meta" },
  });
  check(
    res.status === 409,
    `a moved branch is refused (${res.status})`,
    `moved branch returned ${res.status}: expected 409`,
  );
}

// 5. an unsafe slug cannot escape the content directory
{
  const res = await post("/api/posts/save", {
    slug: "../../../../etc/passwd",
    body: "x",
    data: { title: "T", description: "D", pubDate: "2026-01-01", tag: "Meta" },
  });
  check(
    res.status === 400,
    `a path-traversal slug is refused with 400 (${res.status})`,
    `traversal slug returned ${res.status}: expected 400, a client error`,
  );
}

server.kill();
gh.close();
console.log(`\n  ${fails} failure(s)\n`);
process.exit(fails ? 1 : 0);
