import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://freevisaslotnotifier.com",
  vite: {
    build: {
      rollupOptions: {
        // Hash-only names, so shared bundles are not named after hidden pages.
        output: {
          assetFileNames: "_astro/[hash][extname]",
          chunkFileNames: "_astro/[hash].js",
          entryFileNames: "_astro/[hash].js",
        },
      },
    },
  },
});
