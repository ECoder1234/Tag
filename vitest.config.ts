import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: [
        "src/game/TagSystem.ts",
        "src/game/ai/GhostAI.ts",
        "src/game/AntiStall.ts",
        "src/game/powerups/PowerupSystem.ts",
        "src/data/SaveManager.ts",
        "src/game/map/MapSchema.ts"
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90
      }
    }
  }
});
