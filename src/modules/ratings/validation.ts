/**
 * Clash Server - Tournament Management System
 * Copyright (C) 2026 Clash Contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { z } from "zod";
import { MatchTypes } from "../../shared/typings";

export const mainDataSchema = z.object({
  tournamentId: z.number().int().positive(),
  weaponId: z.number().int().positive(),
  nominationId: z.number().int().positive()
})

export const matchSchema = z.object({
  redId: z.string(),
  blueId: z.string(),
  resultRed: z.number().min(0).max(1),
  scoreRed: z.number(),
  scoreBlue: z.number(),
  doubleHits: z.number(),
  warningsRed: z.number(),
  warningsBlue: z.number(),
  protestsRed: z.number(),
  protestsBlue: z.number(),
  metadata: z.object({
    videoUrl: z.string().url().optional(),
  }).catchall(z.any()).optional(),
  type: z.enum([MatchTypes.POOL, MatchTypes.PLAYOFF]).default("pool").optional(),
  poolIndex: z.number().optional()
})

export const processTournamentSchema = z.object({
  winners: z.array(z.string()),
  matches: z.array(matchSchema).optional(),
  tournamentDate: z.string().datetime().optional(),
}).merge(mainDataSchema)

export const predictMatchSchema = z.object({
  redId: z.string(),
  blueId: z.string(),
  weaponId: z.number(),
  nominationId: z.number(),
});