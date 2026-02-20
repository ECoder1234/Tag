import { PlayerEntity, PlayerId } from "./types";

const PLAYER_IDS: readonly PlayerId[] = [0, 1, 2, 3];

interface ComboState {
  stack: number;
  windowMs: number;
  best: number;
}

const createComboState = (): ComboState => ({
  stack: 0,
  windowMs: 0,
  best: 0
});

export class ScoreSystem {
  private readonly scores: Record<PlayerId, number> = {
    0: 0,
    1: 0,
    2: 0,
    3: 0
  };
  private readonly combos: Record<PlayerId, ComboState> = {
    0: createComboState(),
    1: createComboState(),
    2: createComboState(),
    3: createComboState()
  };
  private readonly joined = new Set<PlayerId>();
  private readonly scoreView: Record<PlayerId, number> = {
    0: 0,
    1: 0,
    2: 0,
    3: 0
  };

  constructor(joinedPlayers: PlayerId[]) {
    for (const playerId of joinedPlayers) {
      this.joined.add(playerId);
    }
  }

  tick(deltaMs: number, itPlayerId: PlayerId, players: Record<PlayerId, PlayerEntity>): void {
    const deltaSec = deltaMs / 1000;

    for (const playerId of PLAYER_IDS) {
      const combo = this.combos[playerId];
      combo.windowMs = Math.max(0, combo.windowMs - deltaMs);
      if (combo.windowMs <= 0) {
        combo.stack = 0;
      }

      if (!this.joined.has(playerId) || playerId === itPlayerId) {
        continue;
      }

      const surge = players[playerId].modifiers.scoreSurge ? 4 : 0;
      this.scores[playerId] += (4 + surge) * deltaSec;
    }
  }

  onTag(taggerId: PlayerId): number {
    if (!this.joined.has(taggerId)) {
      return 0;
    }

    const combo = this.combos[taggerId];
    combo.stack = combo.windowMs > 0 ? combo.stack + 1 : 1;
    combo.windowMs = 8000;
    combo.best = Math.max(combo.best, combo.stack);

    const comboBonus = Math.min(100, combo.stack * 20);
    const gained = 120 + comboBonus;
    this.scores[taggerId] += gained;
    return gained;
  }

  getScores(): Record<PlayerId, number> {
    this.scoreView[0] = Math.floor(this.scores[0]);
    this.scoreView[1] = Math.floor(this.scores[1]);
    this.scoreView[2] = Math.floor(this.scores[2]);
    this.scoreView[3] = Math.floor(this.scores[3]);
    return this.scoreView;
  }

  getBestComboPlayer(): PlayerId {
    let bestPlayer: PlayerId = 0;
    let bestCombo = -1;
    for (const playerId of PLAYER_IDS) {
      if (!this.joined.has(playerId)) {
        continue;
      }
      const combo = this.combos[playerId].best;
      if (combo > bestCombo) {
        bestCombo = combo;
        bestPlayer = playerId;
      }
    }
    return bestPlayer;
  }

  getRoundWinner(): PlayerId {
    let winner: PlayerId = 0;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const playerId of PLAYER_IDS) {
      if (!this.joined.has(playerId)) {
        continue;
      }
      const score = this.scores[playerId];
      if (score > bestScore) {
        bestScore = score;
        winner = playerId;
      }
    }
    return winner;
  }
}
