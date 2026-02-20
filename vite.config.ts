import { defineConfig } from "vite";

export default defineConfig({
  esbuild: {
    drop: ["console", "debugger"]
  },
  build: {
    target: "es2022"
  }
});
