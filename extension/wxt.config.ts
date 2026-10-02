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
    host_permissions: [`${mode === "development" ? LOCAL_API : LIVE_API}/*`],
  }),
  vite: ({ mode }) => ({
    define: {
      __API_BASE__: JSON.stringify(mode === "development" ? LOCAL_API : LIVE_API),
    },
  }),
  hooks: {
    "build:manifestGenerated": (wxt, manifest) => {
      if (wxt.config.mode !== "development") return;
      for (const script of manifest.content_scripts ?? []) {
        script.matches = [...(script.matches ?? []), ...DEV_SCHEDULER_MATCHES];
      }
    },
  },
});
