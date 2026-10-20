import { defineConfig } from 'vite';
import { companionAPI } from './server/api.js';

export default defineConfig({
  base: '/1014_codex_project/005-cyber-companion/',
  plugins: [companionAPI()],
  build: { target: 'es2022' },
});
