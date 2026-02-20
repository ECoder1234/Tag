import { z } from "zod";

const coordinateSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative()
});

const jumpLinkSchema = z.object({
  from: coordinateSchema,
  to: coordinateSchema
});

export const mapSchema = z.object({
  id: z.string().min(1),
  name: z.enum(["Neon Rooftops", "Sewer Scramble", "Arcade Foundry"]),
  worldWidth: z.literal(640),
  worldHeight: z.literal(360),
  tileSize: z.literal(16),
  gridWidth: z.literal(40),
  gridHeight: z.literal(23),
  solidTiles: z.array(coordinateSchema),
  spawnTiles: z.array(coordinateSchema).min(4),
  jumpLinks: z.array(jumpLinkSchema)
});

export type MapData = z.infer<typeof mapSchema>;