import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "org.datavatia.app",
  appName: "Datavatia",
  // The static export produced by CAPACITOR_BUILD=1 next build.
  webDir: "out",
  ios: {
    contentInset: "never",
  },
};

export default config;
