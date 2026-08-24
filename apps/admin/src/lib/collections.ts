// Collection definitions for the admin

export type FieldType = "text" | "textarea" | "number" | "url" | "date" | "boolean";

export interface Field {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  max?: number;
  help?: string;
}

export interface CollectionDef {
  /** URL segment and lookup key. */
  key: string;
  /** Singular and plural, for headings and buttons. */
  one: string;
  many: string;
  /** Repository directory, relative to the repo root. */
  dir: string;
  /** File extension for new files. */
  ext: ".md" | ".mdx";
  /** Which frontmatter field is the human-readable title. */
  titleField: string;
  /** Whether the type has a markdown body under the frontmatter. */
  hasBody: boolean;
  fields: Field[];
}

export const COLLECTIONS: Record<string, CollectionDef> = {
  work: {
    key: "work",
    one: "Project",
    many: "Things I've built",
    dir: "apps/site/src/content/work",
    ext: ".md",
    titleField: "name",
    hasBody: true,
    fields: [
      { name: "name", label: "Name", type: "text", required: true, max: 90 },
      { name: "year", label: "Year", type: "text", required: true },
      {
        name: "status",
        label: "Status",
        type: "text",
        required: true,
        help: "The pill beside the blurb, e.g. “MIT · open source”",
      },
      { name: "blurb", label: "Blurb", type: "textarea", required: true, max: 200 },
      {
        name: "order",
        label: "Order",
        type: "number",
        required: true,
        help: "Lower comes first. The displayed number is derived from this.",
      },
      { name: "href", label: "Link", type: "url", help: "Where it lives, if anywhere public" },
      { name: "repo", label: "Source", type: "url" },
      { name: "draft", label: "Draft", type: "boolean" },
      { name: "placeholder", label: "Placeholder", type: "boolean" },
    ],
  },

  life: {
    key: "life",
    one: "Life card",
    many: "Off the clock",
    dir: "apps/site/src/content/life",
    ext: ".md",
    titleField: "title",
    hasBody: true,
    fields: [
      { name: "title", label: "Title", type: "text", required: true, max: 90 },
      { name: "kicker", label: "Kicker", type: "text", required: true },
      { name: "blurb", label: "Blurb", type: "textarea", required: true, max: 200 },
      { name: "pubDate", label: "Date", type: "date", required: true },
      {
        name: "photoPrompt",
        label: "Photo prompt",
        type: "text",
        help: "Shown inside the empty frame until a photo exists",
      },
      { name: "draft", label: "Draft", type: "boolean" },
      { name: "placeholder", label: "Placeholder", type: "boolean" },
    ],
  },
};

export const getCollection = (key: string): CollectionDef | null => COLLECTIONS[key] ?? null;
