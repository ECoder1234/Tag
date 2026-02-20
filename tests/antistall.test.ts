import { describe, expect, test } from "vitest";
import { AntiStall } from "../src/game/AntiStall";
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

describe("AntiStall", () => {
  test("reassigns when one player holds IT for more than 50% of window", () => {
    const antiStall = new AntiStall();
    const tag = new TagSystem(0);

    const players = {
      0: makePlayer(0, 100),
      1: makePlayer(1, 350),
      2: makePlayer(2, 500),
      3: makePlayer(3, 580)
    };

    for (let i = 0; i < 2400; i += 1) {
      tag.update(players, 8.3333333333);
    }

    const assigned = antiStall.update(20000, [0, 1, 2], tag);
    expect(assigned).toBe(1);
    expect(tag.getItPlayerId()).toBe(1);
  });

  test("tie-breaks deterministically by player id", () => {
    const antiStall = new AntiStall();
    const tag = new TagSystem(0);
    const players = {
      0: makePlayer(0, 100),
      1: makePlayer(1, 350),
      2: makePlayer(2, 500),
      3: makePlayer(3, 580)
    };

    for (let i = 0; i < 2400; i += 1) {
      tag.update(players, 8.3333333333);
    }

    const assigned = antiStall.update(20000, [2, 1, 0], tag);
    expect(assigned).toBe(1);
  });

  test("does nothing before window threshold and when ratio <= 50%", () => {
    const antiStall = new AntiStall();
    const tag = new TagSystem(0);
    const players = {
      0: makePlayer(0, 100),
      1: makePlayer(1, 102),
      2: makePlayer(2, 500),
      3: makePlayer(3, 580)
    };

    expect(antiStall.update(10000, [0, 1], tag)).toBeNull();

    tag.update(players, 16);
    tag.update(players, 900);
    players[0].position.x = 500;
    players[1].position.x = 502;
    tag.update(players, 16);
    tag.update(players, 900);

    const assigned = antiStall.update(20000, [0, 1], tag);
    expect(assigned).toBeNull();
  });

  test("handles empty-hold window and degenerate opponent set", () => {
    const antiStall = new AntiStall();
    const tag = new TagSystem(0);

    expect(antiStall.update(20000, [0, 1], tag)).toBeNull();
    expect(antiStall.update(20000, [0, 0], tag)).toBeNull();
  });
});
