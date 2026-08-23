/**
 * The editor's client behaviour.
 *
 * The important part is the 409 path. GitHub refuses a write whose base blob
 * has moved, and the temptation is to reload and retry. Which silently
 * discards whatever the author just typed. Instead the two versions are shown
 * side by side and the user chooses. Nothing is sent until they do.
 *
 * A bundled module rather than an inline script: this is behind auth, so the
 * page-weight argument that governs the public site does not apply, and the
 * type checking is worth more here than the bytes.
 */

/** Mirrors the server's slug rule, so a bad one is caught before the round trip. */
function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

async function send(url: string, payload: Payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { res, json: await res.json().catch(() => ({})) };
}

interface Payload {
  slug: string;
  path?: string;
  sha?: string;
  data: Record<string, unknown>;
  body: string;
  expectedHead?: string;
}

const form = document.querySelector<HTMLFormElement>("[data-editor]");
if (form) {
  const status = form.querySelector<HTMLElement>("[data-status]")!;
  const dialog = document.querySelector<HTMLDialogElement>("[data-conflict]")!;
  const saveBtn = form.querySelector<HTMLElement>("[data-save]")!;
  const publishBtn = form.querySelector<HTMLElement>("[data-publish]")!;

  const field = (n: string) => form.elements.namedItem(n) as HTMLInputElement | HTMLTextAreaElement;

  let sha = form.dataset.sha || undefined;
  let path = form.dataset.path || undefined;
  let head = form.dataset.head || undefined;
  let dirty = false;

  form.addEventListener("input", () => {
    dirty = true;
    say("");
  });

  /* Leaving with unsaved text should require a deliberate confirmation. */
  addEventListener("beforeunload", (e) => {
    if (!dirty) return;
    e.preventDefault();
  });

  function say(text: string, tone?: "ok" | "bad") {
    status.textContent = text;
    if (tone) status.dataset.tone = tone;
    else delete status.dataset.tone;
  }

  function collect(): Payload | null {
    const title = field("title").value.trim();
    const slug = field("slug").value.trim() || slugify(title);
    if (!title) {
      say("A title is required.", "bad");
      field("title").focus();
      return null;
    }
    if (!slug) {
      say("Could not derive a slug from that title: set one.", "bad");
      return null;
    }

    return {
      slug,
      path,
      sha,
      expectedHead: head,
      body: field("body").value,
      data: {
        title,
        description: field("description").value.trim(),
        pubDate: field("pubDate").value,
        tag: (form.elements.namedItem("tag") as HTMLSelectElement).value,
        draft: (form.elements.namedItem("draft") as HTMLInputElement).checked,
      },
    };
  }

  async function submit(url: string, verb: string, payload: Payload) {
    say(`${verb}…`);
    saveBtn.setAttribute("aria-disabled", "true");
    publishBtn.setAttribute("aria-disabled", "true");
    try {
      const { res, json } = await send(url, payload);

      if (res.status === 409) {
        showConflict(json, payload);
        return;
      }
      if (!res.ok) {
        say(json.error ?? `Could not ${verb.toLowerCase()}.`, "bad");
        return;
      }

      if (json.sha) sha = json.sha;
      if (json.commit) head = json.commit;
      if (!path) path = `apps/site/src/content/entries/${payload.slug}.mdx`;
      form.dataset.sha = sha ?? "";
      dirty = false;
      say(`${verb}: commit ${String(json.commit ?? "").slice(0, 7)}`, "ok");

      // A new post now has a real slug; move to its own URL so a reload works.
      if (!form.dataset.slug) {
        form.dataset.slug = payload.slug;
        history.replaceState(null, "", `/posts/${payload.slug}/`);
      }
    } catch (err) {
      say((err as Error).message, "bad");
    } finally {
      saveBtn.removeAttribute("aria-disabled");
      publishBtn.removeAttribute("aria-disabled");
    }
  }

  function showConflict(json: { current?: { sha: string; body: string } }, mine: Payload) {
    const theirs = dialog.querySelector<HTMLElement>("[data-conflict-theirs]")!;
    const mineEl = dialog.querySelector<HTMLElement>("[data-conflict-mine]")!;
    theirs.textContent = json.current?.body ?? "(could not read the current file)";
    mineEl.textContent = mine.body;

    dialog.querySelector("[data-conflict-take-theirs]")!.addEventListener(
      "click",
      () => {
        if (json.current) {
          field("body").value = json.current.body;
          sha = json.current.sha;
          form.dataset.sha = sha;
          dirty = false;
        }
        dialog.close();
        say("Loaded the version from GitHub. Your text was not saved.", "bad");
      },
      { once: true },
    );

    dialog.querySelector("[data-conflict-keep-mine]")!.addEventListener(
      "click",
      async () => {
        // Adopt their sha so the write is accepted, keeping OUR text. This is
        // an explicit overwrite, chosen by the user, not a silent retry.
        if (json.current) {
          sha = json.current.sha;
          form.dataset.sha = sha;
        }
        dialog.close();
        await submit("/api/posts/save", "Saved", { ...mine, sha });
      },
      { once: true },
    );

    dialog.showModal();
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const p = collect();
    if (p) void submit("/api/posts/save", "Saved", p);
  });

  publishBtn.addEventListener("click", () => {
    const p = collect();
    if (!p) return;
    if (!p.path && !form.dataset.slug) {
      say("Save the entry once before publishing it.", "bad");
      return;
    }
    p.path = path ?? `apps/site/src/content/entries/${p.slug}.mdx`;
    void submit("/api/posts/publish", "Published", p);
  });
}
