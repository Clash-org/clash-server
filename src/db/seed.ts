import { db } from "./postgres.js";
import { cities } from "./schema.js";

const defaultCities = [
  "Москва",
  "Санкт-Петербург",
  "Новосибирск",
  "Екатеринбург",
  "Казань",
  "Нижний Новгород",
  "Челябинск",
  "Самара",
  "Омск",
  "Ростов-на-Дону"
];

export async function seedCities() {
  console.log("🌱 Seeding cities...");

  try {
    // Проверяем сколько городов уже есть
    const existing = await db.select().from(cities);

    if (existing.length > 0) {
      console.log(`  ℹ️ ${existing.length} cities already exist, skipping`);
      return;
    }

    // Вставляем все города
    await db.insert(cities).values(
      defaultCities.map(title => ({ title }))
    );

    console.log(`  ✅ Seeded ${defaultCities.length} cities`);
  } catch (error: any) {
    console.error("  ❌ Seed error:", error.message);
  }
}