import { describe, expect, test } from "vitest";
import { SaveManager } from "../src/data/SaveManager";
import { CrazyGamesManager } from "../src/sdk/CrazyGamesManager";

describe("Save schema", () => {
  test("falls back to default profile on invalid schema", async () => {
    const cg = new CrazyGamesManager();
    await cg.setData("tag_infinity_profile_v1", JSON.stringify({ tagCoins: -20, unlockedSkinIds: [0] }));

    const save = new SaveManager(cg);
    const profile = await save.loadProfile();

    expect(profile.tagCoins).toBe(0);
    expect(profile.unlockedSkinIds).toEqual([0, 1, 2, 3]);
  });

  test("normalizes and persists schema-safe profile", async () => {
    const cg = new CrazyGamesManager();
    const save = new SaveManager(cg);

    await save.saveProfile({ tagCoins: 10.8, unlockedSkinIds: [4, 4, 2, 2] });
    const reloaded = await save.loadProfile();

    expect(reloaded.tagCoins).toBe(10);
    expect(reloaded.unlockedSkinIds).toEqual([2, 4]);
  });

  test("applies base-only reward branch", async () => {
    const save = new SaveManager(new CrazyGamesManager());
    const base = await save.loadProfile();
    const updated = await save.grantRoundRewards(base, false, false);
    expect(updated.tagCoins).toBe(base.tagCoins + 40);
  });
});
