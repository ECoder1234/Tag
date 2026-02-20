import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  esbuild: {
    drop: ["console", "debugger"]
  },
  build: {
    target: "es2022"
  }
});
