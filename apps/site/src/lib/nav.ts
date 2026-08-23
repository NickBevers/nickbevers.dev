export const NAV = [
  { href: "/", label: "Home" },
  { href: "/writing/", label: "Writing" },
  { href: "/about/", label: "About" },
  { href: "/now/", label: "Now" },
] as const;

export const SOCIAL = [
  { label: "GitHub", href: "https://github.com/NickBevers", handle: "/NickBevers" },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/nick-bevers/",
    handle: "/in/nick-bevers",
  },
  {
    label: "Mastodon",
    href: "https://mastodon.social/@nickbevers",
    handle: "@nickbevers",
    rel: "me",
  },
] as const;

export const SITE = {
  title: "Nick Bevers",
  tagline: "artisanal craft enjoyer",
  description:
    "Frontend developer at Spatie in Antwerp. Notes on frontend work, the occasional deep dive, and the non-code things worth writing about.",
  email: "hello@nickbevers.dev",
  city: "Belgium",
} as const;

/** True when `href` is the current page or an ancestor section of it. */
export function isActive(href: string, pathname: string): boolean {
  const a = href.endsWith("/") ? href : `${href}/`;
  const b = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return a === "/" ? b === "/" : b.startsWith(a);
}
