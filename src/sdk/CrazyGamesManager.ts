import { ENV } from "../env";

interface CrazyGamesAdCallbacks {
  adStarted: () => void;
  adFinished: () => void;
  adError: (error: unknown) => void;
}

interface CrazyGamesAdModule {
  requestAd?: (
    placement: "midgame" | "rewarded",
    callbacks: CrazyGamesAdCallbacks
  ) => void | Promise<void>;
}

interface CrazyGamesGameModule {
  gameplayStart?: () => void;
  gameplayStop?: () => void;
  submitScore?: (leaderboardId: string, score: number) => void | Promise<void>;
}

interface CrazyGamesUserProfile {
  userId: string;
  username: string;
}

interface CrazyGamesUserModule {
  getUser?: () => CrazyGamesUserProfile | null | Promise<CrazyGamesUserProfile | null>;
}

interface CrazyGamesDataModule {
  getItem?: (key: string) => string | null | Promise<string | null>;
  setItem?: (key: string, value: string) => void | Promise<void>;
}

interface CrazyGamesSdk {
  init?: () => Promise<void>;
  ad?: CrazyGamesAdModule;
  game?: CrazyGamesGameModule;
  user?: CrazyGamesUserModule;
  data?: CrazyGamesDataModule;
}

declare global {
  interface Window {
    CrazyGamesSDK?: CrazyGamesSdk;
  }
}

export class CrazyGamesManager {
  private readonly fallbackStore = new Map<string, string>();
  private initialized = false;
  private static readonly initTimeoutMs = 1200;

  private get sdk(): CrazyGamesSdk | undefined {
    if (typeof window === "undefined") {
      return undefined;
    }
    return window.CrazyGamesSDK;
  }

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }
    const sdk = this.sdk;
    if (sdk?.init !== undefined) {
      try {
        await Promise.race([
          sdk.init(),
          new Promise<void>((resolve) => {
            window.setTimeout(() => resolve(), CrazyGamesManager.initTimeoutMs);
          })
        ]);
      } catch {
        // Non-blocking fallback when SDK init fails.
      }
    }
    this.initialized = true;
  }

  gameplayStart(): void {
    this.sdk?.game?.gameplayStart?.();
  }

  gameplayStop(): void {
    this.sdk?.game?.gameplayStop?.();
  }

  async showMidgameAd(onPauseAndMute: () => void, onResumeAndUnmute: () => void): Promise<void> {
    const requestAd = this.sdk?.ad?.requestAd;
    if (requestAd === undefined) {
      return;
    }

    await new Promise<void>((resolve) => {
      let started = false;
      const finish = (): void => {
        if (started) {
          onResumeAndUnmute();
        }
        resolve();
      };

      const callbacks: CrazyGamesAdCallbacks = {
        adStarted: () => {
          started = true;
          onPauseAndMute();
        },
        adFinished: finish,
        adError: () => finish()
      };

      try {
        const result = requestAd("midgame", callbacks);
        if (result instanceof Promise) {
          result.catch(() => {
            finish();
          });
        }
      } catch {
        finish();
      }
    });
  }

  async getUser(): Promise<CrazyGamesUserProfile | null> {
    const getUser = this.sdk?.user?.getUser;
    if (getUser === undefined) {
      return null;
    }
    const value = getUser();
    if (value instanceof Promise) {
      return value;
    }
    return value;
  }

  async getData(key: string): Promise<string | null> {
    const getItem = this.sdk?.data?.getItem;
    if (getItem === undefined) {
      return this.fallbackStore.get(key) ?? null;
    }
    const value = getItem(key);
    if (value instanceof Promise) {
      return value;
    }
    return value;
  }

  async setData(key: string, value: string): Promise<void> {
    const setItem = this.sdk?.data?.setItem;
    if (setItem === undefined) {
      this.fallbackStore.set(key, value);
      return;
    }
    const result = setItem(key, value);
    if (result instanceof Promise) {
      await result;
    }
  }

  async submitLeaderboardScore(leaderboardId: string, score: number): Promise<boolean> {
    if (!ENV.ENABLE_CG_LEADERBOARD_MVP) {
      return false;
    }
    const submitScore = this.sdk?.game?.submitScore;
    if (submitScore === undefined) {
      return false;
    }
    try {
      const result = submitScore(leaderboardId, score);
      if (result instanceof Promise) {
        await result;
      }
    } catch {
      return false;
    }
    return true;
  }
}
