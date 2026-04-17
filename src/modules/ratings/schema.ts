/**
 * Clash Server - Tournament Management System
 * Copyright (C) 2026 Clash Contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
  serial,
  json,
  real,
  uniqueIndex,
  index,
  smallint,
  boolean
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { MatchMetadata, SystemState, TopUsers } from "../../shared/utils/rating"
import { users } from "../users/schema";
import { nominations, tournaments, weapons } from "../tournaments/schema";
import { MatchTypesType } from "../../shared/typings";

// Рейтинги пользователей по оружию + номинации
export const userRatings = pgTable("user_ratings", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  weaponId: integer("weapon_id")
    .references(() => weapons.id, { onDelete: "cascade" })
    .notNull(),
  nominationId: integer("nomination_id")
    .references(() => nominations.id, { onDelete: "cascade" })
    .notNull(),

  // Glicko-2 параметры
  rating: real("rating").default(1500).notNull(),
  rd: real("rd").default(300).notNull(),
  volatility: real("volatility").default(0.06).notNull(),

  // Статистика
  matchesCount: integer("matches_count").default(0).notNull(),
  wins: integer("wins").default(0).notNull(),
  losses: integer("losses").default(0).notNull(),
  draws: integer("draws").default(0).notNull(),

  // Ранги
  currentRank: integer("current_rank"),
  previousRank: integer("previous_rank"),

  // Временные метки
  lastTournamentId: integer("last_tournament_id").references(() => tournaments.id),
  lastTournamentAt: timestamp("last_tournament_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  // ========== ПОЛЯ ДЛЯ БЛОКЧЕЙН СИНХРОНИЗАЦИИ ==========
  // Хеш данных рейтинга
  blockchainHash: varchar("blockchain_hash", { length: 66 }),
  // Статус синхронизации
  syncedToBlockchain: boolean("synced_to_blockchain").default(false),
  syncedFromBlockchain: boolean("synced_from_blockchain").default(false),
  // Временные метки
  blockchainSyncedAt: timestamp("blockchain_synced_at"),
  // Хеш транзакции
  blockchainTxHash: varchar("blockchain_tx_hash", { length: 66 })
}, (table) => ({
  // Уникальный индекс: один рейтинг на комбинацию user + weapon + nomination
  uniqueUserWeaponNomination: uniqueIndex("unique_user_weapon_nomination")
    .on(table.userId, table.weaponId, table.nominationId),

  // Индексы для лидербордов (без DESC — сортировка в запросе)
  weaponNominationRatingIdx: index("weapon_nomination_rating_idx")
    .on(table.weaponId, table.nominationId, table.rating),
  weaponNominationRankIdx: index("weapon_nomination_rank_idx")
    .on(table.weaponId, table.nominationId, table.currentRank),
  userIdx: index("user_ratings_user_idx").on(table.userId),
}));

// История изменений рейтингов (для графиков и аудита)
export const ratingHistory = pgTable("rating_history", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  tournamentId: integer("tournament_id")
    .references(() => tournaments.id, { onDelete: "set null" }),

  weaponId: integer("weapon_id").notNull(),
  nominationId: integer("nomination_id").notNull(),

  // Значения до турнира
  ratingBefore: real("rating_before").notNull(),
  rdBefore: real("rd_before").notNull(),
  volatilityBefore: real("volatility_before").notNull(),
  rankBefore: integer("rank_before"),

  // Значения после турнира
  ratingAfter: real("rating_after").notNull(),
  rdAfter: real("rd_after").notNull(),
  volatilityAfter: real("volatility_after").notNull(),
  rankAfter: integer("rank_after"),

  // Изменения (генерируемые колонки для удобства)
  ratingChange: real("rating_change"),
  rankChange: integer("rank_change"),

  // Статистика турнира для этого пользователя
  matchesPlayed: integer("matches_played").notNull(),
  wins: integer("wins").default(0),
  losses: integer("losses").default(0),
  draws: integer("draws").default(0),

  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
}, (table) => ({
  // Индексы для быстрой выборки истории (без DESC — сортировка в запросе)
  userWeaponNominationIdx: index("history_user_weapon_nomination_idx")
    .on(table.userId, table.weaponId, table.nominationId, table.recordedAt),
  tournamentIdx: index("history_tournament_idx").on(table.tournamentId),
}));

// Матчи турниров (детальная статистика)
export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id")
    .references(() => tournaments.id, { onDelete: "cascade" })
    .notNull(),

  // Участники
  redId: uuid("red_id")
    .references(() => users.id)
    .notNull(),
  blueId: uuid("blue_id")
    .references(() => users.id)
    .notNull(),

  // Оружие и номинация этого матча
  nominationId: integer("nomination_id").references(() => nominations.id).notNull(),

  // Результат с точки зрения fighterRed: 0 = проиграл, 0.5 = ничья, 1 = победил
  resultRed: real("result_red").notNull(),

  // Детальный результат
  scoreRed: integer("score_red").default(0),
  scoreBlue: integer("score_blue").default(0),

  // Детали фехтования
  doubleHits: integer("double_hits").default(0),
  protestsRed: integer("protests_red").default(0),
  protestsBlue: integer("protests_blue").default(0),
  warningsRed: integer("warnings_red").default(0),
  warningsBlue: integer("warnings_blue").default(0),
  type: varchar("type", { length: 20 }).$type<MatchTypesType>().default("pool"),
  poolIndex: smallint("pool_index").default(0),

  // Дополнительные данные (видео, заметки судьи)
  metadata: json("metadata").$type<MatchMetadata>().default({}),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  // ========== ПОЛЯ ДЛЯ БЛОКЧЕЙН СИНХРОНИЗАЦИИ ==========
  // Хеш данных матча
  blockchainHash: varchar("blockchain_hash", { length: 66 }),
  // Статус синхронизации
  syncedToBlockchain: boolean("synced_to_blockchain").default(false),
  syncedFromBlockchain: boolean("synced_from_blockchain").default(false),
  // Временные метки
  blockchainSyncedAt: timestamp("blockchain_synced_at"),
  // Хеш транзакции
  blockchainTxHash: varchar("blockchain_tx_hash", { length: 66 })
}, (table) => ({
  tournamentIdx: index("matches_tournament_idx").on(table.tournamentId),
  fightersIdx: index("matches_fighters_idx").on(table.redId, table.blueId),
  nominationIdx: index("matches_nomination_idx")
    .on(table.tournamentId, table.nominationId),
}));

// Кэш лидербордов (для производительности)
export const leaderboardCache = pgTable("leaderboard_cache", {
  id: serial("id").primaryKey(),
  weaponId: integer("weapon_id").notNull(),
  nominationId: integer("nomination_id").notNull(),

  // JSON массив топ-N
  topUsers: json("top_users").$type<TopUsers[]>().notNull(),

  totalUsers: integer("total_users").notNull(),
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  validUntil: timestamp("valid_until").notNull(),
}, (table) => ({
  uniqueWeaponNomination: uniqueIndex("unique_leaderboard_cache")
    .on(table.weaponId, table.nominationId),
}));

// Снапшоты системы (для бэкапов)
export const systemSnapshots = pgTable("system_snapshots", {
  id: serial("id").primaryKey(),

  // Полное состояние сериализованной системы
  snapshotData: json("snapshot_data").$type<SystemState>().notNull(),

  // Метаданные
  usersCount: integer("users_count").notNull(),
  ratingsCount: integer("ratings_count").notNull(),
  tournamentsCount: integer("tournaments_count").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  note: varchar("note", { length: 255 }),
}, (table) => ({
  timeIdx: index("snapshot_time_idx").on(table.createdAt),
}));

// ========== ОТНОШЕНИЯ ==========

export const userRatingsRelations = relations(userRatings, ({ one }) => ({
  user: one(users, {
    fields: [userRatings.userId],
    references: [users.id],
  }),
  weapon: one(weapons, {
    fields: [userRatings.weaponId],
    references: [weapons.id],
  }),
  nomination: one(nominations, {
    fields: [userRatings.nominationId],
    references: [nominations.id],
  }),
  lastTournament: one(tournaments, {
    fields: [userRatings.lastTournamentId],
    references: [tournaments.id],
  }),
}));

export const ratingHistoryRelations = relations(ratingHistory, ({ one }) => ({
  user: one(users, {
    fields: [ratingHistory.userId],
    references: [users.id],
  }),
  tournament: one(tournaments, {
    fields: [ratingHistory.tournamentId],
    references: [tournaments.id],
  }),
}));

export const matchesRelations = relations(matches, ({ one }) => ({
  tournament: one(tournaments, {
    fields: [matches.tournamentId],
    references: [tournaments.id],
  }),
  red: one(users, {
    fields: [matches.redId],
    references: [users.id]
  }),
  blue: one(users, {
    fields: [matches.blueId],
    references: [users.id]
  }),
  nomination: one(nominations, {
    fields: [matches.nominationId],
    references: [nominations.id],
  }),
}));

// ========== ТИПЫ ==========

export type UserRating = typeof userRatings.$inferSelect;
export type RatingHistory = typeof ratingHistory.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type LeaderboardCache = typeof leaderboardCache.$inferSelect;
export type SystemSnapshot = typeof systemSnapshots.$inferSelect;

export type NewUserRating = typeof userRatings.$inferInsert;
export type NewRatingHistory = typeof ratingHistory.$inferInsert;
export type NewMatch = typeof matches.$inferInsert;