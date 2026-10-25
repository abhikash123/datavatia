import type { NextConfig } from "next";

// CAPACITOR_BUILD=1 produces the static export bundled into
// the native iOS/Android shells. NEXT_PUBLIC_BASE_PATH (e.g.
// "/datavatia" for GitHub Pages project sites) also implies a
// static export, served under that subpath. Normal web builds
// and deploys are unaffected by both.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const isStaticExport =
  process.env.CAPACITOR_BUILD === "1" || basePath !== "";

const nextConfig: NextConfig = {
  ...(basePath && { basePath }),
  ...(isStaticExport && {
    output: "export" as const,
  }),
};

export default nextConfig;
