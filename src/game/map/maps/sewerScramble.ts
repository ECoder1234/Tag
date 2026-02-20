import { MapData } from "../MapSchema";

const span = (from: number, to: number, y: number): { x: number; y: number }[] => {
  const out: { x: number; y: number }[] = [];
  for (let x = from; x <= to; x += 1) {
    out.push({ x, y });
  }
  return out;
};

const solidTiles = [
  ...span(0, 39, 22),
  ...span(0, 6, 18),
  ...span(9, 17, 15),
  ...span(20, 30, 12),
  ...span(33, 39, 18),
  ...span(13, 26, 8)
];

export const sewerScramble: MapData = {
  id: "sewer-scramble",
  name: "Sewer Scramble",
  worldWidth: 640,
  worldHeight: 360,
  tileSize: 16,
  gridWidth: 40,
  gridHeight: 23,
  solidTiles,
  spawnTiles: [
    { x: 2, y: 17 },
    { x: 14, y: 14 },
    { x: 25, y: 11 },
    { x: 36, y: 17 }
  ],
  jumpLinks: [
    { from: { x: 6, y: 18 }, to: { x: 9, y: 15 } },
    { from: { x: 17, y: 15 }, to: { x: 20, y: 12 } },
    { from: { x: 30, y: 12 }, to: { x: 33, y: 18 } },
    { from: { x: 22, y: 12 }, to: { x: 20, y: 8 } }
  ]
};