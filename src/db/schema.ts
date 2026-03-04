import { pgTable, uuid, varchar, timestamp, text, integer, serial, boolean, json } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ========== Справочники ==========

export const cities = pgTable("cities", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const weapons = pgTable("weapons", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const nominations = pgTable("nominations", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ========== Турниры ==========

export const tournaments = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  // Используем JSON вместо массива
  weaponsIds: json("weapons_ids").$type<number[]>().default([]),
  nominationsIds: json("nominations_ids").$type<number[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ========== Пользователи ==========

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 100 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  gender: boolean("gender"),
  cityId: integer("city_id").references(() => cities.id),
  // JSON вместо массива
  tournamentsIds: json("tournaments_ids").$type<number[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ========== Отношения ==========

export const citiesRelations = relations(cities, ({ many }) => ({
  users: many(users),
}));

export const usersRelations = relations(users, ({ one }) => ({
  city: one(cities, {
    fields: [users.cityId],
    references: [cities.id],
  }),
}));

// ========== Типы ==========

export type City = typeof cities.$inferSelect;
export type Weapon = typeof weapons.$inferSelect;
export type Nomination = typeof nominations.$inferSelect;
export type Tournament = typeof tournaments.$inferSelect;
export type User = typeof users.$inferSelect;

export type NewCity = typeof cities.$inferInsert;
export type NewWeapon = typeof weapons.$inferInsert;
export type NewNomination = typeof nominations.$inferInsert;
export type NewTournament = typeof tournaments.$inferInsert;
export type NewUser = typeof users.$inferInsert;