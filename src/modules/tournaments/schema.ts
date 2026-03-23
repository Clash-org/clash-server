import { boolean, integer, json, pgTable, serial, smallint, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { AdditionsInfoType, CurrencyType, HitZonesType, IsAdditionsType, ParticipantCountType, ParticipantStatus, ParticipantStatusType, TournamentStatus, TournamentStatusType, TournamentSystemType } from "../../shared/typings";
import { cities, users } from "../users/schema";
import { relations } from "drizzle-orm";
import { matches, ratingHistory, userRatings } from "../ratings/schema";
import { NominationType, WeaponType } from "../../shared/utils/rating";

export const weapons = pgTable("weapons", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).$type<WeaponType>().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const weaponsRU = pgTable("weapons_ru", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).$type<WeaponType>().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const weaponsCN = pgTable("weapons_cn", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).$type<WeaponType>().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const nominations = pgTable("nominations", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).$type<NominationType>().notNull(),
  weaponId: integer("weapon_id").references(() => weapons.id, {
    onDelete: 'set null' // при удалении оружия, связь обнуляется
  }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const nominationsRU = pgTable("nominations_ru", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).$type<NominationType>().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const nominationsCN = pgTable("nominations_cn", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).$type<NominationType>().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tournaments = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  nominationsIds: json("nominations_ids").$type<number[]>().notNull(),
  organizerId: uuid("organizer_id").references(() => users.id).notNull(),
  image: varchar("image").default("").notNull(),
  moderatorsIds: json("moderators_ids").$type<string[]>().default([]),
  status: varchar("status", { length: 20 }).$type<TournamentStatusType>().default(TournamentStatus.PENDING).notNull(),
  date: timestamp("date").notNull(),
  cityId: integer("city_id").references(() => cities.id).notNull(),
  description: varchar("description").notNull(),
  socialMedias: json("social_medias").$type<string[]>().default([]),
  prices: json("prices").$type<ParticipantCountType>().default({}).notNull(),
  currency: varchar("currency", { length: 3 }).$type<CurrencyType>().default("RUB"),
  participantsCount: json("participants_count").$type<ParticipantCountType>().default({}).notNull(),
  participantsCountInFact: json("participants_count_in_fact").$type<ParticipantCountType>().default({}),
  matchesCount: json("matches_count").$type<ParticipantCountType>().default({}),
  isAdditions: json("is_additions").$type<IsAdditionsType>().default({}),
  isInternal: boolean("is_internal").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tournamentParticipants = pgTable("tournament_participants", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id")
    .references(() => tournaments.id)
    .notNull(),
  nominationId: integer("nomination_id")
    .references(() => nominations.id)
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  status: varchar("status", { length: 20 }).$type<ParticipantStatusType>().default(ParticipantStatus.REGISTERED),
  createdAt: timestamp("registered_at").defaultNow(),
});

export const pools = pgTable("pools", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id")
    .references(() => tournaments.id)
    .notNull(),
  nominationId: integer("nomination_id")
    .references(() => nominations.id)
    .notNull(),
  system: varchar("system", { length: 10 }).$type<TournamentSystemType>().default("hybrid").notNull(),
  time: smallint("time").default(90),
  hitZones: json("hit_zones").$type<HitZonesType>().default({ head: 3, torso: 3, arms: 2, legs: 2 }),
  moderatorId: uuid("moderator_id").references(() => users.id).notNull(),
  pairsIds: json("pairs_ids").$type<[string, string][]>().notNull(),
  isEnd: boolean("is_end").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const additionalParticipantsInfo = pgTable("additional_participants_info", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  tournamentId: integer("tournament_id").references(() => tournaments.id, { onDelete: "cascade" }).notNull(),
  info: json("info").$type<AdditionsInfoType>().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tournamentsRelations = relations(tournaments, ({ many, one }) => ({
  matches: many(matches),
  ratingHistory: many(ratingHistory),
  userRatings: many(userRatings, { relationName: "lastTournament" }),
  participants: many(tournamentParticipants),
  pools: many(pools),
  city: one(cities, {
    fields: [tournaments.cityId],
    references: [cities.id],
  }),
}));

export const weaponsRelations = relations(weapons, ({ many }) => ({
  ratings: many(userRatings),
  matches: many(matches),
}));

export const nominationsRelations = relations(nominations, ({ many, one }) => ({
  ratings: many(userRatings),
  matches: many(matches),
  weapon: one(weapons, {
    fields: [nominations.weaponId],
    references: [weapons.id],
  }),
}));

export const poolsRelations = relations(pools, ({ one })=>({
  tournament: one(tournaments, {
    fields: [pools.tournamentId],
    references: [tournaments.id]
  })
}))

export const tournamentParticipantsRelations = relations(tournamentParticipants, ({ one }) => ({
  tournament: one(tournaments, {
    fields: [tournamentParticipants.tournamentId],
    references: [tournaments.id],
  }),
  nominations: one(nominations, {
    fields: [tournamentParticipants.nominationId],
    references: [nominations.id],
  }),
  user: one(users, {
    fields: [tournamentParticipants.userId],
    references: [users.id],
  }),
}));

export const additionalParticipantsInfoRelations = relations(additionalParticipantsInfo, ({ one }) => ({
  user: one(users, {
    fields: [additionalParticipantsInfo.userId],
    references: [users.id]
  })
}))

export type Weapon = typeof weapons.$inferSelect;
export type Nomination = typeof nominations.$inferSelect;
export type Tournament = typeof tournaments.$inferSelect;
export type AdditionalParticipantsInfo = typeof additionalParticipantsInfo.$inferSelect;

export type NewWeapon = typeof weapons.$inferInsert;
export type NewNomination = typeof nominations.$inferInsert;
export type NewTournament = typeof tournaments.$inferInsert;
export type NewPool = typeof pools.$inferInsert;