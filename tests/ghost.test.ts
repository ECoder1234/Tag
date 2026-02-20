import { describe, expect, test } from "vitest";
import { GhostAI } from "../src/game/ai/GhostAI";
import { PlayerEntity, PlayerId, createDefaultModifiers } from "../src/game/types";

const player = (id: PlayerId, x: number, y: number): PlayerEntity => ({
  id,
  isHuman: id !== 3,
  position: { x, y },
  velocity: { x: 80, y: 0 },
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

describe("GhostAI", () => {
  test("is deterministic for a fixed seed", () => {
    const ghost = player(3, 100, 200);
    const humans = [player(0, 250, 180), player(1, 180, 180)];
    const scores = { 0: 30, 1: 10, 2: 0, 3: 0 };

    const a = new GhostAI(7);
    const b = new GhostAI(7);

    const outA = a.update(125, ghost, humans, { humanScores: scores, jumpLinks: [], canUsePowerup: true });
    const outB = b.update(125, ghost, humans, { humanScores: scores, jumpLinks: [], canUsePowerup: true });

    expect(outA).toEqual(outB);
  });

  test("moves toward top human intercept", () => {
    const ghost = player(3, 100, 200);
    const humans = [player(0, 260, 180)];
    const ai = new GhostAI(11);

    const output = ai.update(125, ghost, humans, {
      humanScores: { 0: 50, 1: 0, 2: 0, 3: 0 },
      jumpLinks: [],
      canUsePowerup: false
    });

    expect(output.right).toBe(true);
  });

  test("returns idle output when no humans are available", () => {
    const ghost = player(3, 100, 200);
    const ai = new GhostAI(11);
    const output = ai.update(125, ghost, [], {
      humanScores: { 0: 0, 1: 0, 2: 0, 3: 0 },
      jumpLinks: [],
      canUsePowerup: false
    });
    expect(output.left).toBe(false);
    expect(output.right).toBe(false);
    expect(output.jump).toBe(false);
  });

  test("uses jump links with cooldown to avoid loops", () => {
    const ghost = player(3, 160, 160);
    const humans = [player(0, 192, 160)];
    const ai = new GhostAI(17);
    const jumpLinks = [{ from: { x: 10, y: 10 }, to: { x: 12, y: 7 } }];

    const first = ai.update(125, ghost, humans, {
      humanScores: { 0: 20, 1: 0, 2: 0, 3: 0 },
      jumpLinks,
      canUsePowerup: false
    });
    const second = ai.update(100, ghost, humans, {
      humanScores: { 0: 20, 1: 0, 2: 0, 3: 0 },
      jumpLinks,
      canUsePowerup: false
    });

    expect(typeof first.jump).toBe("boolean");
    expect(second.jump).toBe(false);
  });
});
