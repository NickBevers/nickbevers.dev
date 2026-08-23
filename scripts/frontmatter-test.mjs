/**
 * Round-trip tests for the frontmatter parser.
 *
 * This code rewrites files in the content repository, so the failure mode is
 * silent data loss: a field the parser does not understand vanishes on the
 * next save. Every real post's shape is checked here, plus the characters
 * that break naive YAML handling: colons, quotes, em dashes, accents.
 */
import { parse, serialise, slugify } from "../apps/admin/src/lib/frontmatter.ts";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

let fails = 0;
const ok = (m) => console.log(`  ok ${m}`);
const fail = (m) => {
  console.log(`  !! ${m}`);
  fails++;
};
const eq = (a, b, m) =>
  JSON.stringify(a) === JSON.stringify(b)
    ? ok(m)
    : fail(`${m}\n       got:      ${JSON.stringify(a)}\n       expected: ${JSON.stringify(b)}`);

console.log("\n  FRONTMATTER");

// 1. every real entry survives a round trip unchanged
const dir = "apps/site/src/content/entries";
for (const file of readdirSync(dir)) {
  const src = readFileSync(join(dir, file), "utf8");
  const { data, body } = parse(src);
  const again = parse(serialise(data, body));
  eq(again.data, data, `${file}: frontmatter round-trips`);
  eq(again.body, body, `${file}: body round-trips`);
}

// 2. the characters that break naive YAML
const tricky = {
  title: "Colons: they appear, and #hashes too",
  description: 'He said "quoted", she said , dashed,  and café',
  pubDate: "2026-08-23",
  tag: "CSS",
  draft: true,
  placeholder: false,
};
{
  const out = serialise(tricky, "Body.\n");
  const back = parse(out).data;
  eq(back.title, tricky.title, "colons and hashes survive");
  eq(back.description, tricky.description, "quotes, em dashes and accents survive");
  eq(back.draft, true, "boolean true survives as a boolean");
  eq(back.placeholder, false, "boolean false survives as a boolean");
}

// 3. nested object
{
  const withMentions = {
    ...tricky,
    mentions: { name: "oklch-picker", blurb: "MIT licensed.", href: "https://example.com" },
  };
  const back = parse(serialise(withMentions, "x")).data;
  eq(back.mentions, withMentions.mentions, "nested mentions survive");
}

// 4. a value that looks like a boolean or number must stay a string
{
  const back = parse(serialise({ ...tricky, title: "true", tag: "2026" }, "x")).data;
  eq(back.title, "true", 'the string "true" is not coerced to a boolean');
  eq(back.tag, "2026", 'the string "2026" stays a string');
}

// 5. body is untouched, including its own --- lines
{
  const body = "Intro.\n\n---\n\nA horizontal rule above.\n";
  const out = serialise(tricky, body);
  eq(parse(out).body, body, "a --- inside the body is not mistaken for a fence");
}

// 6. empty and missing optional fields are omitted, not written as empty
{
  const out = serialise(
    { title: "T", description: "D", pubDate: "2026-01-01", tag: "X", cover: "" },
    "b",
  );
  eq(/cover/.test(out), false, "empty optional fields are omitted");
}

// 7. field order is stable, so a one-value change is a one-line diff
{
  const a = serialise(
    { title: "A", description: "D", pubDate: "2026-01-01", tag: "T", draft: false },
    "b",
  );
  const b = serialise(
    { draft: false, tag: "T", pubDate: "2026-01-01", description: "D", title: "A" },
    "b",
  );
  eq(a, b, "field order does not depend on object key order");
}

// 8. slugs
eq(
  slugify("Picking colours in OKLCH, and why I stopped"),
  "picking-colours-in-oklch-and-why-i-stopped",
  "slug: punctuation dropped",
);
eq(slugify("Café: naïve résumé"), "cafe-naive-resume", "slug: accents folded to ascii");
eq(slugify("  Multiple   spaces  "), "multiple-spaces", "slug: whitespace collapsed");

console.log(`\n  ${fails} failure(s)\n`);
process.exit(fails ? 1 : 0);
