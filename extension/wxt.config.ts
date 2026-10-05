import { defineConfig } from "wxt";
import { DEV_SCHEDULER_MATCHES } from "./src/scheduler";

const LOCAL_API = "http://localhost:8787";
const LIVE_API = "https://freevisaslotnotifier.com";

// `wxt` (dev) talks to `npm run serve -w api`; `wxt build` talks to the live site.
export default defineConfig({
  manifest: ({ mode }) => ({
    name: "Visa Slot Notifier",
    description:
      "Free Telegram alerts for U.S. visa appointment dates. Never asks for your login and never books for you.",
    permissions: ["storage"],
    icons: {
      16: "icon-16.png",
      32: "icon-32.png",
      48: "icon-48.png",
      128: "icon-128.png",
    },
    action: {
      default_icon: {
        16: "icon-16.png",
        32: "icon-32.png",
        48: "icon-48.png",
        128: "icon-128.png",
      },
    },
    host_permissions: [`${mode === "development" ? LOCAL_API : LIVE_API}/*`],
  }),
  vite: ({ mode }) => ({
    define: {
      __API_BASE__: JSON.stringify(mode === "development" ? LOCAL_API : LIVE_API),
    },
  }),
  zip: {
    artifactTemplate: "visa-slot-notifier-{{version}}-{{browser}}.zip",
  },
  hooks: {
    "build:manifestGenerated": (wxt, manifest) => {
      if (wxt.config.mode !== "development") return;
      for (const script of manifest.content_scripts ?? []) {
        script.matches = [...(script.matches ?? []), ...DEV_SCHEDULER_MATCHES];
      }
    },
  },
});
