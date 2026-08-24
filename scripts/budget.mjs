// Per-page weight budget, measured from real network traffic
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, extname, relative } from "node:path";
import { gzipSync } from "node:zlib";

const DIST = "apps/site/dist";

const BUDGETS = {
  "index.html": 5000,
  "about/index.html": 5000,
  "now/index.html": 5000,
  "writing/index.html": 5500,
  "writing/hello-world/index.html": 4900,
  default: 4500,
};
const CSS_BUDGET = 18 * 1024;

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
};

if (!existsSync(DIST)) {
  console.error("  dist/ not found: run `pnpm --filter site build` first");
  process.exit(1);
}

const server = createServer((q, r) => {
  let p = join(DIST, decodeURIComponent(q.url.split("?")[0]));
  if (p.endsWith("/")) p += "index.html";
  if (!existsSync(p)) {
    r.writeHead(404);
    return r.end("not found");
  }
  r.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
  r.end(readFileSync(p));
});
await new Promise((r) => server.listen(4321, r));

async function pages(dir = DIST, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await pages(p, out);
    else if (e.name.endsWith(".html")) out.push(relative(DIST, p));
  }
  return out;
}

const gz = (b) => gzipSync(b).length;
const browser = await chromium.launch();
let failed = 0;
const report = [];

console.log("\n  page                                    JS(gz)   budget   CSS(gz)");
console.log("  " + "-".repeat(66));

for (const rel of (await pages()).toSorted()) {
  const url = "/" + rel.replace(/index\.html$/, "");
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  const js = new Map();
  const css = new Map();
  page.on("response", (res) => {
    const u = res.url();
    const name = u.split("/").pop().split("?")[0];
    const file = join(DIST, "_astro", name);
    if (!existsSync(file)) return;
    if (u.endsWith(".js")) js.set(name, gz(readFileSync(file)));
    if (u.endsWith(".css")) css.set(name, gz(readFileSync(file)));
  });

  await page.goto("http://localhost:4321" + url, { waitUntil: "networkidle" });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);

  const html = readFileSync(join(DIST, rel), "utf8");
  let jsBytes = [...js.values()].reduce((a, b) => a + b, 0);
  let cssBytes = [...css.values()].reduce((a, b) => a + b, 0);
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
    jsBytes += gz(Buffer.from(m[1], "utf8"));
  }
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    cssBytes += gz(Buffer.from(m[1], "utf8"));
  }

  const budget = BUDGETS[rel] ?? BUDGETS.default;
  const jsOk = jsBytes <= budget;
  const cssOk = cssBytes <= CSS_BUDGET;
  if (!jsOk || !cssOk) failed++;

  report.push({
    page: rel,
    js: jsBytes,
    jsBudget: budget,
    css: cssBytes,
    cssBudget: CSS_BUDGET,
    ok: jsOk && cssOk,
  });
  console.log(
    `  ${jsOk && cssOk ? "ok" : "!!"} ${rel.padEnd(36)} ${String(jsBytes).padStart(6)}  ${String(budget).padStart(6)}   ${String(cssBytes).padStart(6)}` +
      `${jsOk ? "" : "  JS OVER"}${cssOk ? "" : "  CSS OVER"}`,
  );
  await page.close();
}

await browser.close();
server.close();

/* Written for the admin health panel */
mkdirSync("reports", { recursive: true });
writeFileSync(
  "reports/budget.json",
  JSON.stringify({ generated: Date.now(), pages: report }, null, 2),
);
console.log(`\n  ${failed} page(s) over budget\n`);
process.exit(failed ? 1 : 0);
