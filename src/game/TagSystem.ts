import { PlayerEntity, PlayerId } from "./types";

export interface TagEvent {
  from: PlayerId;
  to: PlayerId;
}

const PLAYER_IDS: readonly PlayerId[] = [0, 1, 2, 3];

const overlaps = (a: PlayerEntity, b: PlayerEntity): boolean => {
  const aLeft = a.position.x - a.width / 2;
  const aRight = a.position.x + a.width / 2;
  const aTop = a.position.y - a.height;
  const aBottom = a.position.y;

  const bLeft = b.position.x - b.width / 2;
  const bRight = b.position.x + b.width / 2;
  const bTop = b.position.y - b.height;
  const bBottom = b.position.y;

  return aLeft < bRight && aRight > bLeft && aTop < bBottom && aBottom > bTop;
};

const createHoldTimes = (): Record<PlayerId, number> => ({
  0: 0,
  1: 0,
  2: 0,
  3: 0
});

export class TagSystem {
  private itPlayerId: PlayerId;
  private cooldownMs = 0;
  private readonly holdTimesWindow: Record<PlayerId, number> = createHoldTimes();
  private readonly holdTimesRound: Record<PlayerId, number> = createHoldTimes();

  constructor(initialIt: PlayerId) {
    this.itPlayerId = initialIt;
  }

  getItPlayerId(): PlayerId {
    return this.itPlayerId;
  }

  getCooldownMs(): number {
    return this.cooldownMs;
  }

  getWindowHoldTime(playerId: PlayerId): number {
    return this.holdTimesWindow[playerId];
  }

  update(players: Record<PlayerId, PlayerEntity>, deltaMs: number): TagEvent | null {
    this.holdTimesWindow[this.itPlayerId] += deltaMs;
    this.holdTimesRound[this.itPlayerId] += deltaMs;
    const wasOnCooldown = this.cooldownMs > 0;
    this.cooldownMs = Math.max(0, this.cooldownMs - deltaMs);

    if (wasOnCooldown) {
      return null;
    }

    const tagger = players[this.itPlayerId];
    for (const playerId of PLAYER_IDS) {
      if (playerId === this.itPlayerId) {
        continue;
      }
      const target = players[playerId];
      if (target.modifiers.shielded || target.modifiers.phased) {
        continue;
      }
      if (!overlaps(tagger, target)) {
        continue;
      }

      const event: TagEvent = { from: this.itPlayerId, to: playerId };
      this.itPlayerId = playerId;
      this.cooldownMs = 800;
      return event;
    }

    return null;
  }

  forceAssignIt(playerId: PlayerId): boolean {
    if (this.itPlayerId === playerId) {
      return false;
    }
    this.itPlayerId = playerId;
    this.cooldownMs = 0;
    return true;
  }

  getWindowHoldTimes(): Record<PlayerId, number> {
    return { ...this.holdTimesWindow };
  }

  getWindowTotal(joinedPlayers: readonly PlayerId[]): number {
    let total = 0;
    for (const playerId of joinedPlayers) {
      total += this.holdTimesWindow[playerId];
    }
    return total;
  }

  resetWindowHoldTimes(): void {
    for (const playerId of PLAYER_IDS) {
      this.holdTimesWindow[playerId] = 0;
    }
  }

  getRoundHoldTimes(): Record<PlayerId, number> {
    return { ...this.holdTimesRound };
  }
}
