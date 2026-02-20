import { mapSchema, MapData } from "./MapSchema";
import { arcadeFoundry } from "./maps/arcadeFoundry";
import { neonRooftops } from "./maps/neonRooftops";
import { sewerScramble } from "./maps/sewerScramble";
import { PlayerId, Vector2 } from "../types";

const PLAYER_IDS: readonly PlayerId[] = [0, 1, 2, 3];

export class MapManager {
  private readonly maps: readonly MapData[];
  private lastMapId: string | null = null;
  private seed: number;
  private readonly solidCache = new Map<string, Set<number>>();

  constructor(seed = 1337) {
    this.seed = seed;
    this.maps = [neonRooftops, sewerScramble, arcadeFoundry].map((map) => mapSchema.parse(map));
  }

  private random(): number {
    this.seed = (1664525 * this.seed + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  nextMap(): MapData {
    if (this.maps.length === 1) {
      const onlyMap = this.maps[0];
      if (onlyMap === undefined) {
        throw new Error("No maps configured");
      }
      this.lastMapId = onlyMap.id;
      return onlyMap;
    }

    const candidates = this.maps.filter((map) => map.id !== this.lastMapId);
    const index = Math.floor(this.random() * candidates.length);
    const selected = candidates[index] ?? candidates[0];
    if (selected === undefined) {
      throw new Error("No map candidates available");
    }
    this.lastMapId = selected.id;
    return selected;
  }

  isSolidAtPixel(map: MapData, x: number, y: number): boolean {
    const tileX = Math.floor(x / map.tileSize);
    const tileY = Math.floor(y / map.tileSize);
    let solidSet = this.solidCache.get(map.id);
    if (solidSet === undefined) {
      solidSet = new Set<number>();
      for (const tile of map.solidTiles) {
        solidSet.add(tile.y * map.gridWidth + tile.x);
      }
      this.solidCache.set(map.id, solidSet);
    }
    return solidSet.has(tileY * map.gridWidth + tileX);
  }

  getSpawnPositions(map: MapData): Record<PlayerId, Vector2> {
    const first = map.spawnTiles[0];
    const second = map.spawnTiles[1];
    const third = map.spawnTiles[2];
    const fourth = map.spawnTiles[3];
    if (first === undefined || second === undefined || third === undefined || fourth === undefined) {
      throw new Error("Map requires at least 4 spawn points");
    }

    return {
      0: {
        x: first.x * map.tileSize + map.tileSize / 2,
        y: first.y * map.tileSize
      },
      1: {
        x: second.x * map.tileSize + map.tileSize / 2,
        y: second.y * map.tileSize
      },
      2: {
        x: third.x * map.tileSize + map.tileSize / 2,
        y: third.y * map.tileSize
      },
      3: {
        x: fourth.x * map.tileSize + map.tileSize / 2,
        y: fourth.y * map.tileSize
      }
    };
  }

  getJoinedSpawnPositions(map: MapData, joined: PlayerId[]): Record<PlayerId, Vector2> {
    const spawns = this.getSpawnPositions(map);
    const out: Partial<Record<PlayerId, Vector2>> = {};
    for (const playerId of PLAYER_IDS) {
      if (joined.includes(playerId)) {
        out[playerId] = spawns[playerId];
      }
    }
    return out as Record<PlayerId, Vector2>;
  }

  getMaps(): readonly MapData[] {
    return this.maps;
  }
}
