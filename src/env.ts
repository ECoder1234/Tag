import { z } from "zod";

const boolSchema = z
  .preprocess((value) => {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      return value.toLowerCase() === "true";
    }
    return false;
  }, z.boolean())
  .default(false);

const envSchema = z.object({
  ENABLE_CG_LEADERBOARD_MVP: boolSchema
});

export type RuntimeEnv = z.infer<typeof envSchema>;

export const ENV: RuntimeEnv = envSchema.parse({
  ENABLE_CG_LEADERBOARD_MVP: import.meta.env.ENABLE_CG_LEADERBOARD_MVP
});
