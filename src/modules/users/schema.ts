/**
 * Clash Server - Tournament Management System
 * Copyright (C) 2026 Clash Contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { relations } from "drizzle-orm";
import { boolean, integer, json, pgTable, serial, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { tournamentParticipants } from "../tournaments/schema";
import { matches, ratingHistory, userRatings } from "../ratings/schema";

export const clubs = pgTable("clubs", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cities = pgTable("cities", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const citiesCN = pgTable("cities_cn", {
  id: integer("id").references(() => cities.id, { onDelete: "cascade" }).primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const citiesRU = pgTable("cities_ru", {
  id: integer("id").references(() => cities.id, { onDelete: "cascade" }).primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 100 }).notNull(),
  image: varchar("image").default(""),
  passwordHash: text("password_hash").notNull(),
  gender: boolean("gender").notNull(),
  clubId: integer("club_id").references(() => clubs.id).notNull(),
  isAdmin: boolean("is_admin").default(false),
  moderatorTournamentsIds: json("moderator_tournaments_ids").$type<number[]>().default([]),
  cityId: integer("city_id").references(() => cities.id).notNull(),
  // Новое поле: общее количество боёв (для быстрой статистики)
  totalMatches: integer("total_matches").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  // ========== ПОЛЯ ДЛЯ БЛОКЧЕЙН СИНХРОНИЗАЦИИ ==========
  // Уникальный числовой ID для блокчейна (блокчейн не поддерживает UUID)
  blockchainId: integer("blockchain_id").unique(),
  // Хеш данных пользователя в блокчейне
  blockchainHash: varchar("blockchain_hash", { length: 66 }),
  // Статус синхронизации
  syncedToBlockchain: boolean("synced_to_blockchain").default(false),
  syncedFromBlockchain: boolean("synced_from_blockchain").default(false),
  // Временные метки синхронизации
  blockchainSyncedAt: timestamp("blockchain_synced_at"),
  blockchainUpdatedAt: timestamp("blockchain_updated_at"),
  // Хеш транзакции для аудита
  blockchainTxHash: varchar("blockchain_tx_hash", { length: 66 })
});

export const usersRelations = relations(users, ({ one, many }) => ({
  city: one(cities, {
    fields: [users.cityId],
    references: [cities.id],
  }),
  club: one(clubs, {
    fields: [users.clubId],
    references: [clubs.id]
  }),
  ratings: many(userRatings),
  ratingHistory: many(ratingHistory),
  tournaments: many(tournamentParticipants),
  matchesAsA: many(matches, { relationName: "fighterRed" }),
  matchesAsB: many(matches, { relationName: "fighterBlue" }),
}));

export const citiesRelations = relations(cities, ({ many }) => ({
  users: many(users),
}));

export type Club = typeof clubs.$inferSelect;
export type City = typeof cities.$inferSelect;
export type User = typeof users.$inferSelect;

export type NewClub = typeof clubs.$inferInsert;
export type NewCity = typeof cities.$inferInsert;
export type NewUser = typeof users.$inferInsert;