/**
 * Wires the markdown editor: highlighting, toolbar, shortcuts, preview.
 */
import { highlight, render, applyTool, TOOLS } from "./markdown";

for (const root of document.querySelectorAll<HTMLElement>("[data-md]")) {
  const input = root.querySelector<HTMLTextAreaElement>("[data-md-input]");
  const hl = root.querySelector<HTMLElement>("[data-md-hl]");
  const out = root.querySelector<HTMLElement>("[data-md-out]");
  const readPane = root.querySelector<HTMLElement>("[data-md-render]");
  const previewBtn = root.querySelector<HTMLButtonElement>("[data-md-preview]");
  if (!input || !hl) continue;

  let previewOn = false;

  function paint() {
    // A trailing newline collapses in the <pre>, which shortens the highlight
    // layer and lets the last line drift out from under the caret.
    hl!.innerHTML = highlight(input!.value) + "\n";
    if (previewOn && out) out.innerHTML = render(input!.value);
  }

  /* The two layers scroll independently unless kept in step. */
  const sync = () => {
    hl!.scrollTop = input!.scrollTop;
    hl!.scrollLeft = input!.scrollLeft;
  };

  input.addEventListener("input", paint);
  input.addEventListener("scroll", sync, { passive: true });

  root.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-md-tool]");
    if (!btn) return;
    const tool = TOOLS[btn.dataset.mdTool!];
    if (tool) applyTool(input, tool);
  });

  input.addEventListener("keydown", (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
    const map: Record<string, string> = { b: "bold", i: "italic", k: "link" };
    const id = map[e.key.toLowerCase()];
    if (!id) return;
    e.preventDefault();
    applyTool(input, TOOLS[id]);
  });

  previewBtn?.addEventListener("click", () => {
    previewOn = !previewOn;
    previewBtn.setAttribute("aria-pressed", String(previewOn));
    root.toggleAttribute("data-preview", previewOn);
    if (readPane) readPane.hidden = !previewOn;
    paint();
  });

  paint();
}
