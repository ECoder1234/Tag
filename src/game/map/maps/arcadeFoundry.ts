import { MapData } from "../MapSchema";

const line = (from: number, to: number, y: number): { x: number; y: number }[] => {
  const tiles: { x: number; y: number }[] = [];
  for (let x = from; x <= to; x += 1) {
    tiles.push({ x, y });
  }
  return tiles;
};

const solidTiles = [
  ...line(0, 39, 22),
  ...line(3, 9, 19),
  ...line(11, 18, 16),
  ...line(21, 28, 13),
  ...line(30, 36, 10),
  ...line(18, 25, 6),
  ...line(0, 4, 12),
  ...line(35, 39, 15)
];

export const arcadeFoundry: MapData = {
  id: "arcade-foundry",
  name: "Arcade Foundry",
  worldWidth: 640,
  worldHeight: 360,
  tileSize: 16,
  gridWidth: 40,
  gridHeight: 23,
  solidTiles,
  spawnTiles: [
    { x: 4, y: 18 },
    { x: 14, y: 15 },
    { x: 24, y: 12 },
    { x: 34, y: 9 }
  ],
  jumpLinks: [
    { from: { x: 9, y: 19 }, to: { x: 11, y: 16 } },
    { from: { x: 18, y: 16 }, to: { x: 21, y: 13 } },
    { from: { x: 28, y: 13 }, to: { x: 30, y: 10 } },
    { from: { x: 25, y: 6 }, to: { x: 35, y: 15 } }
  ]
};