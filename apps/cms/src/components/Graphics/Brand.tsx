/*
 * The site's NB logo for Payload's graphics slots. The paths are copied from
 * apps/web/src/assets/images/logo.svg; keep them in sync. The letters use --text, so they follow
 * the admin's light and dark themes.
 */

const letters =
  'M0 0h80.36l293.02 372H297L60 71.12V372H0Zm221.5 0h288.78q57.96 0 89.01 25.49 31.05 25.47 31.05 72.78 0 32.75-15.53 53.54c-7.12 10.19-17.49 23.38-36.12 27.19 25.87 3.81 42 18 51.64 29.99 12.78 15.87 19.67 36.04 19.67 61.34q0 48.86-32.6 75.37c-21.74 17.33-53.46 26.3-95.21 26.3h-7.67l-42.14-53.5h41.01q38.81 0 56.92-13.18 18.11-13.16 18.11-41.23 0-55.59-75.03-55.59H385.73l-40.17-51h152.82q70.89 0 70.89-53 0-51-70.89-51H263.64Z';
const stripe = 'M112.74 0h76.38l293.02 372h-76.38Z';

const Mark = ({ height }: { height: string }) => (
  // Inline, not an <img>: an image can't read the admin's CSS variables, so the letters would stop
  // following the theme. role="img" with a label is the accessible pattern for an inline SVG.
  <svg
    viewBox="0 0 650 372"
    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
    role="img"
    aria-label="Nick Bevers"
    style={{ display: 'block', height, width: 'auto' }}
  >
    <path fill="var(--text)" d={letters} />
    <path fill="#59736a" d={stripe} />
  </svg>
);

/** `admin.components.graphics.Icon`: the small mark in the admin's header. */
export const Icon = () => <Mark height="1.125rem" />;

/** `admin.components.graphics.Logo`: the larger mark on the sign-in screens. */
export const Logo = () => <Mark height="4rem" />;
