import { eq } from "drizzle-orm";
import { db } from "../db/postgres";
import { cities } from "../db/schema";

export class CityService {
  async getAll() {
    return await db.select().from(cities);
  }

  async getById(id: number) {
    return await db.query.cities.findFirst({
      where: eq(cities.id, id),
    });
  }

  async create(title: string) {
    const isCity = await db.query.cities.findFirst({
      where: eq(cities.title, title),
    });
    if (!isCity) {
      throw new Error("City is exist");
    }

    const [city] = await db
      .insert(cities)
      .values({ title })
      .returning();
    return city;
  }

  async delete(id: number) {
    await db.delete(cities).where(eq(cities.id, id));
    return { success: true };
  }
}