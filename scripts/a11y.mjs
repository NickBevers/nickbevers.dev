/**
 * Structural a11y checks that need a real browser: reflow at 320px, focus
 * visibility under the sticky header, tab order, and target sizes.
 * Complements the static contrast gate.
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

const PAGES = process.argv.slice(2);
const browser = await chromium.launch();
let fails = 0;
const fail = (m) => {
  console.log(`  !! ${m}`);
  fails++;
};
const ok = (m) => console.log(`  ok ${m}`);

for (const url of PAGES) {
  console.log(`\n  ${url}`);

  // ---- reflow at 320 (WCAG 1.4.10): no horizontal scroll ----
  const page = await browser.newPage({ viewport: { width: 320, height: 800 } });
  await page.goto(`${BASE}` + url, { waitUntil: "networkidle" });
  const over = await page.evaluate(() => {
    const d = document.documentElement;
    const culprits = [];
    if (d.scrollWidth > d.clientWidth + 1) {
      for (const el of document.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (r.right > d.clientWidth + 1 && getComputedStyle(el).overflowX !== "auto") {
          culprits.push(
            el.tagName.toLowerCase() +
              (el.className ? "." + String(el.className).split(" ")[0] : ""),
          );
          if (culprits.length > 4) break;
        }
      }
    }
    return { sw: d.scrollWidth, cw: d.clientWidth, culprits };
  });
  if (over.sw > over.cw + 1) {
    fail(`320px: horizontal scroll (${over.sw} > ${over.cw}) via ${over.culprits.join(", ")}`);
  } else {
    ok("320px: no horizontal scroll");
  }
  await page.close();

  // ---- content must be visible with JS disabled ----
  // A scroll-reveal that defaults to opacity:0 and waits for JS turns any
  // script failure into a blank page. This asserts the guard actually holds.
  {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const nojs = await ctx.newPage();
    await nojs.goto(`${BASE}` + url, { waitUntil: "domcontentloaded" });
    const invisible = await nojs.evaluate(
      () =>
        [...document.querySelectorAll(".reveal")].filter(
          (el) => Number(getComputedStyle(el).opacity) < 0.99,
        ).length,
    );
    const total = await nojs.locator(".reveal").count();
    if (invisible > 0) fail(`no-JS: ${invisible}/${total} .reveal blocks are invisible`);
    else ok(`no-JS: content visible${total ? ` (${total} reveal blocks)` : ""}`);
    await ctx.close();
  }

  // ---- reflow with the display settings on (1.4.10) ----
  // An accessibility setting that introduces a horizontal scrollbar is worse
  // than not offering it. The dyslexic face is much wider than Hanken
  // Grotesk, so it is the case that actually breaks layouts.
  for (const [label, prefs] of [
    ["dyslexic font", { font: true }],
    ["dyslexic font + largest text", { font: true, size: "larger" }],
  ]) {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 800 } });
    const page = await ctx.newPage();
    await page.addInitScript((v) => localStorage.setItem("nb-a11y", JSON.stringify(v)), prefs);
    await page.goto(`${BASE}` + url, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const scroll = await page.evaluate(() => {
      const d = document.documentElement;
      return d.scrollWidth - d.clientWidth;
    });
    if (scroll > 1) fail(`320px with ${label}: horizontal scroll (${scroll}px)`);
    else ok(`320px with ${label}: no horizontal scroll`);
    await ctx.close();
  }

  // ---- focus not obscured (2.4.11) + target size (2.5.8) ----
  const p2 = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await p2.goto(`${BASE}` + url, { waitUntil: "networkidle" });

  const order = [];
  let obscured = 0,
    small = [];
  for (let i = 0; i < 40; i++) {
    await p2.keyboard.press("Tab");
    const info = await p2.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      // is the focused element hidden behind the sticky header?
      const hdr = document.querySelector(".hd");
      const hr = hdr ? hdr.getBoundingClientRect() : null;
      // The skip link is MEANT to overlay the header when focused, and any
      // fixed/sticky element positions itself. Neither is an obscured-focus bug.
      const exempt =
        el.classList.contains("skip") || cs.position === "fixed" || cs.position === "sticky";
      const behind =
        !!hr && !exempt && r.top < hr.bottom && r.bottom > hr.top && !el.closest(".hd");
      return {
        tag: el.tagName.toLowerCase(),
        label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 28),
        w: Math.round(r.width),
        h: Math.round(r.height),
        behind,
        outline: cs.outlineWidth,
        inHeader: !!el.closest(".hd"),
        inMain: !!el.closest("main"),
        // a link whose parent is running text is exempt from the size floor
        inline:
          el.tagName === "A" &&
          !el.className &&
          !!el.parentElement &&
          /^(P|LI|TD|H[1-6]|SPAN|EM|STRONG)$/.test(el.parentElement.tagName),
      };
    });
    if (!info) break;
    order.push(info);
    if (info.behind) obscured++;
    // 2.5.8 has an explicit exception for targets inline in a sentence:
    // an author cannot enlarge them without breaking the line box.
    if ((info.w < 24 || info.h < 24) && info.w > 0 && !info.inline)
      small.push(`${info.tag}"${info.label}" ${info.w}x${info.h}`);
  }

  if (obscured) fail(`${obscured} focused element(s) obscured by the sticky header`);
  else ok("focus never hidden by the sticky header");

  if (small.length) fail(`target < 24px: ${small.slice(0, 3).join("; ")}`);
  else ok("all focusable targets >= 24px");

  const first = order[0];
  if (first && /skip/i.test(first.label)) ok(`skip link is first ("${first.label}")`);
  else fail(`first tab stop is not a skip link: ${first?.label}`);

  // The rail is visually right of the content and must come AFTER it in the
  // DOM, so a keyboard user reaches the article before the sidebar. Both sit
  // inside <main>, so compare their positions directly rather than treating
  // "outside main" as a proxy for "the rail". The skip menu and the floating
  // settings button are also outside main and are not the rail.
  const lastContent = order.findLastIndex((o) => o.inMain && !o.inRail);
  const firstRail = order.findIndex((o) => o.inRail);
  if (firstRail >= 0 && lastContent >= 0 && firstRail < lastContent) {
    fail(
      `rail (stop ${firstRail + 1}) is reachable before the content ends (stop ${lastContent + 1})`,
    );
  } else {
    ok("main content precedes the rail in tab order");
  }

  ok(`${order.length} tab stops`);
  await p2.close();
}

await browser.close();
server.close();
console.log(`\n  ${fails} structural failure(s)\n`);
process.exit(fails ? 1 : 0);
