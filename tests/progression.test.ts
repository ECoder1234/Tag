import { describe, expect, test } from "vitest";
import { SaveManager } from "../src/data/SaveManager";
import { CrazyGamesManager } from "../src/sdk/CrazyGamesManager";

describe("Progression", () => {
  test("starts with 4 unlocked skins and expected costs", async () => {
    const save = new SaveManager(new CrazyGamesManager());
    const profile = await save.loadProfile();

    expect(profile.unlockedSkinIds).toEqual([0, 1, 2, 3]);
    expect(SaveManager.skinCosts).toEqual([100, 200, 350, 550, 800, 1100, 1450, 1850]);
  });

  test("persists round rewards after each round", async () => {
    const save = new SaveManager(new CrazyGamesManager());
    const base = await save.loadProfile();
    const updated = await save.grantRoundRewards(base, true, true);
    const reloaded = await save.loadProfile();

    expect(updated.tagCoins).toBe(base.tagCoins + 90);
    expect(reloaded.tagCoins).toBe(updated.tagCoins);
  });
});