import { Application, Container, Graphics, Text } from "pixi.js";
import { SaveManager } from "../data/SaveManager";
import { RoundSnapshot, RoundManager } from "../game/RoundManager";
import { PlayerId, PlayerInputState, PowerupType } from "../game/types";
import { MapManager } from "../game/map/MapManager";
import { InputManager } from "../input/InputManager";
import { CleanupManager } from "../lifecycle/CleanupManager";
import { CrazyGamesManager } from "../sdk/CrazyGamesManager";
import { AudioEngine } from "./AudioEngine";
import { Scene } from "./Scene";
import { SceneManager } from "./SceneManager";

const VIEW_WIDTH = 640;
const VIEW_HEIGHT = 360;
const AUTO_START_MS = 1500;
const ROUND_DURATION_MS = 90000;
const STAR_COUNT = 56;
const TAG_FLASH_MAX_MS = 160;
const TAG_FX_OFFSETS_X: readonly number[] = [-16, -8, 0, 8, 16, -12, 12, -4, 4];
const TAG_FX_OFFSETS_Y: readonly number[] = [-22, -18, -14, -10, -6, -16, -8, -20, -12];
const PLAYER_COLORS: readonly number[] = [0x7df9ff, 0xffc98f, 0x9fff9f, 0xe4b5ff];
const PLAYER_PANEL_COLORS: readonly number[] = [0xc62d5f, 0x6fb430, 0x7d4a86, 0xc2ad33];
const PLAYER_KEY_LABELS: readonly string[] = ["A D W Q", "LEFT RIGHT UP /", "J L I U", "Y H G T"];
const PLAYER_IDS: readonly PlayerId[] = [0, 1, 2, 3];
const SKIN_COLORS: readonly number[] = [
  0x7df9ff,
  0xffc98f,
  0x9fff9f,
  0xe4b5ff,
  0xff9ca8,
  0xffef96,
  0xa8d0ff,
  0xb4ffda
];

type RuntimeVariant = "classic" | "infinity";
type RuntimeTheme = "classic" | "infinity";

interface RuntimeConfig {
  variant: RuntimeVariant;
  theme: RuntimeTheme;
  title: string;
  powerupsEnabled: boolean;
  skinsEnabled: boolean;
}

const defaultRuntimeConfig: RuntimeConfig = {
  variant: "infinity",
  theme: "infinity",
  title: "Tag Infinity",
  powerupsEnabled: true,
  skinsEnabled: true
};

const sanitizeRuntimeConfig = (value: unknown): RuntimeConfig => {
  if (typeof value !== "object" || value === null) {
    return { ...defaultRuntimeConfig };
  }
  const record = value as Record<string, unknown>;
  const variant = record.variant === "classic" ? "classic" : "infinity";
  const theme = record.theme === "classic" ? "classic" : "infinity";
  const title =
    typeof record.title === "string" && record.title.trim().length > 0
      ? record.title.trim()
      : defaultRuntimeConfig.title;
  const powerupsEnabled =
    typeof record.powerupsEnabled === "boolean"
      ? record.powerupsEnabled
      : variant === "infinity";
  const skinsEnabled =
    typeof record.skinsEnabled === "boolean"
      ? record.skinsEnabled
      : variant === "infinity";
  return { variant, theme, title, powerupsEnabled, skinsEnabled };
};

const loadRuntimeConfig = async (): Promise<RuntimeConfig> => {
  if (typeof window === "undefined") {
    return { ...defaultRuntimeConfig };
  }
  try {
    const response = await fetch("./runtime-config.json", { cache: "no-store" });
    if (!response.ok) {
      return { ...defaultRuntimeConfig };
    }
    return sanitizeRuntimeConfig(await response.json());
  } catch {
    return { ...defaultRuntimeConfig };
  }
};

const normalizeTitle = (value: string): string => value.toUpperCase().replace(/\s+/g, " ").trim();

const drawPixelPanel = (
  graphics: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  fillColor: number,
  borderColor: number,
  highlightColor: number
): void => {
  graphics.rect(x, y, width, height).fill(fillColor);
  graphics.rect(x, y, width, 2).fill(highlightColor);
  graphics.rect(x, y, 2, height).fill(highlightColor);
  graphics.rect(x, y + height - 2, width, 2).fill(borderColor);
  graphics.rect(x + width - 2, y, 2, height).fill(borderColor);
};

const getPowerupColor = (type: PowerupType): number => {
  switch (type) {
    case "HyperDash":
      return 0xff7d7d;
    case "BlinkStep":
      return 0x88d7ff;
    case "IceMine":
      return 0xa7f7ff;
    case "TagShield":
      return 0x9fff9f;
    case "PhaseCloak":
      return 0xc39bff;
    case "ScoreSurge":
      return 0xffeb88;
    case "LowGrav":
      return 0xb9d8ff;
    case "SwapZap":
      return 0xffa6f8;
    case "TimeCrush":
      return 0xff9d7d;
    case "DecoyClone":
      return 0x9ae5cc;
    case "RocketHop":
      return 0xffb08f;
    case "EMPBurst":
      return 0xd9f3ff;
    default:
      return 0x7df9ff;
  }
};

class LoadingScene extends Scene {
  private readonly runtimeConfig: RuntimeConfig;
  private readonly backgroundLayer = new Graphics();
  private readonly uiLayer = new Graphics();
  private readonly barLayer = new Graphics();
  private readonly titleText = new Text({
    text: "",
    style: {
      fill: "#eaf2ff",
      fontFamily: "Courier New, monospace",
      fontSize: 24,
      fontWeight: "700",
      letterSpacing: 1
    }
  });
  private readonly subtitleText = new Text({
    text: "Loading",
    style: {
      fill: "#9ac9ff",
      fontFamily: "Courier New, monospace",
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 1
    }
  });
  private elapsedMs = 0;
  private barTimerMs = 0;
  private dots = 0;

  constructor(runtimeConfig: RuntimeConfig) {
    super();
    this.runtimeConfig = runtimeConfig;
    this.titleText.text = normalizeTitle(runtimeConfig.title);
  }

  onEnter(): void {
    this.backgroundLayer.clear();
    const dark = this.runtimeConfig.theme === "classic" ? 0x071018 : 0x05070d;
    const toneA = this.runtimeConfig.theme === "classic" ? 0x0d1b2a : 0x070e19;
    const toneB = this.runtimeConfig.theme === "classic" ? 0x122237 : 0x0a1220;
    this.backgroundLayer.rect(0, 0, VIEW_WIDTH, VIEW_HEIGHT).fill(dark);
    for (let y = 0; y < VIEW_HEIGHT; y += 16) {
      for (let x = 0; x < VIEW_WIDTH; x += 16) {
        const tone = ((x + y) / 16) % 2 === 0 ? toneA : toneB;
        this.backgroundLayer.rect(x, y, 16, 16).fill(tone);
      }
    }

    this.uiLayer.clear();
    const fill = this.runtimeConfig.theme === "classic" ? 0x112236 : 0x0b1426;
    const border = this.runtimeConfig.theme === "classic" ? 0x2e4c6d : 0x21385a;
    const highlight = this.runtimeConfig.theme === "classic" ? 0x7fb9f0 : 0x5f8bc2;
    drawPixelPanel(this.uiLayer, 168, 118, 304, 124, fill, border, highlight);
    this.uiLayer.rect(188, 182, 264, 1).fill(this.runtimeConfig.theme === "classic" ? 0x24415f : 0x1a2b45);

    this.titleText.anchor.set(0.5, 0);
    this.titleText.position.set(VIEW_WIDTH / 2, 138);
    this.subtitleText.anchor.set(0.5, 0);
    this.subtitleText.position.set(VIEW_WIDTH / 2, 196);

    this.addChild(this.backgroundLayer);
    this.addChild(this.uiLayer);
    this.addChild(this.barLayer);
    this.addChild(this.titleText);
    this.addChild(this.subtitleText);
  }

  update(deltaMs: number): void {
    this.elapsedMs += deltaMs;
    this.barTimerMs += deltaMs;
    if (this.elapsedMs >= 250) {
      this.elapsedMs -= 250;
      this.dots = (this.dots + 1) % 4;
      this.subtitleText.text = `Loading${".".repeat(this.dots)}`;
    }

    const cycle = (this.barTimerMs % 1600) / 1600;
    const wave = cycle < 0.5 ? cycle * 2 : (1 - cycle) * 2;
    const fillWidth = Math.round(24 + 216 * wave);

    this.barLayer.clear();
    drawPixelPanel(this.barLayer, 188, 206, 264, 18, 0x091428, 0x1e3658, 0x4f76a4);
    this.barLayer.rect(192, 210, fillWidth, 10).fill(this.runtimeConfig.theme === "classic" ? 0x8ed6ff : 0x7df9ff);
  }
}

class GameplayScene extends Scene {
  private readonly runtimeConfig: RuntimeConfig;
  private readonly inputManager = new InputManager();
  private readonly mapLayer = new Graphics();
  private readonly actorLayer = new Graphics();
  private readonly fxLayer = new Graphics();
  private readonly uiLayer = new Graphics();
  private readonly titleText = new Text({
    text: "",
    style: {
      fill: "#eaf2ff",
      fontFamily: "Courier New, monospace",
      fontSize: 18,
      fontWeight: "700",
      letterSpacing: 1
    }
  });
  private readonly topText = new Text({
    text: "",
    style: {
      fill: "#d5e6ff",
      fontFamily: "Courier New, monospace",
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 1
    }
  });
  private readonly bottomText = new Text({
    text: "",
    style: {
      fill: "#d5e6ff",
      fontFamily: "Courier New, monospace",
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 1
    }
  });
  private readonly timerText = new Text({
    text: "",
    style: {
      fill: "#ffffff",
      fontFamily: "Courier New, monospace",
      fontSize: 30,
      fontWeight: "900",
      stroke: { color: "#000000", width: 5, join: "round" },
      letterSpacing: 1
    }
  });
  private readonly overlayText = new Text({
    text: "",
    style: {
      fill: "#ffffff",
      fontFamily: "Courier New, monospace",
      fontSize: 26,
      fontWeight: "900",
      stroke: { color: "#000000", width: 5, join: "round" },
      letterSpacing: 1
    }
  });
  private readonly roundManager: RoundManager;
  private sessionStarting = false;
  private sessionStarted = false;
  private disposed = false;
  private aiEnabled = true;
  private aiToggleLatch = false;
  private autoStartTimerMs = 0;
  private lastRenderedMapId: string | null = null;
  private lastTitleText = "";
  private lastTopText = "";
  private lastBottomText = "";
  private lobbyStaticReady = false;
  private lobbyScrollMs = 0;
  private fxTimerMs = 0;
  private readonly audio = new AudioEngine();
  private lastItPlayerId: PlayerId | null = null;
  private wasSessionComplete = false;
  private readonly previousOnGround: Record<PlayerId, boolean> = {
    0: false,
    1: false,
    2: false,
    3: false
  };
  private readonly previousVelocityY: Record<PlayerId, number> = {
    0: 0,
    1: 0,
    2: 0,
    3: 0
  };
  private readonly previousPowerup: Record<PlayerId, PowerupType | null> = {
    0: null,
    1: null,
    2: null,
    3: null
  };
  private readonly stepCooldownMs: Record<PlayerId, number> = {
    0: 0,
    1: 0,
    2: 0,
    3: 0
  };
  private readonly lobbyStarX: number[] = new Array<number>(STAR_COUNT).fill(0);
  private readonly lobbyStarY: number[] = new Array<number>(STAR_COUNT).fill(0);
  private readonly lobbyStarSpeed: number[] = new Array<number>(STAR_COUNT).fill(0);
  private readonly lobbyStarSize: number[] = new Array<number>(STAR_COUNT).fill(0);
  private readonly lobbyStarPhase: number[] = new Array<number>(STAR_COUNT).fill(0);
  private readonly lobbyStarColor: number[] = new Array<number>(STAR_COUNT).fill(0);

  constructor(crazyGames: CrazyGamesManager, runtimeConfig: RuntimeConfig) {
    super();
    this.runtimeConfig = runtimeConfig;
    const saveManager = new SaveManager(crazyGames);
    const mapManager = new MapManager();
    this.roundManager = new RoundManager(mapManager, saveManager, crazyGames, this.setMuted);
    this.titleText.text = normalizeTitle(runtimeConfig.title);

    let seed = 20260219;
    for (let index = 0; index < STAR_COUNT; index += 1) {
      seed = (1664525 * seed + 1013904223) >>> 0;
      this.lobbyStarX[index] = seed % VIEW_WIDTH;
      seed = (1664525 * seed + 1013904223) >>> 0;
      this.lobbyStarY[index] = seed % VIEW_HEIGHT;
      seed = (1664525 * seed + 1013904223) >>> 0;
      this.lobbyStarSpeed[index] = 8 + (seed % 36);
      seed = (1664525 * seed + 1013904223) >>> 0;
      this.lobbyStarSize[index] = 1 + (seed % 2);
      seed = (1664525 * seed + 1013904223) >>> 0;
      this.lobbyStarPhase[index] = seed % VIEW_HEIGHT;
      seed = (1664525 * seed + 1013904223) >>> 0;
      this.lobbyStarColor[index] = (seed & 1) === 0 ? 0x5d86bf : 0x91bfff;
    }
  }

  private readonly setMuted = (muted: boolean): void => {
    this.audio.setMuted(muted);
  };

  onEnter(): void {
    this.disposed = false;
    this.sessionStarting = false;
    this.sessionStarted = false;
    this.autoStartTimerMs = 0;
    this.lobbyScrollMs = 0;
    this.lobbyStaticReady = false;
    this.lastItPlayerId = null;
    this.wasSessionComplete = false;
    for (const playerId of PLAYER_IDS) {
      this.previousOnGround[playerId] = false;
      this.previousVelocityY[playerId] = 0;
      this.previousPowerup[playerId] = null;
      this.stepCooldownMs[playerId] = 0;
    }
    this.audio.setMuted(false);

    this.titleText.anchor.set(0.5, 0);
    this.titleText.position.set(VIEW_WIDTH / 2, 10);
    this.topText.position.set(16, 56);
    this.bottomText.position.set(16, VIEW_HEIGHT - 44);
    this.timerText.anchor.set(0.5, 0);
    this.timerText.position.set(VIEW_WIDTH / 2, 14);
    this.overlayText.anchor.set(0.5);
    this.overlayText.position.set(VIEW_WIDTH / 2, VIEW_HEIGHT / 2);

    this.addChild(this.mapLayer);
    this.addChild(this.actorLayer);
    this.addChild(this.fxLayer);
    this.addChild(this.uiLayer);
    this.addChild(this.titleText);
    this.addChild(this.timerText);
    this.addChild(this.overlayText);
    this.addChild(this.topText);
    this.addChild(this.bottomText);

    this.cleanupManager.addEventListener(window, "keydown", this.onKeyDown);
    this.cleanupManager.addEventListener(window, "keyup", this.onKeyUp);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    this.audio.unlock();
    if (this.sessionStarted || this.sessionStarting) {
      return;
    }
    if (event.code !== "KeyO" || this.aiToggleLatch) {
      return;
    }
    event.preventDefault();
    this.aiToggleLatch = true;
    this.aiEnabled = !this.aiEnabled;
    this.audio.playUiConfirm();
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.audio.unlock();
    if (event.code !== "KeyO") {
      return;
    }
    event.preventDefault();
    this.aiToggleLatch = false;
  };

  private shouldUnlockAudio(inputs: Record<PlayerId, PlayerInputState>): boolean {
    for (const playerId of PLAYER_IDS) {
      const state = inputs[playerId];
      if (state.joined || state.left || state.right || state.jump || state.ability) {
        return true;
      }
    }
    return false;
  }

  private syncAudio(snapshot: RoundSnapshot, deltaMs: number): void {
    const elapsedRatio = 1 - snapshot.roundTimeLeftMs / ROUND_DURATION_MS;
    const tagPulse = snapshot.tagFlashMs > 0 ? 0.18 : 0;
    const intensity = snapshot.sessionComplete ? 0.18 : 0.26 + elapsedRatio * 0.5 + tagPulse;
    this.audio.update(deltaMs, intensity);

    if (this.lastItPlayerId !== null && this.lastItPlayerId !== snapshot.itPlayerId) {
      this.audio.playTag();
    }

    for (const playerId of snapshot.joinedPlayers) {
      const player = snapshot.players[playerId];
      const wasGrounded = this.previousOnGround[playerId];
      const previousVelocityY = this.previousVelocityY[playerId];
      const previousPowerup = this.previousPowerup[playerId];

      this.stepCooldownMs[playerId] = Math.max(0, this.stepCooldownMs[playerId] - deltaMs);

      if (wasGrounded && !player.onGround && player.velocity.y < -220) {
        this.audio.playJump();
      } else if (!wasGrounded && player.onGround && previousVelocityY > 220) {
        this.audio.playLand(previousVelocityY / 560);
      }

      if (previousPowerup === null && player.activePowerup !== null) {
        this.audio.playPickup();
      } else if (previousPowerup !== null && player.activePowerup === null && player.powerupCooldown > 0) {
        this.audio.playPowerup();
      }

      if (player.onGround && Math.abs(player.velocity.x) > 105 && this.stepCooldownMs[playerId] <= 0) {
        this.audio.playStep(playerId === snapshot.itPlayerId ? "it" : "normal");
        this.stepCooldownMs[playerId] = playerId === snapshot.itPlayerId ? 92 : 118;
      }

      this.previousOnGround[playerId] = player.onGround;
      this.previousVelocityY[playerId] = player.velocity.y;
      this.previousPowerup[playerId] = player.activePowerup;
    }

    if (!this.wasSessionComplete && snapshot.sessionComplete) {
      this.audio.playRoundEnd();
    }
    this.wasSessionComplete = snapshot.sessionComplete;
    this.lastItPlayerId = snapshot.itPlayerId;
  }

  private applyTitleText(next: string): void {
    if (next === this.lastTitleText) {
      return;
    }
    this.lastTitleText = next;
    this.titleText.text = next;
  }

  private applyTopText(next: string): void {
    if (next === this.lastTopText) {
      return;
    }
    this.lastTopText = next;
    this.topText.text = next;
  }

  private applyBottomText(next: string): void {
    if (next === this.lastBottomText) {
      return;
    }
    this.lastBottomText = next;
    this.bottomText.text = next;
  }

  private tryStartSession(deltaMs: number): void {
    if (this.sessionStarted || this.sessionStarting) {
      return;
    }

    const joinedPlayers = this.inputManager.getJoinedPlayers();
    if (joinedPlayers.length === 0) {
      this.autoStartTimerMs += deltaMs;
      if (this.autoStartTimerMs < AUTO_START_MS) {
        return;
      }
    } else {
      this.autoStartTimerMs = 0;
    }

    const sessionPlayers = joinedPlayers.length > 0 ? [...joinedPlayers] : ([0] as const);

    this.sessionStarting = true;
    void this.roundManager
      .initSession([...sessionPlayers], {
        ghostEnabled: this.aiEnabled,
        powerupsEnabled: this.runtimeConfig.powerupsEnabled
      })
      .then(() => {
        if (this.disposed) {
          return;
        }
        this.audio.playUiConfirm();
        this.sessionStarted = true;
        const snapshot = this.roundManager.getSnapshot();
        this.lastItPlayerId = snapshot.itPlayerId;
        this.wasSessionComplete = snapshot.sessionComplete;
        for (const playerId of PLAYER_IDS) {
          const player = snapshot.players[playerId];
          this.previousOnGround[playerId] = player.onGround;
          this.previousVelocityY[playerId] = player.velocity.y;
          this.previousPowerup[playerId] = player.activePowerup;
          this.stepCooldownMs[playerId] = 0;
        }
      })
      .catch(() => {
        if (this.disposed) {
          return;
        }
        this.sessionStarted = false;
      })
      .finally(() => {
        if (this.disposed) {
          return;
        }
        this.sessionStarting = false;
      });
  }

  private renderLobby(deltaMs: number): void {
    if (!this.lobbyStaticReady) {
      this.lobbyStaticReady = true;
      this.lastRenderedMapId = null;
      this.mapLayer.clear();
      this.mapLayer.rect(0, 0, VIEW_WIDTH, VIEW_HEIGHT).fill(0x05070d);
      for (let y = 0; y < VIEW_HEIGHT; y += 16) {
        for (let x = 0; x < VIEW_WIDTH; x += 16) {
          const tone = ((x + y) / 16) % 2 === 0 ? 0x070e1a : 0x0b1322;
          this.mapLayer.rect(x, y, 16, 16).fill(tone);
        }
      }
      this.mapLayer.rect(0, 52, VIEW_WIDTH, 1).fill(0x1b2c48);
      this.mapLayer.rect(0, VIEW_HEIGHT - 60, VIEW_WIDTH, 1).fill(0x1b2c48);
    }

    this.actorLayer.clear();
    this.fxLayer.clear();
    this.uiLayer.clear();

    this.lobbyScrollMs += deltaMs;
    for (let index = 0; index < STAR_COUNT; index += 1) {
      const starX = this.lobbyStarX[index] ?? 0;
      const starY = this.lobbyStarY[index] ?? 0;
      const starSpeed = this.lobbyStarSpeed[index] ?? 0;
      const starSize = this.lobbyStarSize[index] ?? 1;
      const starPhase = this.lobbyStarPhase[index] ?? 0;
      const starColor = this.lobbyStarColor[index] ?? 0x5d86bf;
      const rawY =
        starY +
        starPhase +
        (this.lobbyScrollMs * starSpeed) / 1000;
      const wrappedY = rawY % VIEW_HEIGHT;
      const y = wrappedY < 0 ? wrappedY + VIEW_HEIGHT : wrappedY;
      this.fxLayer
        .rect(starX, Math.floor(y), starSize, starSize)
        .fill(starColor);
    }

    const joined = this.inputManager.getJoinedPlayers();
    const joinedSet = new Set(joined);
    let joinedLabel = "NONE";
    if (joined.length > 0) {
      joinedLabel = "";
      for (let index = 0; index < joined.length; index += 1) {
        if (index > 0) {
          joinedLabel += " ";
        }
        const playerId = joined[index];
        if (playerId !== undefined) {
          joinedLabel += `P${playerId + 1}`;
        }
      }
    }

    const panelW = 206;
    const panelH = 96;
    const leftX = 66;
    const rightX = VIEW_WIDTH - leftX - panelW;
    const topY = 72;
    const bottomY = 178;
    const centerX = 248;
    const centerW = 144;

    for (let playerId = 0; playerId < 4; playerId += 1) {
      const isLeft = playerId % 2 === 0;
      const isTop = playerId < 2;
      const x = isLeft ? leftX : rightX;
      const y = isTop ? topY : bottomY;
      const panelColor = PLAYER_PANEL_COLORS[playerId] ?? 0x2b3e5d;
      const joinedPlayer = joinedSet.has(playerId as 0 | 1 | 2 | 3);
      const bodyColor = joinedPlayer ? panelColor : 0x3a3f4a;
      const borderColor = joinedPlayer ? 0x10192a : 0x1d2330;
      const highlightColor = joinedPlayer ? 0xffffff : 0x616a7a;

      drawPixelPanel(this.uiLayer, x, y, panelW, panelH, bodyColor, borderColor, highlightColor);
      this.uiLayer.rect(x + 12, y + 18, 28, 28).fill(joinedPlayer ? 0xf0f5ff : 0x80889a);
      this.uiLayer.rect(x + 14, y + 20, 24, 24).fill(joinedPlayer ? 0x111c30 : 0x566074);
      this.uiLayer.rect(x + 18, y + 26, 16, 12).fill(joinedPlayer ? panelColor : 0x80889a);

      if (!joinedPlayer) {
        this.uiLayer.rect(x + 12, y + 18, 28, 2).fill(0x101726);
        this.uiLayer.rect(x + 12, y + 44, 28, 2).fill(0x101726);
      }

      const nameX = isLeft ? x + 10 : x + panelW - 48;
      const keys = PLAYER_KEY_LABELS[playerId] ?? "";
      this.uiLayer.rect(x + 54, y + 28, 140, 22).fill(0xffffff);
      this.uiLayer.rect(x + 56, y + 30, 136, 18).fill(0x111e33);
      if (keys.length > 0) {
        const charWidth = 6;
        const width = Math.min(132, keys.length * charWidth);
        this.uiLayer.rect(x + 58, y + 36, width, 4).fill(0xffffff);
      }
      this.uiLayer.rect(nameX, y + 6, 34, 12).fill(0xffffff);
      this.uiLayer.rect(nameX + 2, y + 8, 30, 8).fill(0x111e33);
      this.uiLayer.rect(x + 76, y + 58, 22, 14).fill(0x111e33);
      this.uiLayer.rect(x + 102, y + 58, 14, 14).fill(0xffffff);
      this.uiLayer.rect(x + 104, y + 60, 10, 10).fill(joinedPlayer ? 0x9bff9b : 0x8f97a5);
    }

    drawPixelPanel(this.uiLayer, centerX, topY, centerW, 60, 0x77a5dc, 0x1c3151, 0xffffff);
    this.uiLayer.rect(centerX + 41, topY + 18, 62, 26).fill(0x111e33);
    this.uiLayer.rect(centerX + 58, topY + 24, 28, 14).fill(this.aiEnabled ? 0x8ff88f : 0xff8f8f);
    drawPixelPanel(this.uiLayer, centerX, topY + 66, centerW, 126, 0x9aa7bd, 0x253b5c, 0xeaf2ff);
    this.uiLayer.rect(centerX + 20, topY + 92, 24, 24).fill(0x4d7db7);
    this.uiLayer.rect(centerX + 52, topY + 92, 24, 24).fill(0x75af43);
    this.uiLayer.rect(centerX + 84, topY + 92, 24, 24).fill(0xbf5f6f);
    this.uiLayer.rect(centerX + 26, topY + 126, 92, 18).fill(0xffffff);
    this.uiLayer.rect(centerX + 28, topY + 128, 88, 14).fill(0x111e33);
    this.uiLayer.rect(centerX + 44, topY + 152, 56, 18).fill(0xffffff);
    this.uiLayer.rect(centerX + 46, topY + 154, 52, 14).fill(0x29d449);
    this.uiLayer.rect(centerX + 64, topY + 170, 16, 10).fill(0x111e33);

    drawPixelPanel(this.uiLayer, 92, 286, 456, 54, 0x091225, 0x1b3254, 0x4f76a4);
    const countdown = Math.max(0, AUTO_START_MS - this.autoStartTimerMs);
    const topText = [
      normalizeTitle(this.runtimeConfig.title),
      `JOINED: ${joinedLabel}`,
      `AI CPU: ${this.aiEnabled ? "ON" : "OFF"}   [O] TOGGLE`,
      joined.length === 0
        ? `AUTO STARTING AS P1 IN ${(countdown / 1000).toFixed(1)}S`
        : "MOVE OR JUMP TO START"
    ].join("\n");

    const bottomText =
      "P1 A D W Q   P2 LEFT RIGHT UP /   P3 J L I U   P4 Y H G T\n" +
      `GAMEPAD: STICK/DPAD MOVE, A JUMP, B ABILITY  MODE: ${this.runtimeConfig.variant.toUpperCase()}`;

    this.applyTitleText(normalizeTitle(this.runtimeConfig.title));
    this.applyTopText(topText);
    this.applyBottomText(bottomText);
    this.timerText.text = "";
    this.overlayText.text = "";
  }

  private drawThemedBackdrop(mapId: string): void {
    const classic = this.runtimeConfig.theme === "classic";
    if (mapId === "arcade-foundry") {
      this.mapLayer.rect(0, 0, VIEW_WIDTH, VIEW_HEIGHT).fill(classic ? 0x3b2d2d : 0x27192e);
      this.mapLayer.rect(0, 220, VIEW_WIDTH, 140).fill(classic ? 0x241818 : 0x1a1023);
      this.mapLayer.rect(60, 122, 220, 28).fill(classic ? 0xd86f42 : 0xff8a4f);
      this.mapLayer.rect(74, 134, 192, 10).fill(classic ? 0xf4c06a : 0xffcc73);
      this.mapLayer.rect(78, 144, 184, 44).fill(classic ? 0xbc5738 : 0xff6b42);
      this.mapLayer.rect(0, 328, VIEW_WIDTH, 32).fill(classic ? 0x623138 : 0x8c2f3a);
      for (let x = 0; x < VIEW_WIDTH; x += 32) {
        this.mapLayer.rect(x + 6, 334, 20, 8).fill(classic ? 0xe2a15d : 0xffb45f);
      }
      return;
    }

    this.mapLayer.rect(0, 0, VIEW_WIDTH, VIEW_HEIGHT).fill(classic ? 0x7ea4d0 : 0x7ad6ee);
    this.mapLayer.rect(0, 170, VIEW_WIDTH, 190).fill(
      mapId === "sewer-scramble" ? (classic ? 0x2d595c : 0x0e6f74) : classic ? 0x2f705f : 0x0f8677
    );
    this.mapLayer.rect(40, 92, 220, 62).fill(classic ? 0xb9cee6 : 0xddeaf7);
    this.mapLayer.rect(230, 80, 280, 76).fill(classic ? 0xc7d9ec : 0xe6f0fb);
    this.mapLayer.rect(130, 112, 360, 112).fill(classic ? 0x2f8bc0 : 0x1ca5d8);
    this.mapLayer.rect(182, 124, 280, 100).fill(classic ? 0x2577a8 : 0x188abf);
    this.mapLayer.rect(46, 190, 102, 96).fill(classic ? 0x256356 : 0x0f7d6f);
    this.mapLayer.rect(496, 180, 96, 108).fill(classic ? 0x256356 : 0x0f7d6f);
    this.mapLayer.rect(220, 210, 180, 76).fill(classic ? 0x204f49 : 0x0f675e);
    if (mapId === "sewer-scramble") {
      this.mapLayer.rect(0, 300, VIEW_WIDTH, 60).fill(classic ? 0x3a4e5f : 0x264247);
      this.mapLayer.rect(38, 286, 72, 32).fill(classic ? 0x567182 : 0x3b5b56);
      this.mapLayer.rect(532, 282, 78, 36).fill(classic ? 0x567182 : 0x3b5b56);
    }
  }

  private drawMap(snapshot: RoundSnapshot): void {
    this.mapLayer.clear();
    this.drawThemedBackdrop(snapshot.map.id);

    const tileSize = snapshot.map.tileSize;
    for (const tile of snapshot.map.solidTiles) {
      const x = tile.x * tileSize;
      const y = tile.y * tileSize;
      const onFoundry = snapshot.map.id === "arcade-foundry";
      const classic = this.runtimeConfig.theme === "classic";
      const baseColor = onFoundry
        ? ((tile.x + tile.y) & 1) === 0
          ? classic
            ? 0x5c4a42
            : 0x703342
          : classic
            ? 0x70594f
            : 0x8b3f4f
        : ((tile.x + tile.y) & 1) === 0
          ? classic
            ? 0x425f73
            : 0x3f2f66
          : classic
            ? 0x4b6d84
            : 0x4b3b74;
      this.mapLayer.rect(x, y, tileSize, tileSize).fill(baseColor);
      this.mapLayer.rect(x, y, tileSize, 2).fill(onFoundry ? (classic ? 0xd3a67a : 0xff965f) : classic ? 0x8fd1a2 : 0x68d46c);
      this.mapLayer.rect(x, y + tileSize - 2, tileSize, 2).fill(onFoundry ? (classic ? 0x3e2d22 : 0x432033) : classic ? 0x24344f : 0x231642);
      this.mapLayer.rect(x, y, 2, tileSize).fill(onFoundry ? (classic ? 0xb7835f : 0xd66b54) : classic ? 0x6aa18b : 0x57ad5a);
      this.mapLayer.rect(x + tileSize - 2, y, 2, tileSize).fill(onFoundry ? (classic ? 0x2b1b12 : 0x351428) : classic ? 0x1f3048 : 0x1d1538);
      if (!onFoundry && ((tile.x + tile.y) & 1) === 0) {
        this.mapLayer.rect(x + 4, y + 4, 2, 2).fill(classic ? 0xcce5ff : 0xffe7a8);
      }
    }

    for (const jumpLink of snapshot.map.jumpLinks) {
      const fromX = jumpLink.from.x * tileSize + 7;
      const fromY = jumpLink.from.y * tileSize + 7;
      const toX = jumpLink.to.x * tileSize + 7;
      const toY = jumpLink.to.y * tileSize + 7;
      this.mapLayer.rect(fromX, fromY, 2, 2).fill(0x7df9ff);
      this.mapLayer.rect(toX, toY, 2, 2).fill(0xffcc8a);
    }

    this.mapLayer.rect(0, 0, VIEW_WIDTH, 2).fill(0x111f36);
    this.mapLayer.rect(0, VIEW_HEIGHT - 2, VIEW_WIDTH, 2).fill(0x111f36);
    this.mapLayer.rect(0, 0, 2, VIEW_HEIGHT).fill(0x111f36);
    this.mapLayer.rect(VIEW_WIDTH - 2, 0, 2, VIEW_HEIGHT).fill(0x111f36);
  }

  private drawPickupItems(snapshot: RoundSnapshot): void {
    const pulse = (Math.floor(this.fxTimerMs / 140) & 1) === 0;
    for (const pickup of snapshot.pickupItems) {
      const x = Math.round(pickup.position.x);
      const y = Math.round(pickup.position.y);
      const color = getPowerupColor(pickup.type);
      this.actorLayer.rect(x - 5, y - 5, 10, 10).fill(0x0d1a2f);
      this.actorLayer.rect(x - 4, y - 4, 8, 8).fill(0x223d63);
      this.actorLayer.rect(x - 2, y - 2, 4, 4).fill(color);
      if (pulse) {
        this.actorLayer.rect(x - 1, y - 6, 2, 1).fill(0xffffff);
      }
    }
  }

  private resolveHumanColor(snapshot: RoundSnapshot, playerId: PlayerId): number {
    const fallback = PLAYER_COLORS[playerId] ?? 0x7df9ff;
    if (!this.runtimeConfig.skinsEnabled) {
      return fallback;
    }

    const unlocked = snapshot.profile.unlockedSkinIds;
    if (unlocked.length === 0) {
      return fallback;
    }

    const skinId = unlocked[playerId % unlocked.length];
    if (skinId === undefined) {
      return fallback;
    }
    const roundOffset = Math.max(0, snapshot.roundIndex - 1);
    const rotatingSkinId = unlocked[(playerId + roundOffset) % unlocked.length] ?? skinId;
    return SKIN_COLORS[Math.abs(rotatingSkinId) % SKIN_COLORS.length] ?? fallback;
  }

  private drawPlayers(snapshot: RoundSnapshot): void {
    this.actorLayer.clear();
    this.drawPickupItems(snapshot);

    const itFlashColor = snapshot.tagFlashMs > 0 ? 0xffffff : 0xff5555;
    for (const playerId of snapshot.joinedPlayers) {
      const player = snapshot.players[playerId];
      const speed = Math.abs(player.velocity.x);
      const runPhase = this.fxTimerMs * (0.012 + speed * 0.00008) + playerId * 1.4;
      const bob = player.onGround ? Math.sin(runPhase) * Math.min(2, speed / 115) : Math.sin(runPhase * 0.5);
      const squash = player.onGround
        ? Math.min(1.7, speed / 160)
        : Math.min(2.2, Math.abs(player.velocity.y) / 240);
      const stretchY = player.onGround
        ? -squash * 0.45
        : player.velocity.y < 0
          ? -squash * 0.75
          : squash;
      const bodyWidth = Math.max(8, Math.round(player.width + squash));
      const bodyHeight = Math.max(14, Math.round(player.height - stretchY));
      const x = Math.round(player.position.x - bodyWidth / 2);
      const y = Math.round(player.position.y - bodyHeight + bob);
      const humanColor = this.resolveHumanColor(snapshot, playerId);
      const color =
        playerId === snapshot.itPlayerId
          ? itFlashColor
          : player.isHuman
            ? humanColor
            : 0xffcc8a;

      if (playerId === snapshot.itPlayerId && speed > 90) {
        const trailOffset = player.facing > 0 ? -4 : 4;
        this.actorLayer.rect(x + trailOffset * 2, y + 4, bodyWidth - 2, Math.max(6, bodyHeight - 8)).fill(0x4b1d2d);
        this.actorLayer.rect(x + trailOffset, y + 2, bodyWidth - 1, Math.max(8, bodyHeight - 6)).fill(0x7a2c44);
      }

      this.actorLayer.rect(x + 1, y + bodyHeight, Math.max(4, bodyWidth - 2), 2).fill(0x101b30);
      this.actorLayer
        .rect(x, y + 2, bodyWidth, bodyHeight)
        .fill(0x0c1629)
        .rect(x - 1, y - 1, bodyWidth + 2, bodyHeight + 2)
        .fill(0x17253f)
        .rect(x, y, bodyWidth, bodyHeight)
        .fill(color);

      const blink = (Math.floor((this.fxTimerMs + playerId * 120) / 860) % 11) === 0;
      const eyeX = player.facing > 0 ? x + bodyWidth - 4 : x + 2;
      const eyeY = y + Math.max(4, Math.floor(bodyHeight * 0.35));
      this.actorLayer.rect(eyeX, eyeY, 2, blink ? 1 : 2).fill(0x10203a);

      if (player.onGround && speed > 70) {
        const footLift = Math.sin(runPhase) > 0 ? 1 : 0;
        this.actorLayer.rect(x + 2, y + bodyHeight - 2 - footLift, 2, 2).fill(0x0e1a2e);
        this.actorLayer.rect(x + bodyWidth - 4, y + bodyHeight - 2 + footLift, 2, 2).fill(0x0e1a2e);
      }

      if (player.activePowerup !== null) {
        const powerupColor = getPowerupColor(player.activePowerup);
        const iconX = x + Math.floor(bodyWidth / 2);
        this.actorLayer.rect(iconX - 2, y - 6, 4, 4).fill(0x0e1930);
        this.actorLayer.rect(iconX - 1, y - 5, 2, 2).fill(powerupColor);
      }

      if (playerId === snapshot.itPlayerId) {
        const markerX = x + Math.floor(bodyWidth / 2);
        this.actorLayer.rect(markerX - 1, y - 10, 3, 2).fill(0xffffff);
        this.actorLayer.rect(markerX, y - 8, 1, 2).fill(0xff7d7d);
      }
    }
  }

  private drawTagFx(snapshot: RoundSnapshot): void {
    this.fxLayer.clear();
    const pulse = (Math.floor(this.fxTimerMs / 90) & 1) === 0;
    for (const playerId of snapshot.joinedPlayers) {
      const player = snapshot.players[playerId];
      if (!player.onGround || Math.abs(player.velocity.x) < 72) {
        continue;
      }

      const baseX = Math.round(player.position.x - player.facing * 6);
      const baseY = Math.round(player.position.y - 1);
      const dustColor = playerId === snapshot.itPlayerId ? 0xffbdbd : 0x94ceff;
      this.fxLayer.rect(baseX, baseY, 2, 2).fill(dustColor);
      if (pulse) {
        this.fxLayer.rect(baseX + player.facing * 2, baseY + 2, 1, 1).fill(0xdff0ff);
      }
    }

    if (snapshot.tagFlashMs <= 0) {
      return;
    }

    const itPlayer = snapshot.players[snapshot.itPlayerId];
    const remainingRatio = snapshot.tagFlashMs / TAG_FLASH_MAX_MS;
    const expansion = 1 + Math.floor((1 - remainingRatio) * 4);

    for (let index = 0; index < TAG_FX_OFFSETS_X.length; index += 1) {
      const offsetX = TAG_FX_OFFSETS_X[index];
      const offsetY = TAG_FX_OFFSETS_Y[index];
      if (offsetX === undefined || offsetY === undefined) {
        continue;
      }
      const x = Math.round(itPlayer.position.x + offsetX * expansion);
      const y = Math.round(itPlayer.position.y + offsetY);
      this.fxLayer.rect(x, y, 2, 2).fill(0xffffff);
    }

    this.fxLayer.rect(0, 0, VIEW_WIDTH, 2).fill(0xf4fbff);
    this.fxLayer.rect(0, VIEW_HEIGHT - 2, VIEW_WIDTH, 2).fill(0xf4fbff);
  }

  private applyTagShake(snapshot: RoundSnapshot): void {
    if (snapshot.tagFlashMs <= 0) {
      this.actorLayer.position.set(0, 0);
      this.fxLayer.position.set(0, 0);
      return;
    }

    const phase = Math.floor((TAG_FLASH_MAX_MS - snapshot.tagFlashMs) / 20) & 3;
    const magnitude = 1 + Math.floor(snapshot.tagFlashMs / 80);
    let offsetX = 0;
    let offsetY = 0;

    if (phase === 1) {
      offsetX = magnitude;
    } else if (phase === 2) {
      offsetX = -magnitude;
    } else if (phase === 3) {
      offsetY = magnitude;
    }

    this.actorLayer.position.set(offsetX, offsetY);
    this.fxLayer.position.set(offsetX, offsetY);
  }

  private drawHud(snapshot: RoundSnapshot): void {
    this.uiLayer.clear();
    drawPixelPanel(this.uiLayer, 8, 8, VIEW_WIDTH - 16, 42, 0x0d1730, 0x22395d, 0x618ec4);
    drawPixelPanel(this.uiLayer, 8, VIEW_HEIGHT - 52, VIEW_WIDTH - 16, 44, 0x0a142a, 0x1b3254, 0x4f76a4);

    const timeRatio = Math.max(0, Math.min(1, snapshot.roundTimeLeftMs / ROUND_DURATION_MS));
    const timeFill = Math.round((VIEW_WIDTH - 48) * timeRatio);
    const timeColor = timeRatio > 0.5 ? 0x7df9ff : timeRatio > 0.25 ? 0xffc98f : 0xff7c8f;
    drawPixelPanel(this.uiLayer, 24, 34, VIEW_WIDTH - 48, 8, 0x0a1222, 0x1b3050, 0x345983);
    this.uiLayer.rect(26, 36, timeFill, 4).fill(timeColor);

    const timerValue = Math.max(0, Math.ceil(snapshot.roundTimeLeftMs / 1000));
    this.timerText.text = `${timerValue}`;

    const topText =
      `ROUND ${snapshot.roundIndex}/${snapshot.totalRounds}  ${snapshot.map.name.toUpperCase()}  IT P${snapshot.itPlayerId + 1}`;

    const scores = snapshot.scores;
    const profileLabel = this.runtimeConfig.skinsEnabled
      ? `COINS ${snapshot.profile.tagCoins}`
      : "CLASSIC";
    const bottomText =
      `${profileLabel}   AI ${this.aiEnabled ? "ON" : "OFF"}   ` +
      `${this.runtimeConfig.powerupsEnabled ? "POWERUPS ON" : "POWERUPS OFF"}   ` +
      `P1 ${scores[0]}  P2 ${scores[1]}  P3 ${scores[2]}  P4 ${scores[3]}`;

    this.applyTitleText(normalizeTitle(this.runtimeConfig.title));
    this.applyTopText(topText);
    this.applyBottomText(bottomText);

    for (let playerId = 0; playerId < 4; playerId += 1) {
      const x = playerId < 2 ? 20 : VIEW_WIDTH - 98;
      const y = playerId % 2 === 0 ? 64 : 96;
      const score = scores[playerId as 0 | 1 | 2 | 3] ?? 0;
      const pips = Math.max(0, Math.min(3, Math.floor(score / 150)));
      const isIt = snapshot.itPlayerId === playerId;
      const panelColor = PLAYER_PANEL_COLORS[playerId] ?? 0x324862;
      drawPixelPanel(this.uiLayer, x, y, 78, 24, panelColor, 0x111a2a, 0xffffff);
      this.uiLayer.rect(x + 4, y + 6, 18, 12).fill(0x101e35);
      this.uiLayer.rect(x + 6, y + 8, 14, 8).fill(this.resolveHumanColor(snapshot, playerId as PlayerId));
      for (let pip = 0; pip < 3; pip += 1) {
        const fill = pip < pips ? 0xffffff : 0x5e6b80;
        this.uiLayer.rect(x + 26 + pip * 8, y + 8, 6, 6).fill(fill);
      }
      if (isIt) {
        this.uiLayer.rect(x + 54, y + 6, 20, 12).fill(0xffffff);
        this.uiLayer.rect(x + 56, y + 8, 16, 8).fill(0xff5c7d);
      }
    }

    if (snapshot.sessionComplete) {
      drawPixelPanel(this.uiLayer, 132, 152, 376, 56, 0x2b1320, 0x5f2742, 0xff8cb7);
      this.uiLayer.rect(150, 176, 340, 1).fill(0x7f3556);
      this.applyBottomText("SESSION COMPLETE - REFRESH TO RESTART");
      this.overlayText.text = "ROUND OVER";
    } else if (timerValue >= 89) {
      this.overlayText.text = "READY";
    } else {
      this.overlayText.text = "";
    }
  }

  private renderGame(deltaMs: number): void {
    const snapshot = this.roundManager.getSnapshot();

    if (this.lastRenderedMapId !== snapshot.map.id) {
      this.lastRenderedMapId = snapshot.map.id;
      this.drawMap(snapshot);
    }

    this.applyTagShake(snapshot);
    this.drawPlayers(snapshot);
    this.drawTagFx(snapshot);
    this.drawHud(snapshot);
    this.syncAudio(snapshot, deltaMs);
  }

  update(deltaMs: number): void {
    this.inputManager.update();
    const playerStates = this.inputManager.getPlayerStates();
    if (this.shouldUnlockAudio(playerStates)) {
      this.audio.unlock();
    }
    this.fxTimerMs += deltaMs;

    if (!this.sessionStarted) {
      this.tryStartSession(deltaMs);
      this.renderLobby(deltaMs);
      return;
    }

    this.roundManager.update(deltaMs, playerStates);
    this.renderGame(deltaMs);
  }

  override onExit(): void {
    this.disposed = true;
    this.lastRenderedMapId = null;
    this.lastTitleText = "";
    this.lastTopText = "";
    this.lastBottomText = "";
    this.timerText.text = "";
    this.overlayText.text = "";
    this.actorLayer.position.set(0, 0);
    this.fxLayer.position.set(0, 0);
    this.audio.destroy();
    this.inputManager.destroy();
    super.onExit();
  }
}

export class Game {
  private readonly app: Application;
  private readonly root = new Container();
  private readonly sceneManager: SceneManager;
  private readonly cleanupManager = new CleanupManager();
  private readonly crazyGames = new CrazyGamesManager();
  private readonly runtimeConfig: RuntimeConfig;

  private constructor(app: Application, runtimeConfig: RuntimeConfig) {
    this.app = app;
    this.runtimeConfig = runtimeConfig;
    this.sceneManager = new SceneManager(this.root);
    this.app.stage.addChild(this.root);
  }

  static async create(parent: HTMLElement): Promise<Game> {
    const runtimeConfig = await loadRuntimeConfig();
    if (typeof document !== "undefined") {
      document.title = runtimeConfig.title;
    }
    const app = new Application();
    await app.init({
      width: VIEW_WIDTH,
      height: VIEW_HEIGHT,
      antialias: false,
      background: runtimeConfig.theme === "classic" ? "#0b1826" : "#05070d",
      resolution: 1,
      autoDensity: true,
      roundPixels: true
    });

    parent.style.margin = "0";
    parent.style.minHeight = "100vh";
    parent.style.display = "flex";
    parent.style.alignItems = "center";
    parent.style.justifyContent = "center";
    parent.style.overflow = "hidden";
    parent.style.background =
      runtimeConfig.theme === "classic"
        ? "radial-gradient(circle at 50% 0%, #2b4a72 0%, #0b1826 58%)"
        : "radial-gradient(circle at 50% 0%, #1b2a46 0%, #05070d 55%)";

    app.canvas.style.imageRendering = "pixelated";
    app.canvas.style.border = runtimeConfig.theme === "classic" ? "2px solid #385d87" : "2px solid #1f3152";
    app.canvas.style.boxShadow =
      runtimeConfig.theme === "classic"
        ? "0 0 0 2px #0f2138, 0 16px 36px rgba(0, 0, 0, 0.48)"
        : "0 0 0 2px #0b111f, 0 16px 36px rgba(0, 0, 0, 0.55)";

    parent.appendChild(app.canvas);
    const game = new Game(app, runtimeConfig);
    await game.start();
    return game;
  }

  private applyIntegerScale = (): void => {
    const scale = Math.max(1, Math.floor(Math.min(window.innerWidth / VIEW_WIDTH, window.innerHeight / VIEW_HEIGHT)));
    this.app.canvas.style.width = `${VIEW_WIDTH * scale}px`;
    this.app.canvas.style.height = `${VIEW_HEIGHT * scale}px`;
  };

  private async start(): Promise<void> {
    await this.sceneManager.setScene(new LoadingScene(this.runtimeConfig));
    await this.crazyGames.init();
    await this.sceneManager.setScene(new GameplayScene(this.crazyGames, this.runtimeConfig));

    this.applyIntegerScale();
    this.cleanupManager.addEventListener(window, "resize", this.applyIntegerScale);

    this.app.ticker.add(this.onTick);
    this.cleanupManager.register(() => {
      this.app.ticker.remove(this.onTick);
    });
  }

  private readonly onTick = (): void => {
    this.sceneManager.update(this.app.ticker.deltaMS);
  };

  destroy(): void {
    this.cleanupManager.cleanup();
    this.sceneManager.destroy();
    this.root.removeChildren();
    this.app.destroy(true, { children: true });
  }
}
