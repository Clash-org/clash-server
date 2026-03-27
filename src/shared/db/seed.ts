/**
 * Clash Server - Tournament Management System
 * Copyright (C) 2026 Clash Contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { nominations, nominationsCN, nominationsRU, weapons, weaponsCN, weaponsRU } from "../../modules/tournaments/schema.js";
import { cities, citiesCN, citiesRU } from "../../modules/users/schema.js";
import citiesJSON from "../translations/cities.json"
import weaponsJSON from "../translations/weapons.json"
import { nominations as nominationsJSON } from "../translations/nominations.js"
import { defaultWeaponsNominations } from "../utils/rating.js";
import { db } from "./postgres.js";

// Общая функция для сидирования любой таблицы
async function seedTable(
  table: any,
  items: readonly string[],
  tableName: string,
  callback?: () => any[]
) {
  console.log(`🌱 Seeding ${tableName}...`);

  try {
    // Проверяем сколько записей уже есть
    const existing = await db.select().from(table);

    if (existing.length > 0) {
      console.log(`  ℹ️  ${existing.length} ${tableName} already exist, skipping`);
      return existing;
    }

    // Вставляем все записи
    const inserted = await db.insert(table)
      .values(callback ? callback() :
        items.map(title => ({ title }))
      )
      .returning();

    console.log(`  ✅ Seeded ${items.length} ${tableName}`);
    return inserted;
  } catch (error: any) {
    console.error(`  ❌ Error seeding ${tableName}:`, error.message);
    throw error;
  }
}

// Основная функция сидирования
export async function seedDatabase() {
  console.log("🚀 Starting database seeding...\n");

  try {
    // Сидируем города
    await seedTable(cities, citiesJSON.en, "cities");
    await seedTable(citiesRU, citiesJSON.ru, "citiesRU");
    await seedTable(citiesCN, citiesJSON.cn, "citiesCN");

    // Сидируем оружие
    await seedTable(weapons, weaponsJSON.en, "weapons");
    await seedTable(weaponsRU, weaponsJSON.ru, "weaponsRU");
    await seedTable(weaponsCN, weaponsJSON.cn, "weaponsCN");

    await seedTable(nominations, [], "nominations", ()=>{
        return defaultWeaponsNominations.map(nom => ({
          title: nom.title,
          weaponId: nom.weaponId as number
        }));
    });
    await seedTable(nominationsRU, nominationsJSON.ru, "nominationsRU");
    await seedTable(nominationsCN, nominationsJSON.cn, "nominationsCN");
    console.log("\n✨ Database seeding completed successfully!");
  } catch (error: any) {
    console.error("\n❌ Database seeding failed:", error.message);
    process.exit(1);
  }
}