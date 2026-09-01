import { defineConfig } from 'tsup';
export default defineConfig([
  { entry: ['src/index.ts'], format: ['esm', 'cjs'], dts: true, sourcemap: true, clean: true },
  { entry: ['src/auto.ts'], format: ['iife'], minify: true, sourcemap: false },
]);
