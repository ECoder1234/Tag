import { JumpLink, PlayerEntity, PlayerId, PlayerInputState } from "../types";

interface Snapshot {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface SnapshotHistory {
  data: Snapshot[];
  head: number;
  count: number;
}

export interface GhostContext {
  humanScores: Record<PlayerId, number>;
  jumpLinks: readonly JumpLink[];
  canUsePowerup: boolean;
}

export class GhostAI {
  private static readonly abilityDecisionCadenceMs = 420;
  private readonly history: Record<PlayerId, SnapshotHistory> = {
    0: { data: this.createHistoryData(), head: 0, count: 0 },
    1: { data: this.createHistoryData(), head: 0, count: 0 },
    2: { data: this.createHistoryData(), head: 0, count: 0 },
    3: { data: this.createHistoryData(), head: 0, count: 0 }
  };
  private seed: number;
  private sampleTimerMs = 0;
  private jitterTimerMs = 2500;
  private jitterDirection = 0;
  private jumpLinkCooldownMs = 0;
  private lastJumpLinkTargetX: number | null = null;
  private abilityDecisionTimerMs = 0;
  private abilityIntent = false;
  private readonly output: PlayerInputState = {
    left: false,
    right: false,
    jump: false,
    ability: false,
    joined: true
  };

  constructor(seed = 99) {
    this.seed = seed;
  }

  private createHistoryData(): Snapshot[] {
    return Array.from({ length: 24 }, () => ({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0
    }));
  }

  private random(): number {
    this.seed = (1103515245 * this.seed + 12345) & 0x7fffffff;
    return this.seed / 0x80000000;
  }

  private selectTopHuman(humans: PlayerEntity[], scores: Record<PlayerId, number>): PlayerEntity {
    const first = humans[0];
    if (first === undefined) {
      throw new Error("GhostAI requires at least one human target");
    }
    let best = first;
    let bestScore = scores[best.id];
    for (let index = 1; index < humans.length; index += 1) {
      const candidate = humans[index];
      /* c8 ignore next 3 -- defensive indexed access guard */
      if (candidate === undefined) {
        continue;
      }
      const score = scores[candidate.id];
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    return best;
  }

  private sample(topHuman: PlayerEntity): void {
    const samples = this.history[topHuman.id];
    const snapshot = samples.data[samples.head];
    if (snapshot !== undefined) {
      snapshot.x = topHuman.position.x;
      snapshot.y = topHuman.position.y;
      snapshot.vx = topHuman.velocity.x;
      snapshot.vy = topHuman.velocity.y;
    }
    samples.head = (samples.head + 1) % samples.data.length;
    samples.count = Math.min(samples.count + 1, samples.data.length);
  }

  private predict(topHuman: PlayerEntity): { x: number; y: number } {
    const samples = this.history[topHuman.id];
    if (samples.count === 0) {
      return { x: topHuman.position.x, y: topHuman.position.y };
    }
    const latestIndex = (samples.head + samples.data.length - 1) % samples.data.length;
    const latest = samples.data[latestIndex];
    if (latest === undefined) {
      return { x: topHuman.position.x, y: topHuman.position.y };
    }

    return {
      x: latest.x + latest.vx * 0.3,
      y: latest.y + latest.vy * 0.3
    };
  }

  private shouldJumpLink(
    ghost: PlayerEntity,
    targetX: number,
    jumpLinks: readonly JumpLink[]
  ): boolean {
    if (this.jumpLinkCooldownMs > 0) {
      return false;
    }
    const ghostTileX = Math.floor(ghost.position.x / 16);
    const ghostTileY = Math.floor(ghost.position.y / 16);

    for (const jumpLink of jumpLinks) {
      const targetTileX = jumpLink.to.x * 16;
      if (
        Math.abs(jumpLink.from.x - ghostTileX) <= 1 &&
        Math.abs(jumpLink.from.y - ghostTileY) <= 1 &&
        Math.abs(targetTileX - targetX) < 64 &&
        (this.lastJumpLinkTargetX === null || Math.abs(this.lastJumpLinkTargetX - targetTileX) > 8)
      ) {
        this.lastJumpLinkTargetX = targetTileX;
        this.jumpLinkCooldownMs = 350;
        return true;
      }
    }

    return false;
  }

  update(deltaMs: number, ghost: PlayerEntity, humans: PlayerEntity[], context: GhostContext): PlayerInputState {
    const output = this.output;
    output.left = false;
    output.right = false;
    output.jump = false;
    output.ability = false;
    output.joined = true;
    if (humans.length === 0) {
      return output;
    }

    this.sampleTimerMs += deltaMs;
    this.jumpLinkCooldownMs = Math.max(0, this.jumpLinkCooldownMs - deltaMs);
    const topHuman = this.selectTopHuman(humans, context.humanScores);

    while (this.sampleTimerMs >= 125) {
      this.sampleTimerMs -= 125;
      this.sample(topHuman);
    }

    this.jitterTimerMs -= deltaMs;
    while (this.jitterTimerMs <= 0) {
      this.jitterTimerMs += 2500;
      this.jitterDirection = this.random() < 0.5 ? -1 : 1;
    }

    const predicted = this.predict(topHuman);
    const targetX = predicted.x + this.jitterDirection * 12;
    const dx = targetX - ghost.position.x;
    if (dx < -7) {
      output.left = true;
    } else if (dx > 7) {
      output.right = true;
    }

    const needsVertical = predicted.y < ghost.position.y - 20;
    output.jump =
      (needsVertical && ghost.onGround) ||
      (ghost.onGround && this.shouldJumpLink(ghost, targetX, context.jumpLinks));

    this.abilityDecisionTimerMs -= deltaMs;
    while (this.abilityDecisionTimerMs <= 0) {
      this.abilityDecisionTimerMs += GhostAI.abilityDecisionCadenceMs;
      this.abilityIntent = this.random() < 0.6;
    }
    output.ability = context.canUsePowerup && this.abilityIntent;
    return output;
  }
}
