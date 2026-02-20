import { describe, expect, test } from "vitest";
import { TagSystem } from "../src/game/TagSystem";
import { PlayerEntity, PlayerId, createDefaultModifiers } from "../src/game/types";

const makePlayer = (id: PlayerId, x: number): PlayerEntity => ({
  id,
  isHuman: true,
  position: { x, y: 100 },
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

describe("TagSystem", () => {
  test("applies 800ms cooldown between tags", () => {
    const players = {
      0: makePlayer(0, 100),
      1: makePlayer(1, 102),
      2: makePlayer(2, 300),
      3: makePlayer(3, 400)
    };

    const tag = new TagSystem(0);
    const first = tag.update(players, 16);
    expect(first).not.toBeNull();
    expect(tag.getItPlayerId()).toBe(1);

    players[0].position.x = 103;
    const blocked = tag.update(players, 200);
    expect(blocked).toBeNull();
    expect(tag.getItPlayerId()).toBe(1);

    const secondBlocked = tag.update(players, 800);
    expect(secondBlocked).toBeNull();
    const second = tag.update(players, 16);
    expect(second).not.toBeNull();
    expect(tag.getItPlayerId()).toBe(0);
  });

  test("does not allow cooldown bypass on a large delta edge", () => {
    const players = {
      0: makePlayer(0, 100),
      1: makePlayer(1, 102),
      2: makePlayer(2, 300),
      3: makePlayer(3, 400)
    };

    const tag = new TagSystem(0);
    tag.update(players, 16);
    expect(tag.getItPlayerId()).toBe(1);

    players[0].position.x = 103;
    const edgeAttempt = tag.update(players, 1000);
    expect(edgeAttempt).toBeNull();
    expect(tag.getCooldownMs()).toBe(0);

    const nextFrame = tag.update(players, 16);
    expect(nextFrame).not.toBeNull();
    expect(tag.getItPlayerId()).toBe(0);
  });
});
