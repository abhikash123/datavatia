import type { NextConfig } from "next";

// CAPACITOR_BUILD=1 produces the static export bundled into
// the native iOS/Android shells (Capacitor serves it from the
// app bundle). Normal web builds and deploys are unaffected.
const isCapacitorBuild =
  process.env.CAPACITOR_BUILD === "1";

const nextConfig: NextConfig = {
  ...(isCapacitorBuild && {
    output: "export" as const,
  }),
};

export default nextConfig;
