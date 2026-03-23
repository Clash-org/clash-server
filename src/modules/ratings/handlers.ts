import { ratingRepository, ratingService } from "./index.js";
import { predictMatchSchema, processTournamentSchema } from "./validation.js"
import { db } from "../../shared/db/postgres.js"
import { TournamentMatch } from "../../shared/utils/rating.js";

// Инициализация сервиса
await ratingService.initialize();

export const ratingHandlers = {
  // ========== LEADERBOARD ==========
  async getLeaderboard(weaponId: number, nominationId: number, limit: number) {
    return await ratingService.getLeaderboard(weaponId, nominationId, limit);
  },

  // ========== USER HISTORY & STATS ==========
  async getUserHistory(token: string, userId: string, weaponId: number, nominationId: number) {
    return await ratingService.getUserRatingHistory(token, userId, weaponId, nominationId);
  },

  async getUserStats(userId: string) {
    let stats = ratingService.getSystem().getFighterStats(userId);
    if (!stats) throw new Error("User not found");
    const nominations = await ratingRepository.getNominations()
    for (let ratingKey in stats.ratings) {
      for (let nom of nominations) {
        if (`${nom.weapon?.title}_${nom.title}` === stats?.ratings[ratingKey].weaponSubtype) {
          stats!.ratings[ratingKey] = {
            ...stats?.ratings[ratingKey],
            id: nom.id
          }
        }
      }
    }

    return stats;
  },

  // ========== TOURNAMENT PROCESSING ==========
  async processTournament(token: string, body: unknown) {
    const input = processTournamentSchema.parse(body);

    const tournamentDate = input.tournamentDate
      ? new Date(input.tournamentDate)
      : undefined;

    const matches: TournamentMatch[]|undefined = input.matches?.map((m) => ({
      redId: m.redId,
      blueId: m.blueId,
      resultRed: m.resultRed as 0 | 0.5 | 1,
      scoreRed: m.scoreRed,
      scoreBlue: m.scoreBlue,
      doubleHits: m.doubleHits,
      warningsRed: m.warningsRed,
      warningsBlue: m.warningsBlue,
      protestsRed: m.protestsRed,
      protestsBlue: m.protestsBlue
    }));

    const results = await ratingService.processTournament(
      token,
      input.tournamentId,
      input.weaponId,
      input.nominationId,
      matches,
      tournamentDate,
      input.startedAt ? new Date(input.startedAt) : undefined,
      input.endedAt ? new Date(input.endedAt) : undefined,
      input.metadata
    );

    return {
      processed: results.length,
      results: results.map((r) => ({
        userId: r.redId,
        user: r.user,
        weaponSubtype: r.weaponSubtype,
        ratingChange: Math.round(r.ratingAfter - r.ratingBefore),
        newRating: Math.round(r.ratingAfter),
        newRd: Math.round(r.rdAfter),
        rankChange: r.rankChange,
        newRank: r.rankAfter,
        matchesPlayed: r.matchesPlayed,
      })),
    };
  },

  // ========== PREDICTION ==========
  async predictMatch(body: unknown) {
    const input = predictMatchSchema.parse(body);

    // Используем db напрямую, не через ratingService
    const weapon = await ratingRepository.getWeaponById(input.weaponId)
    const nomination = await ratingRepository.getNominationById(input.nominationId)

    if (!weapon || !nomination) {
      throw new Error("Weapon or nomination not found");
    }

    const weaponType = weapon.title;
    const category = nomination.title;

    const prediction = ratingService
      .getSystem()
      .predictMatch(input.fighterRedId, input.fighterBlueId, weaponType, category);

    return {
      fighterRed: {
        id: input.fighterRedId,
        winProbability: Math.round(prediction.fighterAWin * 100),
      },
      fighterBlue: {
        id: input.fighterBlueId,
        winProbability: Math.round(prediction.fighterBWin * 100),
      },
    };
  },

  // ========== SNAPSHOTS ==========
  async createSnapshot(token: string, note?: string) {
    await ratingService.createSnapshot(token, note);
    return { success: true, note: note || "Manual snapshot" };
  },

  async getSnapshots() {
    const snapshots = await db.query.systemSnapshots.findMany({
      orderBy: (s, { desc }) => [desc(s.createdAt)],
      limit: 10,
    });

    return snapshots.map((s) => ({
      id: s.id,
      usersCount: s.usersCount,
      ratingsCount: s.ratingsCount,
      tournamentsCount: s.tournamentsCount,
      createdAt: s.createdAt,
      note: s.note,
    }));
  },

  async getMatches(tournamentId: number, nominationId: number) {
    return await ratingService.getMatches(tournamentId, nominationId)
  },

  // ========== REFERENCE DATA ==========
  async getWeapons() {
    const weapons = await db.query.weapons.findMany({
      orderBy: (w, { asc }) => [asc(w.title)],
    });
    return weapons;
  },

  async getNominations() {
    const nominations = await db.query.nominations.findMany({
      orderBy: (n, { asc }) => [asc(n.title)],
    });
    return nominations;
  },
};