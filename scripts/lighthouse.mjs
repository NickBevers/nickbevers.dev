/**
 * Lighthouse against the real production build, on this machine.
 *
 * Mobile emulation by default. That is the profile the site is being
 * designed for, and desktop scores flatter a build in ways that hide real
 * problems on a phone.
 *
 * Run: pnpm lh            (mobile)
 *      pnpm lh -- desktop
 */
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { launch } from "chrome-launcher";
import { chromium } from "playwright";
import lighthouse from "lighthouse";

const PORT = 4599;
const BASE = `http://localhost:${PORT}`;
const PAGES = ["/", "/writing/", "/writing/hello-world/", "/about/"];

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".txt": "text/plain",
  ".xsl": "application/xslt+xml",
};

const server = createServer((q, r) => {
  let p = join("apps/site/dist", decodeURIComponent(q.url.split("?")[0]));
  if (p.endsWith("/")) p += "index.html";
  if (!existsSync(p)) {
    r.writeHead(404);
    return r.end("not found");
  }
  r.writeHead(200, {
    "content-type": MIME[extname(p)] || "application/octet-stream",
    // Match what a real host sends, or Lighthouse flags missing caching and
    // compression that production would actually provide.
    "cache-control": extname(p) === ".html" ? "no-cache" : "max-age=31536000,immutable",
  });
  r.end(readFileSync(p));
});
await new Promise((r) => server.listen(PORT, r));

const pct = (n) => Math.round(n * 100);
const desktop = process.argv.includes("desktop");
/* Pin the binary to Playwright's bundled Chromium.
   chrome-launcher searches the machine for an installed browser and, on macOS,
   can pick one the user is actually using. This script kills what it launches,
   so an unpinned run closed a real browser window with real tabs in it. The
   bundled binary is headless, private to this repo, and safe to kill. */
const chrome = await launch({
  chromePath: chromium.executablePath(),
  chromeFlags: ["--headless=new", "--no-sandbox"],
});

const rows = [];
let failed = 0;

/** Score floors. A regression below these fails the run. */
const FLOOR = { performance: 0.95, accessibility: 1.0, "best-practices": 0.95, seo: 1.0 };

console.log(`\n  Lighthouse: ${desktop ? "desktop" : "mobile"}\n`);
console.log("  page                          perf   a11y   best    seo    LCP     CLS    TBT");
console.log("  " + "-".repeat(74));

for (const path of PAGES) {
  const res = await lighthouse(BASE + path, {
    port: chrome.port,
    output: "json",
    logLevel: "error",
    formFactor: desktop ? "desktop" : "mobile",
    screenEmulation: desktop
      ? { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }
      : { mobile: true, width: 390, height: 844, deviceScaleFactor: 3, disabled: false },
    throttlingMethod: "simulate",
  });

  const c = res.lhr.categories;
  const a = res.lhr.audits;

  const ms = (k) => a[k]?.numericValue ?? 0;

  const scores = {
    performance: c.performance.score,
    accessibility: c.accessibility.score,
    "best-practices": c["best-practices"].score,
    seo: c.seo.score,
  };
  const bad = Object.entries(FLOOR).filter(([k, min]) => (scores[k] ?? 0) < min);
  if (bad.length) failed++;

  rows.push({ path, scores, lhr: res.lhr });
  console.log(
    `  ${bad.length ? "!!" : "ok"} ${path.padEnd(26)} ${String(pct(scores.performance)).padStart(4)}` +
      `   ${String(pct(scores.accessibility)).padStart(4)}` +
      `   ${String(pct(scores["best-practices"])).padStart(4)}` +
      `   ${String(pct(scores.seo)).padStart(4)}` +
      `  ${(ms("largest-contentful-paint") / 1000).toFixed(2)}s` +
      `  ${(a["cumulative-layout-shift"]?.numericValue ?? 0).toFixed(3)}` +
      `  ${Math.round(ms("total-blocking-time"))}ms`,
  );
}

// Anything actually failing, named.
console.log("");
for (const { path, lhr } of rows) {
  const problems = Object.values(lhr.audits).filter(
    (x) => x.score !== null && x.score < 0.9 && x.scoreDisplayMode !== "informative",
  );
  if (problems.length) {
    console.log(`  ${path}`);
    for (const p of problems.slice(0, 6)) console.log(`    · ${p.title}`);
  }
}

mkdirSync("reports", { recursive: true });
writeFileSync(
  `reports/lighthouse-${desktop ? "desktop" : "mobile"}.json`,
  JSON.stringify(
    rows.map(({ path, scores }) => ({ path, scores })),
    null,
    2,
  ),
);

await chrome.kill();
server.close();
console.log(`\n  ${failed} page(s) below the floor\n`);
process.exit(failed ? 1 : 0);
