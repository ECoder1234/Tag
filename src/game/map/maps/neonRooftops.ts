import { MapData } from "../MapSchema";

const createRange = (from: number, to: number, y: number): { x: number; y: number }[] => {
  const tiles: { x: number; y: number }[] = [];
  for (let x = from; x <= to; x += 1) {
    tiles.push({ x, y });
  }
  return tiles;
};

const solidTiles = [
  ...createRange(0, 39, 22),
  ...createRange(2, 11, 17),
  ...createRange(15, 24, 14),
  ...createRange(28, 37, 17),
  ...createRange(6, 13, 10),
  ...createRange(26, 33, 9)
];

export const neonRooftops: MapData = {
  id: "neon-rooftops",
  name: "Neon Rooftops",
  worldWidth: 640,
  worldHeight: 360,
  tileSize: 16,
  gridWidth: 40,
  gridHeight: 23,
  solidTiles,
  spawnTiles: [
    { x: 3, y: 16 },
    { x: 10, y: 16 },
    { x: 30, y: 16 },
    { x: 36, y: 16 }
  ],
  jumpLinks: [
    { from: { x: 11, y: 17 }, to: { x: 15, y: 14 } },
    { from: { x: 24, y: 14 }, to: { x: 28, y: 17 } },
    { from: { x: 13, y: 10 }, to: { x: 26, y: 9 } }
  ]
};