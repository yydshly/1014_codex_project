import { defineConfig } from "vite";
import { resolve } from "node:path";
import { collaborationApi } from "./server/api.js";
import { catalogGateway } from "./server/catalog.js";

export default defineConfig({
  base: "/1014_codex_project/003-lofi-room/",
  define: { __LOFI_STATIC__: JSON.stringify(process.env.LOFI_PAGES_BUILD === "1") },
  plugins: [catalogGateway(), collaborationApi()],
  build: {
    outDir: process.env.LOFI_PAGES_BUILD === "1" ? ".cache/pages-dist" : "dist",
    chunkSizeWarningLimit: 650,
    rolldownOptions: {
      input: { room: resolve(import.meta.dirname, "index.html"), research: resolve(import.meta.dirname, "research.html") },
      output: {
        codeSplitting: {
          groups: [
            { name: "three", test: /node_modules[\\/]three[\\/]build[\\/]/ },
          ],
        },
      },
    },
  },
});
