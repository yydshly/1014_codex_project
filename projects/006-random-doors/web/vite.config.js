import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: '/1014_codex_project/006-random-doors/',
  build: {
    chunkSizeWarningLimit: 650,
    rolldownOptions: {
      input: { main: resolve(import.meta.dirname, 'index.html'), seaside: resolve(import.meta.dirname, 'seaside.html'), research: resolve(import.meta.dirname, 'research.html'), worlds: resolve(import.meta.dirname, 'worlds.html') },
      output: { codeSplitting: { groups: [{ name: 'three', test: /node_modules[\\/]three[\\/]build[\\/]/ }] } },
    },
  },
});
