import { describe, expect, test } from "vitest";
import { MapManager } from "../src/game/map/MapManager";
import { mapSchema } from "../src/game/map/MapSchema";

describe("MapManager", () => {
  test("loads and validates three required maps", () => {
    const manager = new MapManager(1);
    const maps = manager.getMaps();

    expect(maps).toHaveLength(3);
    expect(maps.map((map) => map.name)).toEqual(
      expect.arrayContaining(["Neon Rooftops", "Sewer Scramble", "Arcade Foundry"])
    );
  });

  test("rotates randomly without repeating previous map", () => {
    const manager = new MapManager(3);
    let previous = manager.nextMap().id;

    for (let index = 0; index < 20; index += 1) {
      const current = manager.nextMap().id;
      expect(current).not.toBe(previous);
      previous = current;
    }
  });

  test("is deterministic when seeded", () => {
    const a = new MapManager(77);
    const b = new MapManager(77);
    const seqA: string[] = [];
    const seqB: string[] = [];

    for (let index = 0; index < 12; index += 1) {
      seqA.push(a.nextMap().id);
      seqB.push(b.nextMap().id);
    }

    expect(seqA).toEqual(seqB);
  });

  test("rejects invalid map schema payload", () => {
    expect(() =>
      mapSchema.parse({
        id: "broken",
        name: "Neon Rooftops",
        worldWidth: 640,
        worldHeight: 360,
        tileSize: 16,
        gridWidth: 40,
        gridHeight: 23,
        solidTiles: [],
        spawnTiles: [{ x: 0, y: 0 }],
        jumpLinks: []
      })
    ).toThrow();
  });
});
