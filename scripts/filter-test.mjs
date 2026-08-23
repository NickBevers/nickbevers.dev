/**
 * Behavioural test for the tag filter island. Checks the things that make it
 * an accessible progressive enhancement rather than merely a working widget:
 * no-JS completeness, live-region announcements, focus retention, URL sync
 * and deep links.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
};
const server = createServer((q, r) => {
  let p = join("apps/site/dist", decodeURIComponent(q.url.split("?")[0]));
  if (p.endsWith("/")) p += "index.html";
  if (!existsSync(p)) {
    r.writeHead(404);
    return r.end("nf");
  }
  r.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
  r.end(readFileSync(p));
});
const PORT = 4321;
const BASE = `http://localhost:${PORT}`;
/* Bind explicitly and fail loudly. Listening on a port another process
   already holds silently tests THAT server instead. Which produced a run
   where the accessibility suite graded the admin panel and reported the
   site's skip link as missing. */
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`
  port ${PORT} is already in use: stop whatever is on it and re-run
`);
    process.exit(1);
  }
  throw err;
});
/* A dev server on ::1 and a test server on 0.0.0.0 can BOTH hold this port:
   listen() succeeds and the browser then reaches whichever the resolver
   prefers. That produced a run where this suite silently graded the admin
   panel and reported the site's skip link as missing. Probe before binding. */
try {
  const res = await fetch(BASE, { signal: AbortSignal.timeout(1500) });
  const who = (await res.text()).match(/<title>([^<]*)/)?.[1] ?? "unknown";
  console.error(`\n  Something already answers on port ${PORT}: "${who}".`);
  console.error("  Stop it and re-run, or these tests grade the wrong server.\n");
  process.exit(1);
} catch (err) {
  if (err?.name === "TypeError" && !/fetch failed/i.test(String(err))) throw err;
}

await new Promise((r) => server.listen(PORT, r));

let fails = 0;
const fail = (m) => {
  console.log(`  !! ${m}`);
  fails++;
};
const ok = (m) => console.log(`  ok ${m}`);
const check = (cond, good, bad) => {
  if (cond) ok(good);
  else fail(bad);
};

const browser = await chromium.launch();

// ---- 1. JS DISABLED: every entry must still be present and readable ----
{
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/writing/`, { waitUntil: "domcontentloaded" });
  const total = await p.locator("[data-entry]").count();
  const visible = await p.locator("[data-entry]:not([hidden])").count();
  check(
    total > 0 && total === visible,
    `no-JS: all ${total} entries server-rendered and visible`,
    `no-JS: ${visible}/${total} visible`,
  );

  const hrefs = await p
    .locator("nav[aria-label='Pagination'] a")
    .evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  check(
    hrefs.every((h) => h && h !== "#"),
    `no-JS: pagination uses real hrefs${hrefs.length ? ` (${hrefs.length})` : " (single page)"}`,
    `no-JS: placeholder hrefs: ${hrefs.join(", ")}`,
  );
  await ctx.close();
}

// ---- 2. JS ENABLED ----
const ctx = await browser.newContext();
const p = await ctx.newPage();
await p.goto(`${BASE}/writing/`, { waitUntil: "networkidle" });
await p.waitForSelector("[aria-pressed]", { timeout: 5000 }).catch(() => {});

const buttons = p.locator("fieldset button");
const n = await buttons.count();
check(n > 1, `filter hydrated with ${n} tags`, `filter did not hydrate (${n} buttons)`);

// Accessible names must read cleanly and agree in number. A bare numeral
// beside the label produces "Frontend 2"; "1 entries" is simply wrong.
const names = await p
  .locator("fieldset button")
  .evaluateAll((bs) => bs.map((b) => b.getAttribute("aria-label") || b.textContent.trim()));
check(
  names.every((x) => /^[\w ]+, \d+ (entry|entries)$/.test(x)),
  `button names read cleanly (${names.join(" / ")})`,
  `malformed button names: ${names.join(" / ")}`,
);
check(
  !names.some((x) => /\b1 entries\b/.test(x)),
  "singular agreement in button names",
  `"1 entries" in: ${names.join(" / ")}`,
);

const initial = ((await p.locator("output").textContent()) ?? "").trim();
check(initial === "", "live region silent on load", `announced on load: "${initial}"`);

const target = "Frontend";
const btn = p.locator("fieldset button", { hasText: target }).first();
await btn.click();
await p.waitForTimeout(150);

const shown = await p.locator("[data-entry]:not([hidden])").count();
const hidden = await p.locator("[data-entry][hidden]").count();
check(
  shown === 2 && hidden === 1,
  `filtering "${target}": ${shown} shown, ${hidden} hidden`,
  `filtering "${target}": ${shown}/${hidden}, expected 2/1`,
);

const msg = ((await p.locator("output").textContent()) ?? "").trim();
check(
  msg === `${shown} entries shown`,
  `live region announced "${msg}"`,
  `said "${msg}", expected "${shown} entries shown"`,
);

const pressed = await btn.getAttribute("aria-pressed");
check(pressed === "true", "aria-pressed set on the active tag", `aria-pressed=${pressed}`);

const focused = await p.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 20));
check(
  !!focused?.startsWith(target),
  "focus stays on the pressed tag",
  `focus moved to "${focused}"`,
);

const url = new URL(p.url());
check(
  url.searchParams.get("tag") === target,
  `URL synced (?tag=${target})`,
  `URL not synced: ${p.url()}`,
);

// singular/plural agreement. The case a one-result filter would hide
const single = p.locator("fieldset button", { hasText: "Meta" }).first();
if (await single.count()) {
  await single.click();
  await p.waitForTimeout(150);
  const m2 = ((await p.locator("output").textContent()) ?? "").trim();
  check(
    m2 === "1 entry shown",
    `singular agreement: "${m2}"`,
    `expected "1 entry shown", got "${m2}"`,
  );
}

// deep link adopted on load
const p2 = await ctx.newPage();
await p2.goto(`${BASE}/writing/?tag=${target}`, { waitUntil: "networkidle" });
await p2.waitForTimeout(250);
const deep = await p2.locator("[data-entry]:not([hidden])").count();
check(
  deep === 2,
  `deep link ?tag=${target} applied on load (${deep})`,
  `deep link showed ${deep}, expected 2`,
);
await p2.close();

const all = p.locator("fieldset button", { hasText: "All" }).first();
await all.click();
await p.waitForTimeout(150);
const back = await p.locator("[data-entry]:not([hidden])").count();
check(back === 3, `"All" restores every entry (${back})`, `"All" showed ${back}, expected 3`);

await browser.close();
server.close();
console.log(`\n  ${fails} failure(s)\n`);
process.exit(fails ? 1 : 0);
