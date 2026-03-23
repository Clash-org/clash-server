import { z } from "zod";

// Схемы валидации
export const processTournamentSchema = z.object({
  tournamentId: z.number(),
  weaponId: z.number(),
  nominationId: z.number().int().positive(),
  matches: z
    .array(
      z.object({
        redId: z.string().uuid(),
        blueId: z.string().uuid(),
        resultRed: z.number().min(0).max(1),
        scoreRed: z.number().positive(),
        scoreBlue: z.number().positive(),
        doubleHits: z.number().positive(),
        warningsRed: z.number().positive(),
        warningsBlue: z.number().positive(),
        protestsRed: z.number().positive(),
        protestsBlue: z.number().positive(),
      })
    )
    .optional(),
  tournamentDate: z.string().datetime().optional(),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
  metadata: z.object({
    videoUrl: z.string().url().optional(),
  }).catchall(z.any()).optional()
});

export const predictMatchSchema = z.object({
  fighterRedId: z.string(),
  fighterBlueId: z.string(),
  weaponId: z.number(),
  nominationId: z.number(),
});