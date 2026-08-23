/**
 * Behavioural tests for the skip menu. The first thing a keyboard user hits.
 * Drives real key presses rather than calling handlers, because the point is
 * whether Tab/Enter/Escape/Alt behave, not whether the functions exist.
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
const ok = (m) => console.log(`  ok ${m}`);
const fail = (m) => {
  console.log(`  !! ${m}`);
  fails++;
};
const check = (c, g, b) => (c ? ok(g) : fail(b));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);

const active = () =>
  page.evaluate(() => {
    const a = document.activeElement;
    return {
      tag: a.tagName.toLowerCase(),
      text: (a.textContent || "").trim().slice(0, 34),
      inMenu: !!a.closest("[data-skipmenu]"),
      id: a.id || null,
    };
  });

console.log("\n  SKIP MENU");

// 1. first tab stop is inside the menu
await page.keyboard.press("Tab");
let a = await active();
check(
  a.inMenu && /skip to main/i.test(a.text),
  `first tab stop is "${a.text}"`,
  `first tab stop is "${a.text}": expected the skip menu`,
);

// 2. the menu becomes visible when focused.
// Wait for the slide-in transition; measuring immediately catches it mid-flight.
await page.waitForTimeout(400);
const visible = await page.evaluate(() => {
  const m = document.querySelector("[data-skipmenu]");
  return m.getBoundingClientRect().top >= 0;
});
check(visible, "menu is visible once focused", "menu stayed off-screen when focused");

// 3. tabbing through reaches each option
const opts = [];
for (let i = 0; i < 9; i++) {
  const cur = await active();
  if (!cur.inMenu) break;
  opts.push(cur.text);
  await page.keyboard.press("Tab");
}
check(
  opts.length >= 4,
  `${opts.length} options reachable by Tab`,
  `only ${opts.length} options: ${opts.join(" / ")}`,
);
check(
  opts.some((t) => /display settings/i.test(t)),
  "display settings is an option",
  "no display-settings option",
);
check(
  opts.some((t) => /navigation/i.test(t)),
  "navigation is an option",
  "no navigation option",
);

// 4. section links were generated from the page's headings
const sections = await page.evaluate(() => {
  const l = document.querySelector("[data-skip-section-list]");
  return l ? [...l.querySelectorAll("a")].map((a) => a.textContent.trim()) : [];
});
check(
  sections.length > 0,
  `${sections.length} section links generated (${sections.slice(0, 2).join(", ")}…)`,
  "no section links were generated from the page headings",
);

// 5. activating "skip to main" moves focus to main
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(300);
await page.keyboard.press("Tab");
await page.keyboard.press("Enter");
await page.waitForTimeout(400);
a = await active();
check(
  a.id === "main" || a.tag === "main",
  `focus moved to <${a.tag}${a.id ? "#" + a.id : ""}>`,
  `after skip, focus is on <${a.tag}> "${a.text}": expected main`,
);

// 6. Alt+/ opens the menu from anywhere
await page.evaluate(() => window.scrollTo(0, 1200));
await page.click("body", { position: { x: 600, y: 400 } });
await page.keyboard.press("Alt+Slash");
await page.waitForTimeout(300);
a = await active();
check(a.inMenu, "Alt+/ opens the menu from mid-page", `Alt+/ left focus on <${a.tag}> "${a.text}"`);

// 7. Alt+D opens the display settings
await page.keyboard.press("Escape");
await page.waitForTimeout(200);
await page.keyboard.press("Alt+d");
await page.waitForTimeout(400);
const modal = await page.evaluate(() => {
  const d = document.querySelector("dialog");
  return d ? d.matches(":modal") : false;
});
check(modal, "Alt+D opens the display settings dialog", "Alt+D did not open the dialog");

// 8. a section link actually moves focus to that heading
await page.keyboard.press("Escape");
await page.waitForTimeout(200);
const jumped = await page.evaluate(async () => {
  const l = document.querySelector("[data-skip-section-list] a");
  if (!l) return null;
  l.click();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const a = document.activeElement;
  return { tag: a.tagName.toLowerCase(), text: (a.textContent || "").trim().slice(0, 30) };
});
check(
  jumped && /^h[1-6]$/.test(jumped.tag),
  `section link moves focus to <${jumped?.tag}> "${jumped?.text}"`,
  `section link left focus on <${jumped?.tag}>`,
);

// 9. the same on an entry page, where headings sit inside <article>
{
  const p2 = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await p2.goto(`${BASE}/writing/hello-world/`, { waitUntil: "networkidle" });
  await p2.waitForTimeout(500);
  const secs = await p2.evaluate(() => {
    const l = document.querySelector("[data-skip-section-list]");
    return l ? [...l.querySelectorAll("a")].map((a) => a.textContent.trim()) : [];
  });
  // An entry's h2s ARE its sections, but they live inside <article>: the
  // exclusion must not swallow them.
  check(
    secs.length > 0,
    `entry page lists ${secs.length} section(s) (${secs.slice(0, 2).join(", ")})`,
    "entry page generated no section links. The article exclusion is too broad",
  );
  await p2.close();
}

await browser.close();
server.close();
console.log(`\n  ${fails} failure(s)\n`);
process.exit(fails ? 1 : 0);
