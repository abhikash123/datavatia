// MapLibre resolves its web worker script relative to
// import.meta.url, which breaks once the library is bundled:
// the worker URL comes out empty, the worker never starts, and
// GeoJSON sources hang forever without an error. The fix is to
// serve the worker files statically and point setWorkerUrl at
// them (see app/page.tsx). This script keeps the copies in
// public/maplibre/ in sync with the installed maplibre-gl
// version; it runs automatically before `dev` and `build`.

const fs = require("node:fs");
const path = require("node:path");

const distDir = path.dirname(
  require.resolve("maplibre-gl/package.json")
);

const sourceDir = path.join(distDir, "dist");

const targetDir = path.join(
  __dirname,
  "..",
  "public",
  "maplibre"
);

// maplibre-gl-worker.mjs imports ./maplibre-gl-shared.mjs, so
// both files have to be served side by side. The sourcemaps
// ride along so DevTools doesn't 404 on them.
const files = [
  "maplibre-gl-worker.mjs",
  "maplibre-gl-worker.mjs.map",
  "maplibre-gl-shared.mjs",
  "maplibre-gl-shared.mjs.map",
];

fs.mkdirSync(targetDir, { recursive: true });

for (const file of files) {
  fs.copyFileSync(
    path.join(sourceDir, file),
    path.join(targetDir, file)
  );
}

console.log(
  `Synced MapLibre worker files to ${targetDir}`
);
