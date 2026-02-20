import { describe, expect, test } from "vitest";
import { ScoreSystem } from "../src/game/ScoreSystem";
import { PlayerEntity, PlayerId, createDefaultModifiers } from "../src/game/types";

const makePlayer = (id: PlayerId): PlayerEntity => ({
  id,
  isHuman: true,
  position: { x: 0, y: 0 },
  velocity: { x: 0, y: 0 },
  width: 12,
  height: 20,
  onGround: true,
  facing: 1,
  activePowerup: null,
  powerupCooldown: 0,
  modifiers: createDefaultModifiers(),
  coyoteTimeMs: 0,
  jumpBufferMs: 0,
  jumpHeld: false
});

describe("ScoreSystem", () => {
  test("awards tag points with stacking combo cap", () => {
    const score = new ScoreSystem([0, 1]);

    const first = score.onTag(0);
    const second = score.onTag(0);
    const third = score.onTag(0);
    const sixth = score.onTag(0) + score.onTag(0) + score.onTag(0);

    expect(first).toBe(140);
    expect(second).toBe(160);
    expect(third).toBe(180);
    expect(sixth).toBeGreaterThan(0);
    expect(score.getScores()[0]).toBeGreaterThanOrEqual(140 + 160 + 180 + 200 + 220 + 220);
  });

  test("awards survival at 4/sec", () => {
    const players = {
      0: makePlayer(0),
      1: makePlayer(1),
      2: makePlayer(2),
      3: makePlayer(3)
    };
    const score = new ScoreSystem([0, 1]);

    score.tick(1000, 0, players);
    expect(score.getScores()[1]).toBe(4);
    expect(score.getScores()[0]).toBe(0);
  });
});
