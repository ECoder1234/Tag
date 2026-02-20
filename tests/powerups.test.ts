import { describe, expect, test } from "vitest";
import { MapManager } from "../src/game/map/MapManager";
import { PowerupSystem } from "../src/game/powerups/PowerupSystem";
import { PlayerEntity, PlayerId, createDefaultModifiers } from "../src/game/types";

const entity = (id: PlayerId): PlayerEntity => ({
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

describe("PowerupSystem", () => {
  test("spawns every 8 seconds with max 3 active", () => {
    const manager = new MapManager(2);
    const map = manager.nextMap();
    const powerups = new PowerupSystem(4);

    const players = {
      0: entity(0),
      1: entity(1),
      2: entity(2),
      3: entity(3)
    };

    powerups.update(32000, players, map);
    expect(powerups.getPickups().length).toBe(3);
  });

  test("uses HyperDash and applies speed modifier", () => {
    const manager = new MapManager(2);
    const map = manager.nextMap();
    const powerups = new PowerupSystem(4);
    const players = {
      0: entity(0),
      1: entity(1),
      2: entity(2),
      3: entity(3)
    };

    players[0].activePowerup = "HyperDash";
    powerups.tryUsePowerup(0, players, 1);
    powerups.update(16, players, map);

    expect(players[0].modifiers.speedMultiplier).toBeGreaterThan(1);
  });

  test("covers all powerup branches without exploit loops", () => {
    const manager = new MapManager(2);
    const map = manager.nextMap();
    const powerups = new PowerupSystem(4);
    const players = {
      0: entity(0),
      1: entity(1),
      2: entity(2),
      3: entity(3)
    };

    players[0].activePowerup = "BlinkStep";
    const startX = players[0].position.x;
    powerups.tryUsePowerup(0, players, 1);
    expect(players[0].position.x).toBe(startX + 64);

    players[0].activePowerup = "BounceBurst";
    players[0].powerupCooldown = 0;
    players[0].velocity.y = -50;
    powerups.tryUsePowerup(0, players, 1);
    expect(players[0].velocity.y).toBeLessThanOrEqual(-760);

    const warpBeforeX = players[0].position.x;
    players[0].activePowerup = "WarpGate";
    players[0].powerupCooldown = 0;
    powerups.tryUsePowerup(0, players, 1, map);
    expect(players[0].position.x).not.toBe(warpBeforeX);

    players[1].position.x = 200;
    players[2].position.x = 400;
    players[1].activePowerup = "SwapZap";
    const nextIt = powerups.tryUsePowerup(1, players, 2);
    expect(nextIt).toBe(1);
    expect(players[1].position.x).toBe(400);
    expect(players[2].position.x).toBe(200);

    players[0].activePowerup = "RocketHop";
    players[0].powerupCooldown = 0;
    powerups.tryUsePowerup(0, players, 1);
    expect(players[0].velocity.y).toBe(-700);

    players[0].activePowerup = "HyperDash";
    players[0].powerupCooldown = 0;
    powerups.tryUsePowerup(0, players, 1);
    powerups.update(16, players, map);
    expect(players[0].modifiers.speedMultiplier).toBeGreaterThan(1);

    players[0].activePowerup = "TagShield";
    players[0].powerupCooldown = 0;
    powerups.tryUsePowerup(0, players, 1);
    powerups.update(16, players, map);
    expect(players[0].modifiers.shielded).toBe(true);

    players[0].activePowerup = "PhaseCloak";
    players[0].powerupCooldown = 0;
    powerups.tryUsePowerup(0, players, 1);
    powerups.update(16, players, map);
    expect(players[0].modifiers.phased).toBe(true);

    players[0].activePowerup = "ScoreSurge";
    players[0].powerupCooldown = 0;
    powerups.tryUsePowerup(0, players, 1);
    powerups.update(16, players, map);
    expect(players[0].modifiers.scoreSurge).toBe(true);

    players[0].activePowerup = "LowGrav";
    players[0].powerupCooldown = 0;
    powerups.tryUsePowerup(0, players, 1);
    powerups.update(16, players, map);
    expect(players[0].modifiers.gravityMultiplier).toBeLessThan(1);

    players[0].activePowerup = "TimeCrush";
    players[0].powerupCooldown = 0;
    powerups.tryUsePowerup(0, players, 1);
    powerups.update(16, players, map);
    expect(players[1].modifiers.slowMultiplier).toBeLessThan(1);

    players[0].activePowerup = "DecoyClone";
    players[0].powerupCooldown = 0;
    expect(() => powerups.tryUsePowerup(0, players, 1)).not.toThrow();

    players[0].activePowerup = "IceMine";
    players[0].powerupCooldown = 0;
    players[0].position.x = 100;
    players[0].position.y = 100;
    players[1].position.x = 100;
    players[1].position.y = 100;
    powerups.tryUsePowerup(0, players, 1);
    powerups.update(16, players, map);
    expect(players[1].modifiers.slowMultiplier).toBeLessThan(1);

    players[1].activePowerup = "HyperDash";
    players[1].powerupCooldown = 0;
    powerups.tryUsePowerup(1, players, 1);
    powerups.update(16, players, map);
    expect(players[1].modifiers.speedMultiplier).toBeGreaterThan(1);

    players[0].activePowerup = "EMPBurst";
    players[0].powerupCooldown = 0;
    powerups.tryUsePowerup(0, players, 1);
    powerups.update(16, players, map);
    expect(players[1].modifiers.speedMultiplier).toBe(1);
  });

  test("handles pickup/effect lifecycle branches deterministically", () => {
    const manager = new MapManager(2);
    const map = manager.nextMap();
    const powerups = new PowerupSystem(4);
    const players = {
      0: entity(0),
      1: entity(1),
      2: entity(2),
      3: entity(3)
    };

    players[0].activePowerup = "HyperDash";
    players[0].powerupCooldown = 0;
    powerups.tryUsePowerup(0, players, 1);
    players[0].activePowerup = "HyperDash";
    players[0].powerupCooldown = 0;
    powerups.tryUsePowerup(0, players, 1);
    powerups.update(16, players, map);
    expect(players[0].modifiers.speedMultiplier).toBeGreaterThan(1);

    players[0].activePowerup = null;
    const firstSpawn = map.spawnTiles[0];
    if (firstSpawn === undefined) {
      throw new Error("Expected at least one spawn tile");
    }
    players[0].position.x = firstSpawn.x * map.tileSize + map.tileSize / 2;
    players[0].position.y = firstSpawn.y * map.tileSize - 8;
    powerups.update(8000, players, map);
    expect(players[0].activePowerup).not.toBeNull();

    players[1].activePowerup = "TagShield";
    players[2].activePowerup = "TagShield";
    players[3].activePowerup = "TagShield";
    powerups.update(8000, players, map);

    players[0].activePowerup = "IceMine";
    players[0].powerupCooldown = 0;
    players[0].position.x = 300;
    players[0].position.y = 120;
    players[1].position.x = 500;
    players[1].position.y = 120;
    powerups.tryUsePowerup(0, players, 1);
    powerups.update(7000, players, map);

    players[0].activePowerup = "DecoyClone";
    players[0].powerupCooldown = 0;
    powerups.tryUsePowerup(0, players, 1);
    powerups.update(6000, players, map);

    const unchanged = powerups.tryUsePowerup(0, players, 1);
    expect(unchanged).toBe(1);
  });
});
