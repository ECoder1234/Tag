import { SaveManager, SaveProfile } from "../data/SaveManager";
import { CrazyGamesManager } from "../sdk/CrazyGamesManager";
import { AntiStall } from "./AntiStall";
import { GhostAI } from "./ai/GhostAI";
import { Physics } from "./Physics";
import { ScoreSystem } from "./ScoreSystem";
import { TagSystem } from "./TagSystem";
import { MapManager } from "./map/MapManager";
import { MapData } from "./map/MapSchema";
import { PowerupSystem } from "./powerups/PowerupSystem";
import {
  ActivePowerupPickup,
  PlayerEntity,
  PlayerId,
  PlayerInputState,
  createDefaultModifiers
} from "./types";

const PLAYER_IDS: readonly PlayerId[] = [0, 1, 2, 3];

interface RoundSystems {
  tag: TagSystem;
  score: ScoreSystem;
  antiStall: AntiStall;
}

export interface RoundSnapshot {
  roundIndex: number;
  totalRounds: number;
  roundTimeLeftMs: number;
  map: MapData;
  players: Record<PlayerId, PlayerEntity>;
  itPlayerId: PlayerId;
  scores: Record<PlayerId, number>;
  pickups: number;
  pickupItems: readonly ActivePowerupPickup[];
  joinedPlayers: PlayerId[];
  sessionComplete: boolean;
  profile: SaveProfile;
  tagFlashMs: number;
}

interface SessionOptions {
  ghostEnabled: boolean;
  powerupsEnabled: boolean;
}

export class RoundManager {
  private static readonly roundDurationMs = 90000;
  private static readonly totalRounds = 3;
  private readonly mapManager: MapManager;
  private readonly saveManager: SaveManager;
  private readonly crazyGames: CrazyGamesManager;
  private readonly powerups: PowerupSystem;
  private readonly ghostAI: GhostAI;
  private readonly players: Record<PlayerId, PlayerEntity>;
  private joinedHumans: PlayerId[] = [];
  private readonly joinedHumansSet = new Set<PlayerId>();
  private activePlayers: PlayerId[] = [];
  private ghostPlayerId: PlayerId | null = null;
  private currentMap: MapData;
  private systems: RoundSystems;
  private profile: SaveProfile = { tagCoins: 0, unlockedSkinIds: [0, 1, 2, 3] };
  private roundIndex = 0;
  private roundTimeMs = RoundManager.roundDurationMs;
  private simulationAccumulatorMs = 0;
  private transitionInProgress = false;
  private sessionComplete = false;
  private muted = false;
  private readonly abilityLatch: Record<PlayerId, boolean> = {
    0: false,
    1: false,
    2: false,
    3: false
  };
  private readonly mergedInputs: Record<PlayerId, PlayerInputState> = {
    0: { left: false, right: false, jump: false, ability: false, joined: false },
    1: { left: false, right: false, jump: false, ability: false, joined: false },
    2: { left: false, right: false, jump: false, ability: false, joined: false },
    3: { left: false, right: false, jump: false, ability: false, joined: false }
  };
  private readonly humansBuffer: PlayerEntity[] = [];
  private readonly fixedStepMs = 1000 / 120;
  private readonly maxStepsPerFrame = 12;
  private tagFlashMs = 0;
  private readonly setMuted: (muted: boolean) => void;
  private ghostEnabled = true;
  private powerupsEnabled = true;

  constructor(
    mapManager: MapManager,
    saveManager: SaveManager,
    crazyGames: CrazyGamesManager,
    setMuted: (muted: boolean) => void,
    seed = 444
  ) {
    this.mapManager = mapManager;
    this.saveManager = saveManager;
    this.crazyGames = crazyGames;
    this.setMuted = setMuted;
    this.powerups = new PowerupSystem(seed + 1);
    this.ghostAI = new GhostAI(seed + 2);
    this.currentMap = this.mapManager.nextMap();
    this.players = {
      0: this.createPlayer(0),
      1: this.createPlayer(1),
      2: this.createPlayer(2),
      3: this.createPlayer(3)
    };
    this.systems = {
      tag: new TagSystem(0),
      score: new ScoreSystem([0]),
      antiStall: new AntiStall()
    };
  }

  private createPlayer(id: PlayerId): PlayerEntity {
    return {
      id,
      isHuman: true,
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      width: 12,
      height: 20,
      onGround: false,
      facing: 1,
      activePowerup: null,
      powerupCooldown: 0,
      modifiers: createDefaultModifiers(),
      coyoteTimeMs: 0,
      jumpBufferMs: 0,
      jumpHeld: false
    };
  }

  async initSession(
    joinedHumans: PlayerId[],
    options: SessionOptions = { ghostEnabled: true, powerupsEnabled: true }
  ): Promise<void> {
    this.joinedHumans = [...joinedHumans];
    this.ghostEnabled = options.ghostEnabled;
    this.powerupsEnabled = options.powerupsEnabled;
    this.joinedHumansSet.clear();
    for (const playerId of this.joinedHumans) {
      this.joinedHumansSet.add(playerId);
    }
    this.profile = await this.saveManager.loadProfile();
    this.roundIndex = 0;
    this.sessionComplete = false;
    this.currentMap = this.mapManager.nextMap();
    this.startRound();
    this.crazyGames.gameplayStart();
  }

  private selectGhostPlayerId(): PlayerId | null {
    if (!this.ghostEnabled) {
      return null;
    }
    if (this.joinedHumans.length >= 4) {
      return null;
    }

    for (const playerId of PLAYER_IDS) {
      if (!this.joinedHumansSet.has(playerId)) {
        return playerId;
      }
    }
    return null;
  }

  private startRound(): void {
    this.roundTimeMs = RoundManager.roundDurationMs;
    this.simulationAccumulatorMs = 0;
    this.tagFlashMs = 0;
    this.currentMap = this.mapManager.nextMap();
    this.ghostPlayerId = this.selectGhostPlayerId();

    this.activePlayers = [...this.joinedHumans];
    if (this.ghostPlayerId !== null) {
      this.activePlayers.push(this.ghostPlayerId);
    }

    const spawnPositions = this.mapManager.getSpawnPositions(this.currentMap);
    for (const playerId of PLAYER_IDS) {
      const player = this.players[playerId];
      player.position.x = spawnPositions[playerId].x;
      player.position.y = spawnPositions[playerId].y;
      player.velocity.x = 0;
      player.velocity.y = 0;
      player.onGround = false;
      player.activePowerup = null;
      player.powerupCooldown = 0;
      player.modifiers = createDefaultModifiers();
      player.coyoteTimeMs = 0;
      player.jumpBufferMs = 0;
      player.jumpHeld = false;
      player.isHuman = this.joinedHumansSet.has(playerId);
    }

    const initialIt = this.activePlayers[0] ?? 0;
    this.systems = {
      tag: new TagSystem(initialIt),
      score: new ScoreSystem(this.activePlayers),
      antiStall: new AntiStall()
    };

    this.powerups.clearRound(this.players);
    this.transitionInProgress = false;
    for (const playerId of PLAYER_IDS) {
      this.abilityLatch[playerId] = false;
    }
  }

  private getInputs(
    inputs: Record<PlayerId, PlayerInputState>,
    deltaMs: number
  ): Record<PlayerId, PlayerInputState> {
    this.mergedInputs[0].left = inputs[0].left;
    this.mergedInputs[0].right = inputs[0].right;
    this.mergedInputs[0].jump = inputs[0].jump;
    this.mergedInputs[0].ability = inputs[0].ability;
    this.mergedInputs[0].joined = inputs[0].joined;
    this.mergedInputs[1].left = inputs[1].left;
    this.mergedInputs[1].right = inputs[1].right;
    this.mergedInputs[1].jump = inputs[1].jump;
    this.mergedInputs[1].ability = inputs[1].ability;
    this.mergedInputs[1].joined = inputs[1].joined;
    this.mergedInputs[2].left = inputs[2].left;
    this.mergedInputs[2].right = inputs[2].right;
    this.mergedInputs[2].jump = inputs[2].jump;
    this.mergedInputs[2].ability = inputs[2].ability;
    this.mergedInputs[2].joined = inputs[2].joined;
    this.mergedInputs[3].left = inputs[3].left;
    this.mergedInputs[3].right = inputs[3].right;
    this.mergedInputs[3].jump = inputs[3].jump;
    this.mergedInputs[3].ability = inputs[3].ability;
    this.mergedInputs[3].joined = inputs[3].joined;

    if (this.ghostPlayerId !== null) {
      const ghost = this.players[this.ghostPlayerId];
      this.humansBuffer.length = 0;
      for (const playerId of this.joinedHumans) {
        this.humansBuffer.push(this.players[playerId]);
      }
      const ghostInput = this.ghostAI.update(deltaMs, ghost, this.humansBuffer, {
        humanScores: this.systems.score.getScores(),
        jumpLinks: this.currentMap.jumpLinks,
        canUsePowerup: ghost.activePowerup !== null
      });
      this.mergedInputs[this.ghostPlayerId].left = ghostInput.left;
      this.mergedInputs[this.ghostPlayerId].right = ghostInput.right;
      this.mergedInputs[this.ghostPlayerId].jump = ghostInput.jump;
      this.mergedInputs[this.ghostPlayerId].ability = ghostInput.ability;
      this.mergedInputs[this.ghostPlayerId].joined = ghostInput.joined;
    }

    return this.mergedInputs;
  }

  private handleAbilities(inputs: Record<PlayerId, PlayerInputState>): boolean {
    let reassigned = false;
    for (const playerId of this.activePlayers) {
      const pressed = inputs[playerId].ability;
      if (pressed && !this.abilityLatch[playerId]) {
        const nextIt = this.powerups.tryUsePowerup(
          playerId,
          this.players,
          this.systems.tag.getItPlayerId()
        );
        if (nextIt !== this.systems.tag.getItPlayerId()) {
          reassigned = this.systems.tag.forceAssignIt(nextIt) || reassigned;
        }
      }
      this.abilityLatch[playerId] = pressed;
    }
    return reassigned;
  }

  private stepSimulation(stepMs: number, inputs: Record<PlayerId, PlayerInputState>): void {
    const mergedInputs = this.getInputs(inputs, stepMs);
    let itReassignedThisStep = this.powerupsEnabled ? this.handleAbilities(mergedInputs) : false;

    for (const playerId of this.activePlayers) {
      Physics.step(this.players[playerId], mergedInputs[playerId], this.currentMap, stepMs);
    }

    if (this.powerupsEnabled) {
      this.powerups.update(stepMs, this.players, this.currentMap);
    }

    if (!itReassignedThisStep) {
      const tagEvent = this.systems.tag.update(this.players, stepMs);
      if (tagEvent !== null) {
        this.systems.score.onTag(tagEvent.from);
        this.tagFlashMs = 160;
        itReassignedThisStep = true;
      }
    } else {
      this.systems.tag.update(this.players, stepMs);
    }

    this.systems.score.tick(stepMs, this.systems.tag.getItPlayerId(), this.players);
    if (!itReassignedThisStep) {
      this.systems.antiStall.update(stepMs, this.activePlayers, this.systems.tag);
    }

    this.roundTimeMs -= stepMs;
    this.tagFlashMs = Math.max(0, this.tagFlashMs - stepMs);
    if (this.roundTimeMs <= 0) {
      this.roundTimeMs = 0;
      void this.finishRound();
    }
  }

  private async finishRound(): Promise<void> {
    if (this.transitionInProgress || this.sessionComplete) {
      return;
    }

    this.transitionInProgress = true;
    try {
      const winner = this.systems.score.getRoundWinner();
      const bestComboPlayer = this.systems.score.getBestComboPlayer();

      const humanWin = this.joinedHumansSet.has(winner);
      const humanBestCombo = this.joinedHumansSet.has(bestComboPlayer);

      this.profile = await this.saveManager.grantRoundRewards(this.profile, humanWin, humanBestCombo);

      this.roundIndex += 1;
      this.powerups.clearRound(this.players);

      if (this.roundIndex >= RoundManager.totalRounds) {
        this.sessionComplete = true;
        this.crazyGames.gameplayStop();
        return;
      }

      await this.crazyGames.showMidgameAd(
        () => {
          this.muted = true;
          this.setMuted(true);
        },
        () => {
          this.muted = false;
          this.setMuted(false);
        }
      );

      this.startRound();
    } catch {
      this.sessionComplete = true;
      this.crazyGames.gameplayStop();
    } finally {
      if (!this.sessionComplete) {
        this.transitionInProgress = false;
      }
    }
  }

  update(deltaMs: number, inputs: Record<PlayerId, PlayerInputState>): void {
    if (this.transitionInProgress || this.sessionComplete) {
      return;
    }
    if (this.muted) {
      return;
    }

    const clampedDeltaMs = Math.min(100, Math.max(0, deltaMs));
    this.simulationAccumulatorMs += clampedDeltaMs;
    let steps = 0;
    while (
      this.simulationAccumulatorMs >= this.fixedStepMs &&
      steps < this.maxStepsPerFrame &&
      !this.transitionInProgress &&
      !this.sessionComplete
    ) {
      this.simulationAccumulatorMs -= this.fixedStepMs;
      this.stepSimulation(this.fixedStepMs, inputs);
      steps += 1;
    }
  }

  getSnapshot(): RoundSnapshot {
    const pickupItems = this.powerups.getPickups();
    const visiblePickups = this.powerupsEnabled ? pickupItems : [];
    return {
      roundIndex: this.roundIndex + 1,
      totalRounds: RoundManager.totalRounds,
      roundTimeLeftMs: this.roundTimeMs,
      map: this.currentMap,
      players: this.players,
      itPlayerId: this.systems.tag.getItPlayerId(),
      scores: this.systems.score.getScores(),
      pickups: visiblePickups.length,
      pickupItems: visiblePickups,
      joinedPlayers: [...this.activePlayers],
      sessionComplete: this.sessionComplete,
      profile: this.profile,
      tagFlashMs: this.tagFlashMs
    };
  }

  getProfile(): SaveProfile {
    return this.profile;
  }
}
