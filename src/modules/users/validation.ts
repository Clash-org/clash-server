/**
 * Clash Server - Tournament Management System
 * Copyright (C) 2026 Clash Contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { z } from "zod";

// Схема регистрации — проверяет email, пароль и username
export const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  cityId: z.number().int().positive("City ID must be positive"),
  clubId: z.number().int().positive("Club ID must be positive"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  username: z.string().min(2, "Username must be at least 2 characters").max(50),
  gender: z.boolean(), // true = male, false = female
  tournamentsIds: z.array(z.number().int().positive()).default([]),
});

// Схема логина — проверяет email и пароль
export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export const clubSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
});

export const citySchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
});

export const userUpdateSchema = z.object({
  id: z.string().uuid(),
  email: z.string().optional(),
  username: z.string().min(3).max(100).optional(),
  password: z.string().optional(), // bcrypt hash обычно 60 символов
  gender: z.boolean().optional(),
  clubId: z.number().int().positive().optional(),
  cityId: z.number().int().positive().optional(),
  createdAt: z.date().optional(),
  isAdmin: z.boolean().nullable().optional(),
  moderatorTournamentsIds: z.array(z.number().int()).nullable().optional(),
  totalMatches: z.number().int().nonnegative().nullable().optional(),
});

// Типы TypeScript, автоматически созданные из схем
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ClubInput = z.infer<typeof clubSchema>;
export type CityInput = z.infer<typeof citySchema>;