import { describe, expect, test } from "vitest";
import { SaveManager } from "../src/data/SaveManager";
import { RoundManager } from "../src/game/RoundManager";
import { MapManager } from "../src/game/map/MapManager";
import { PlayerId, PlayerInputState } from "../src/game/types";
import { CrazyGamesManager } from "../src/sdk/CrazyGamesManager";

const makeInputs = (): Record<PlayerId, PlayerInputState> => ({
  0: { left: false, right: true, jump: false, ability: false, joined: true },
  1: { left: true, right: false, jump: false, ability: false, joined: true },
  2: { left: false, right: false, jump: false, ability: false, joined: false },
  3: { left: false, right: false, jump: false, ability: false, joined: false }
});

describe("Simulation determinism", () => {
  test("fixed-step simulation is consistent across frame chunking", async () => {
    const cgA = new CrazyGamesManager();
    const cgB = new CrazyGamesManager();

    const rmA = new RoundManager(new MapManager(101), new SaveManager(cgA), cgA, () => undefined, 777);
    const rmB = new RoundManager(new MapManager(101), new SaveManager(cgB), cgB, () => undefined, 777);

    await rmA.initSession([0, 1]);
    await rmB.initSession([0, 1]);

    const inputs = makeInputs();

    for (let index = 0; index < 100; index += 1) {
      rmA.update(10, inputs);
    }

    for (let index = 0; index < 20; index += 1) {
      rmB.update(50, inputs);
    }

    const a = rmA.getSnapshot();
    const b = rmB.getSnapshot();

    expect(a.itPlayerId).toBe(b.itPlayerId);
    expect(a.scores).toEqual(b.scores);

    for (const playerId of a.joinedPlayers) {
      expect(a.players[playerId].position.x).toBeCloseTo(b.players[playerId].position.x, 6);
      expect(a.players[playerId].position.y).toBeCloseTo(b.players[playerId].position.y, 6);
      expect(a.players[playerId].velocity.y).toBeCloseTo(b.players[playerId].velocity.y, 6);
    }
  });
});