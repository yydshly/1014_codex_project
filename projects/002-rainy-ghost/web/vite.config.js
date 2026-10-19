import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: '/1014_codex_project/002-rainy-ghost/',
  build: {
    chunkSizeWarningLimit: 650,
    rolldownOptions: {
      input: {
        scene: fileURLToPath(new URL('./index.html', import.meta.url)),
        research: fileURLToPath(new URL('./research.html', import.meta.url)),
      },
      output: { codeSplitting: { groups: [{ name: 'three', test: /node_modules[\\/]three[\\/]build[\\/]/ }] } },
    },
  },
});
