/**
 * Clash Server - Tournament Management System
 * Copyright (C) 2026 Clash Contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { z } from "zod";
import { CURRENCY_CODES, ParticipantStatus, TournamentStatus, TournamentSystem } from "../../shared/typings";

export const weaponSchema = z.object({
  title: z.string().min(1).max(255),
});

export const nominationSchema = z.object({
  title: z.string().min(1).max(255),
  weaponId: z.number().int().positive()
});

export const tournamentSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  cityId: z.number().int().positive(),
  date: z.string().datetime(), // ISO string, потом конвертируем в Date
  image: z.string().default(""),
  moderatorsIds: z.array(z.string().uuid()).optional(),
  nominationsIds: z.array(z.number().int().positive()).default([]),
  participantsCount: z.object({}).catchall(z.number()).transform(obj => {
  // Преобразуем строковые ключи в числа
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [Number(key), value])
  ) as Record<number, number>;
  }),
  socialMedias: z.array(z.string().url()).default([]),
  isAdditions: z.record(z.string(), z.boolean()),
  isInternal: z.boolean().optional(),
  prices: z.object({}).catchall(z.number()).transform(obj => {
  // Преобразуем строковые ключи в числа
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [Number(key), value])
  ) as Record<number, number>;
  }),
  currency: z.enum(CURRENCY_CODES).default("RUB")
});

const tournamentIdSchema = z.object({
  tournamentId: z.number().int().positive()
})

export const tournamentSchemaWithId = tournamentSchema.merge(tournamentIdSchema)

const tournamentStatusSchema = z.object({
  status: z.enum([TournamentStatus.ACTIVE, TournamentStatus.PENDING])
})

export const tournamentStatusWithIdSchema = tournamentStatusSchema.merge(tournamentIdSchema)

export const tournamentParticipantSchema = z.object({
  tournamentId: z.number().int().positive(),
  nominationId: z.number().int().positive(),
  userId: z.string(),
  status: z.enum([ParticipantStatus.REGISTERED, ParticipantStatus.CONFIRMED, ParticipantStatus.CANCELLED]),
});

export const tournamentAddParticipantSchema = z.object({
  nominationId: z.number().int().positive()
}).merge(tournamentIdSchema)

export const tournamentAddParticipantInfoSchema = z.object({
  userId: z.string(),
  info: z.record(z.any())
}).merge(tournamentIdSchema)

export const poolSchema = z.object({
  tournamentId: z.number().int().positive(),
  nominationId: z.number().int().positive(),
  time: z.number().int().positive(),
  hitZones: z.object({
    head: z.number(),
    torso: z.number(),
    arms: z.number(),
    legs: z.number(),
  }),
  moderatorId: z.string(),
  system: z.enum([TournamentSystem.HYBRID, TournamentSystem.OLYMPIC, TournamentSystem.ROBIN, TournamentSystem.SWISS]).default("hybrid"),
  pairsIds: z.array(z.tuple([z.string(), z.string()])),
  isEnd: z.boolean().optional(),
});

export type WeaponInput = z.infer<typeof weaponSchema>;
export type NominationInput = z.infer<typeof nominationSchema>;
export type TournamentInput = z.infer<typeof tournamentSchema>;
export type TournamentParticipantInput = z.infer<typeof tournamentParticipantSchema>;