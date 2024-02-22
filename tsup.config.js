import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  splitting: false,
  sourcemap: false,
  clean: true,
  minify: "terser",
  treeshake: true,
  format: ["es", "cjs"],
  legacyOutput: true
});
