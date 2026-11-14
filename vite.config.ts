import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The whole site is built into one self-contained index.html (the worker is inlined too),
// so it can be hosted anywhere or simply opened as a file.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  worker: { format: 'iife' },
  build: { target: 'es2022' },
});
