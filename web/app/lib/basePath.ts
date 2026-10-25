// When the site is hosted under a subpath (GitHub Pages serves
// project sites at /<repo>/), NEXT_PUBLIC_BASE_PATH carries the
// prefix at build time. Empty for root-hosted builds (Vercel,
// local dev, the Capacitor bundle).
export const BASE_PATH =
  process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prefix an absolute-path URL with the deploy base path. */
export function withBase(path: string): string {
  return `${BASE_PATH}${path}`;
}
