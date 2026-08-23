/**
 * Media upload: file picker, drag and drop, clipboard.
 */
const form = document.querySelector<HTMLFormElement>("[data-upload]");
if (form) {
  const input = form.querySelector<HTMLInputElement>("[data-file]")!;
  const zone = form.querySelector<HTMLElement>("[data-dz]")!;
  const status = form.querySelector<HTMLElement>("[data-status]")!;

  const say = (text: string, tone?: "ok" | "bad") => {
    status.textContent = text;
    if (tone) status.dataset.tone = tone;
    else delete status.dataset.tone;
  };

  /** FileReader gives a data: URL; the API wants the payload alone. */
  const toBase64 = (file: File) =>
    new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(",")[1] ?? "");
      r.onerror = () => rej(new Error(`Could not read ${file.name}`));
      r.readAsDataURL(file);
    });

  async function upload(files: FileList | File[]) {
    const list = [...files];
    if (!list.length) return;

    let done = 0;
    /* Sequential on purpose. Each upload is its own commit against the same
       branch, so running them together makes every request after the first
       race the moving head and fail on a stale sha. Slower, and it works. */
    // oxlint-disable-next-line no-await-in-loop
    for (const file of list) {
      say(`Uploading ${file.name} (${done + 1} of ${list.length})…`);
      try {
        const base64 = await toBase64(file);
        const res = await fetch("/api/media/upload", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: file.name, base64, bytes: file.size }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) { say(json.error ?? `Could not upload ${file.name}.`, "bad"); return; }
        done++;
      } catch (err) {
        say((err as Error).message, "bad");
        return;
      }
    }
    say(`${done} image${done === 1 ? "" : "s"} committed. Reloading…`, "ok");
    setTimeout(() => location.reload(), 700);
  }

  input.addEventListener("change", () => input.files && upload(input.files));

  for (const type of ["dragenter", "dragover"]) {
    zone.addEventListener(type, (e) => {
      e.preventDefault();
      zone.setAttribute("data-over", "");
    });
  }
  for (const type of ["dragleave", "drop"]) {
    zone.addEventListener(type, () => zone.removeAttribute("data-over"));
  }
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    const files = (e as DragEvent).dataTransfer?.files;
    if (files?.length) upload(files);
  });

  document.addEventListener("click", async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-copy]");
    if (!btn) return;
    const path = btn.dataset.copy!;
    try {
      await navigator.clipboard.writeText(path);
      const was = btn.textContent;
      btn.textContent = "Copied";
      setTimeout(() => (btn.textContent = was), 1200);
    } catch {
      say(path, "ok"); // clipboard blocked: show it so it can be selected
    }
  });
}
