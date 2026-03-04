import { db } from "../db/postgres.js";
import { tournaments, weapons, nominations } from "../db/schema.js";
import { eq } from "drizzle-orm";

export class WeaponService {
  async getAll() {
    return await db.select().from(weapons);
  }

  async create(title: string) {
    const [weapon] = await db.insert(weapons).values({ title }).returning();
    return weapon;
  }
}

export class NominationService {
  async getAll() {
    return await db.select().from(nominations);
  }

  async create(title: string) {
    const [nomination] = await db.insert(nominations).values({ title }).returning();
    return nomination;
  }
}

export class TournamentService {
  async getAll() {
    return await db.select().from(tournaments);
  }

  async getById(id: number) {
    return await db.query.tournaments.findFirst({
      where: eq(tournaments.id, id),
    });
  }

  async create(data: { title: string; weaponsIds?: number[]; nominationsIds?: number[] }) {
    const [tournament] = await db
      .insert(tournaments)
      .values({
        title: data.title,
        weaponsIds: data.weaponsIds || [],
        nominationsIds: data.nominationsIds || [],
      })
      .returning();
    return tournament;
  }

  async addUserToTournament(userId: string, tournamentId: number) {
    // Добавляем tournamentId в массив пользователя
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) throw new Error("User not found");

    const currentIds = user.tournamentsIds || [];
    if (currentIds.includes(tournamentId)) {
      throw new Error("User already registered for this tournament");
    }

    await db
      .update(users)
      .set({ tournamentsIds: [...currentIds, tournamentId] })
      .where(eq(users.id, userId));

    return { success: true };
  }
}

// Импорт users для метода выше
import { users } from "../db/schema.js";