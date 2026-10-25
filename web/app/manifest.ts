import type { MetadataRoute } from "next";
import { withBase, BASE_PATH } from "./lib/basePath";

// Required for the CAPACITOR_BUILD static export; a no-op for
// normal server builds.
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Datavatia",
    short_name: "Datavatia",
    description:
      "Mapping the hidden cost of data infrastructure",
    start_url: BASE_PATH || "/",
    display: "standalone",
    background_color: "#d8ddd8",
    theme_color: "#ffffff",
    orientation: "any",
    icons: [
      {
        src: withBase("/icons/icon-192.png"),
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: withBase("/icons/icon-512.png"),
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: withBase("/icons/icon-512-maskable.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
