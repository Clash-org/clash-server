import { z } from "zod";

// Схема регистрации — проверяет email, пароль и username
export const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  cityId: z.number().int().positive("City ID must be positive"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  username: z.string().min(2, "Username must be at least 2 characters").max(50),
  gender: z.boolean(), // true = male, false = female
  tournamentsIds: z.array(z.number().int().positive()).default([]),
});

export const tournamentSchema = z.object({
  title: z.string().min(1).max(255),
  weaponsIds: z.array(z.number().int().positive()).default([]),
  nominationsIds: z.array(z.number().int().positive()).default([]),
});

export const weaponSchema = z.object({
  title: z.string().min(1).max(255),
});

export const nominationSchema = z.object({
  title: z.string().min(1).max(255),
});

// Схема логина — проверяет email и пароль
export const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export const citySchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
});

// Типы TypeScript, автоматически созданные из схем
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CityInput = z.infer<typeof citySchema>;
export type TournamentInput = z.infer<typeof tournamentSchema>;