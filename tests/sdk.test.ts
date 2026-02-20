import { afterEach, describe, expect, test } from "vitest";
import { CrazyGamesManager } from "../src/sdk/CrazyGamesManager";

describe("CrazyGamesManager", () => {
  afterEach(() => {
    delete window.CrazyGamesSDK;
  });

  test("falls back to in-memory data store", async () => {
    const manager = new CrazyGamesManager();
    await manager.setData("key", "value");
    await expect(manager.getData("key")).resolves.toBe("value");
  });

  test("submits leaderboard only when env flag is enabled", async () => {
    window.CrazyGamesSDK = {
      game: {
        submitScore: () => undefined
      }
    };

    const manager = new CrazyGamesManager();
    await expect(manager.submitLeaderboardScore("lb", 10)).resolves.toBe(false);
  });

  test("does not throw if leaderboard submission throws", async () => {
    window.CrazyGamesSDK = {
      game: {
        submitScore: () => {
          throw new Error("submit failed");
        }
      }
    };

    const manager = new CrazyGamesManager();
    await expect(manager.submitLeaderboardScore("lb", 10)).resolves.toBe(false);
  });

  test("init never rejects if sdk init errors", async () => {
    window.CrazyGamesSDK = {
      init: async () => {
        throw new Error("init failed");
      }
    };

    const manager = new CrazyGamesManager();
    await expect(manager.init()).resolves.toBeUndefined();
  });

  test("pauses and resumes around ads", async () => {
    let paused = false;
    let resumed = false;

    window.CrazyGamesSDK = {
      ad: {
        requestAd: (_placement, callbacks) => {
          callbacks.adStarted();
          callbacks.adFinished();
        }
      }
    };

    const manager = new CrazyGamesManager();
    await manager.showMidgameAd(
      () => {
        paused = true;
      },
      () => {
        resumed = true;
      }
    );

    expect(paused).toBe(true);
    expect(resumed).toBe(true);
  });

  test("resumes after ad error", async () => {
    let resumed = false;

    window.CrazyGamesSDK = {
      ad: {
        requestAd: (_placement, callbacks) => {
          callbacks.adStarted();
          callbacks.adError(new Error("ad failed"));
        }
      }
    };

    const manager = new CrazyGamesManager();
    await manager.showMidgameAd(
      () => undefined,
      () => {
        resumed = true;
      }
    );

    expect(resumed).toBe(true);
  });
});
