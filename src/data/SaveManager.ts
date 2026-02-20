import { z } from "zod";
import { CrazyGamesManager } from "../sdk/CrazyGamesManager";

const PROFILE_KEY = "tag_infinity_profile_v1";

export interface SaveProfile {
  tagCoins: number;
  unlockedSkinIds: number[];
}

const profileSchema = z.object({
  tagCoins: z.number().int().nonnegative(),
  unlockedSkinIds: z.array(z.number().int().nonnegative())
});

const defaultProfile = (): SaveProfile => ({
  tagCoins: 0,
  unlockedSkinIds: [0, 1, 2, 3]
});

export class SaveManager {
  private readonly crazyGames: CrazyGamesManager;

  constructor(crazyGames: CrazyGamesManager) {
    this.crazyGames = crazyGames;
  }

  async loadProfile(): Promise<SaveProfile> {
    const raw = await this.crazyGames.getData(PROFILE_KEY);
    if (raw === null) {
      return defaultProfile();
    }

    try {
      const parsed = profileSchema.parse(JSON.parse(raw));
      return {
        tagCoins: parsed.tagCoins,
        unlockedSkinIds: [...new Set(parsed.unlockedSkinIds)].sort((a, b) => a - b)
      };
    } catch {
      return defaultProfile();
    }
  }

  async saveProfile(profile: SaveProfile): Promise<void> {
    const safeProfile = profileSchema.parse({
      tagCoins: Math.max(0, Math.floor(profile.tagCoins)),
      unlockedSkinIds: [...new Set(profile.unlockedSkinIds)].sort((a, b) => a - b)
    });
    await this.crazyGames.setData(PROFILE_KEY, JSON.stringify(safeProfile));
  }

  async grantRoundRewards(
    profile: SaveProfile,
    wonRound: boolean,
    hadBestStreak: boolean
  ): Promise<SaveProfile> {
    const earned = 40 + (wonRound ? 30 : 0) + (hadBestStreak ? 20 : 0);
    const next = {
      ...profile,
      tagCoins: profile.tagCoins + earned
    };
    await this.saveProfile(next);
    return next;
  }

  static readonly skinCosts: readonly number[] = [100, 200, 350, 550, 800, 1100, 1450, 1850];
}