/**
 * Clash Server - Tournament Management System
 * Copyright (C) 2026 Clash Contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { eq, and, asc, sql } from 'drizzle-orm';
import * as schema from './schema';
import { db } from "../../shared/db/postgres"
import {
  FencingRatingSystem,
  SystemState,
  TournamentMatch
} from '../../shared/utils/rating';
import { verifyToken } from "../../shared/utils/jwt";
import { emitEvent, RATING_EVENTS } from '../../shared/event-bus';
import { ratingRepository } from '.';

// Тип для аутентифицированного пользователя
interface AuthenticatedUser {
  id: string;
  email: string;
  username: string;
  isAdmin: boolean;
}

export class RatingService {
  private system: FencingRatingSystem | null = null;
  private initialized = false;

  /**
   * Проверка JWT токена
   */
  async validateToken(token: string): Promise<AuthenticatedUser | null> {
    const payload = await verifyToken(token);

    if (!payload || payload.type !== "access") {
      return null;
    }

    const user = await ratingRepository.getUserById(payload.sub)

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      isAdmin: Boolean(user.isAdmin)
    };
  }

  private async isAdmin(token: string) {
    const user = await this.requireAuth(token);

    const isAdmin = user.email === Bun.env.ADMIN_EMAIL || user.isAdmin;
    if (!isAdmin) {
      throw new Error("Forbidden: Admin access required");
    }
  }

  /**
   * Middleware для проверки авторизации
   */
  async requireAuth(token: string): Promise<AuthenticatedUser> {
    const user = await this.validateToken(token);
    if (!user) {
      throw new Error("Unauthorized: Invalid or expired token");
    }
    return user;
  }

  /**
   * Проверка что пользователь является организатором турнира или админом
   */
  async requireTournamentAccess(userId: string, tournamentId: number): Promise<void> {
    const tournament = await ratingRepository.getTournamentById(tournamentId)

    if (!tournament) {
        throw new Error("Tournament not found");
    }

    const user = await ratingRepository.getUserById(userId)

    if (!user) {
        throw new Error("User not found");
    }

    // Вариант 1: Проверка по organizerId в tournaments
    const isOrganizer = tournament.organizerId === userId;

    // Вариант 2: Проверка по email (временное решение)
    const isAdmin = user.email === Bun.env.ADMIN_EMAIL || user.isAdmin;

    // Вариант 3: Проверка по moderatorTournamentsIds в users
    const isModerator = user.moderatorTournamentsIds?.includes(tournamentId);

    if (!isOrganizer && !isAdmin && !isModerator) {
        throw new Error("Forbidden: You don't have permission to process this tournament");
    }
  }

  /**
   * Инициализация: загрузка состояния из PostgreSQL
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const getUsersWithRatings = await ratingRepository.getUsersWithRatings()

    const state: SystemState = {
      version: 1,
      savedAt: new Date().toISOString(),
      fighters: getUsersWithRatings.map(u => ({
        id: u.id,
        name: u.username,
        createdAt: u.createdAt.toISOString(),
        totalMatches: u.totalMatches ?? 0,
        ratings: u.ratings.map(r => ({
          weaponSubtype: `${r.weapon.title}_${r.nomination.title}`,
          rating: r.rating,
          rd: r.rd,
          volatility: r.volatility,
          matchesCount: r.matchesCount,
          lastTournamentDate: r.lastTournamentAt?.toISOString(),
          currentRank: r.currentRank ?? undefined,
          lastRank: r.previousRank ?? undefined
        }))
      }))
    };

    this.system = new FencingRatingSystem(state);
    this.initialized = true;

    console.log(`[RatingService] Загружено ${state.fighters.length} пользователей`);
  }

  /**
   * Загрузить матчи турнира из БД и конвертировать в формат для Glicko-2
   */
  async loadTournamentMatches(tournamentId: number): Promise<TournamentMatch[]> {
    const matches = await db.query.matches.findMany({
      where: eq(schema.matches.tournamentId, tournamentId)
    });

    const tournamentMatches: TournamentMatch[] = [];

    for (const match of matches) {
      tournamentMatches.push({
        redId: match.redId,
        blueId: match.blueId,
        resultRed: match.resultRed as 0 | 0.5 | 1,
        scoreRed: match.scoreRed || 0,
        scoreBlue: match.scoreBlue || 0
      });

      tournamentMatches.push({
        redId: match.blueId,
        blueId: match.redId,
        resultRed: (1 - match.resultRed) as 0 | 0.5 | 1,
        scoreRed: match.scoreBlue || 0,
        scoreBlue: match.scoreRed || 0
      });
    }

    return tournamentMatches;
  }

  /**
   * Создание первоначального рейтинга бойца
  */
  async createUserRating(userId: string) {
    const nominations = await ratingRepository.getNominations()

    for (let nom of nominations) {
      await db.insert(schema.userRatings).values({ userId, weaponId: nom.weapon.id, nominationId: nom.id })
    }
  }

  /**
   * Обработка турнира с сохранением в БД (ТРЕБУЕТ АВТОРИЗАЦИИ)
   */
  async processTournament(
    token: string,
    tournamentId: number,
    weaponId: number,
    nominationId: number,
    winners: string[],
    matches?: TournamentMatch[],
    tournamentDate?: Date
  ) {
    // Проверяем авторизацию
    const user = await this.requireAuth(token);

    // Проверяем права доступа к турниру
    await this.requireTournamentAccess(user.id, tournamentId);

    await this.initialize();

    const tournament = await ratingRepository.getTournamentById(tournamentId)

    if (!tournament) {
      throw new Error(`Tournament ${tournamentId} not found`);
    }

    const tournamentMatches = matches || await this.loadTournamentMatches(tournamentId);

    if (tournamentMatches.length === 0) {
      throw new Error('No matches found for tournament');
    }

    const nomination = await ratingRepository.getNominationById(nominationId)
    const weapon = { ...nomination!.weapon }

    if (!weapon || !nomination) {
      throw new Error('Weapon or nomination not found');
    }

    const weaponType = weapon.title;
    const category = nomination.title;
    const date = tournamentDate || tournament.date || new Date();

    const results = this.system!.processTournament(
      weaponType,
      category,
      tournamentMatches,
      date
    );

    await db.transaction(async (tx) => {
      // 1. Записываем матчи, если они ещё не были записаны
      if (!matches) { // Если матчи были загружены из БД, значит они уже есть
        console.log(`[RatingService] Матчи для турнира ${tournamentId} уже существуют в БД`);
      } else {
        for (const match of matches) {
          const existingMatch = await tx.query.matches.findFirst({
            where: and(
              eq(schema.matches.tournamentId, tournamentId),
              eq(schema.matches.redId, match.redId),
              eq(schema.matches.blueId, match.blueId),
              eq(schema.matches.nominationId, nominationId)
            )
          });

          if (!existingMatch) {
            // Создаём запись матча
            const insertedMatch = await this.createMatch({
              tournamentId,
              redId: match.redId,
              blueId: match.blueId,
              nominationId,
              resultRed: match.resultRed,
              scoreRed: match.scoreRed,
              scoreBlue: match.scoreBlue,
              doubleHits: match.doubleHits,
              warningsRed: match.warningsRed,
              warningsBlue: match.warningsBlue,
              protestsRed: match.protestsRed,
              protestsBlue: match.protestsBlue,
              type: match.type,
              poolIndex: match.poolIndex,
              metadata: match.metadata,
              syncedToBlockchain: false
            })

            console.log(`[RatingService] Создан матч ${insertedMatch.id}: ${match.redId} vs ${match.blueId} (${match.scoreRed}:${match.scoreBlue})`);
          }
        }
      }

      for (const result of results) {
        await tx.insert(schema.userRatings)
          .values({
            userId: result.userId,
            weaponId,
            nominationId,
            rating: result.ratingAfter,
            rd: result.rdAfter,
            volatility: result.volatilityAfter,
            matchesCount: result.matchesPlayed,
            currentRank: result.rankAfter,
            previousRank: result.rankBefore,
            lastTournamentId: tournamentId,
            lastTournamentAt: date,
            updatedAt: new Date(),
            syncedToBlockchain: false
          })
          .onConflictDoUpdate({
            target: [
              schema.userRatings.userId,
              schema.userRatings.weaponId,
              schema.userRatings.nominationId
            ],
            set: {
              rating: result.ratingAfter,
              rd: result.rdAfter,
              volatility: result.volatilityAfter,
              matchesCount: sql`${schema.userRatings.matchesCount} + ${result.matchesPlayed}`,
              currentRank: result.rankAfter,
              previousRank: result.rankBefore,
              lastTournamentId: tournamentId,
              lastTournamentAt: date,
              updatedAt: new Date(),
              syncedToBlockchain: false
            }
          });

        await tx.insert(schema.ratingHistory).values({
          userId: result.userId,
          tournamentId,
          weaponId,
          nominationId,
          ratingBefore: result.ratingBefore,
          rdBefore: result.rdBefore,
          volatilityBefore: result.volatilityBefore,
          rankBefore: result.rankBefore,
          ratingAfter: result.ratingAfter,
          rdAfter: result.rdAfter,
          volatilityAfter: result.volatilityAfter,
          rankAfter: result.rankAfter,
          matchesPlayed: result.matchesPlayed,
          recordedAt: new Date()
        });

        emitEvent(RATING_EVENTS.HISTORY_ADDED, { matchesPlayed: result.matchesPlayed, userId: result.userId })
      }

      emitEvent(RATING_EVENTS.PROCESS_TOURNAMENT, { participantsCount: new Set(tournamentMatches.map(m => m.redId)).size, tournamentId, nominationId, matchesCount: tournamentMatches.length / 2 })
    });

    emitEvent(RATING_EVENTS.TOURNAMENT_END, { winners: {[nominationId]: winners}, tournamentId })

    await this.invalidateLeaderboardCache(weaponId, nominationId);

    return results.map(res=>({
      ...res,
      user: ratingRepository.getUserById(res.userId)
    }));
  }

  async createMatch(data: schema.NewMatch) {
    const [match] = await db.insert(schema.matches).values({
      tournamentId: data.tournamentId,
      redId: data.redId,
      blueId: data.blueId,
      nominationId: data.nominationId,
      resultRed: data.resultRed,
      scoreRed: data.scoreRed ?? 0,
      scoreBlue: data.scoreBlue ?? 0,
      doubleHits: data.doubleHits ?? 0,
      protestsRed: data.protestsRed ?? 0,
      protestsBlue: data.protestsBlue ?? 0,
      warningsRed: data.warningsRed ?? 0,
      warningsBlue: data.warningsBlue ?? 0,
      type: data.type ?? "pool",
      metadata: data.metadata ?? {},
      poolIndex: data.poolIndex,
      syncedToBlockchain: false
    }).returning();

    return match;
  }

  /**
   * Создать снапшот системы (ТРЕБУЕТ АВТОРИЗАЦИИ АДМИНА)
   */
  async createSnapshot(token: string, note?: string): Promise<void> {
    await this.isAdmin(token)

    await this.initialize();

    const stats = this.system!.getSystemStats();
    const snapshot = this.system!.serialize();

    const tournamentsCount = await ratingRepository.getTournamentsCount()

    await db.insert(schema.systemSnapshots).values({
      snapshotData: snapshot,
      usersCount: stats.totalFighters,
      ratingsCount: stats.totalMatches,
      tournamentsCount: tournamentsCount,
      note: note || 'Manual snapshot'
    });
  }

  /**
   * Восстановление из снапшота (ТРЕБУЕТ АВТОРИЗАЦИИ АДМИНА)
   */
  async restoreFromSnapshot(token: string, snapshotId: number): Promise<void> {
    await this.isAdmin(token)

    const snapshot = await db.query.systemSnapshots.findFirst({
      where: eq(schema.systemSnapshots.id, snapshotId)
    });

    if (!snapshot) throw new Error('Snapshot not found');

    this.system = new FencingRatingSystem(snapshot.snapshotData as SystemState);
    this.initialized = true;
  }

  /**
   * Получить лидерборд (ПУБЛИЧНЫЙ МЕТОД, без авторизации)
   */
  async getLeaderboard(weaponId: number, nominationId: number, page: number, limit: number = 20) {
    // Публичный метод — не требует авторизации
    const cached = await db.query.leaderboardCache.findFirst({
      where: and(
        eq(schema.leaderboardCache.weaponId, weaponId),
        eq(schema.leaderboardCache.nominationId, nominationId),
        sql`${schema.leaderboardCache.validUntil} > NOW()`
      )
    });

    if (cached) {
      return {
        users: cached.topUsers.slice((page - 1) * limit, page * limit),
        usersCount: cached.topUsers.length
      };
    }

    const ratings = await ratingRepository.getRatingsWithUsers(weaponId, nominationId, limit)

    const leaderboard = ratings.map((r, index) => ({
      rank: index + 1,
      userId: r.userId,
      username: r.user.username,
      rating: Math.round(r.rating),
      rd: Math.round(r.rd),
      matches: r.matchesCount,
      lastActive: r.lastTournamentAt
    }));

    const totalCount = await db.select({ count: sql<number>`count(*)` })
      .from(schema.userRatings)
      .where(and(
        eq(schema.userRatings.weaponId, weaponId),
        eq(schema.userRatings.nominationId, nominationId)
      ));

    await db.insert(schema.leaderboardCache)
      .values({
        weaponId,
        nominationId,
        topUsers: leaderboard,
        totalUsers: totalCount[0].count,
        validUntil: new Date(Date.now() + 5 * 60 * 1000)
      })
      .onConflictDoUpdate({
        target: [schema.leaderboardCache.weaponId, schema.leaderboardCache.nominationId],
        set: {
          topUsers: leaderboard,
          totalUsers: totalCount[0].count,
          calculatedAt: new Date(),
          validUntil: new Date(Date.now() + 5 * 60 * 1000)
        }
      });

    return {
      users: leaderboard.slice((page - 1) * limit, page * limit),
      usersCount: leaderboard.length
    };
  }

  /**
   * Получить историю рейтинга пользователя (ТРЕБУЕТ АВТОРИЗАЦИИ — свой профиль или админ)
   */
  async getUserRatingHistory(
    token: string,
    targetUserId: string,
    weaponId: number,
    nominationId: number
  ) {
    const user = await this.requireAuth(token);

    // Можно смотреть только свою историю или если админ
    if (user.id !== targetUserId) {
      const isAdmin = user.email === Bun.env.ADMIN_EMAIL || user.isAdmin;
      if (!isAdmin) {
        throw new Error("Forbidden: Can only view your own rating history");
      }
    }

    return db.query.ratingHistory.findMany({
      where: and(
        eq(schema.ratingHistory.userId, targetUserId),
        eq(schema.ratingHistory.weaponId, weaponId),
        eq(schema.ratingHistory.nominationId, nominationId)
      ),
      orderBy: [asc(schema.ratingHistory.recordedAt)],
      with: {
        tournament: {
          columns: {
            id: true,
            title: true,
            date: true
          }
        }
      }
    });
  }

  /**
   * Получить статистику пользователя (ПУБЛИЧНЫЙ МЕТОД — базовая инфа)
   */
  async getUserStats(userId: string) {
    // Публичный метод — базовая статистика доступна всем
    const stats = this.system?.getFighterStats(userId);

    if (!stats) {
      // Если система не инициализирована, загружаем из БД
      const ratings = await db.query.userRatings.findMany({
        where: eq(schema.userRatings.userId, userId),
        with: {
          weapon: true,
          nomination: true,
        },
      });

      const user = await ratingRepository.getUserById(userId)

      if (!user) throw new Error("User not found");

      return {
        fighter: {
          id: user.id,
          name: user.username,
          totalMatches: user.totalMatches,
          createdAt: user.createdAt.toISOString(),
        },
        ratings: ratings.map((r) => ({
          weaponSubtype: `${r.weapon.title}_${r.nomination.title}`,
          rating: r.rating,
          rd: r.rd,
          volatility: r.volatility,
          matches: r.matchesCount,
          rank: r.currentRank,
        })),
      };
    }

    return {
      fighter: {
        id: stats.fighter.id,
        name: stats.fighter.name,
        totalMatches: stats.fighter.totalMatches,
        createdAt: stats.fighter.createdAt.toISOString(),
      },
      ratings: stats.ratings,
    };
  }

  async getMatches(tournamentId: number, nominationId: number) {
    return await ratingRepository.getMatchesWithUsers(tournamentId, nominationId)
  }

  private async invalidateLeaderboardCache(weaponId: number, nominationId: number): Promise<void> {
    await db.delete(schema.leaderboardCache)
      .where(and(
        eq(schema.leaderboardCache.weaponId, weaponId),
        eq(schema.leaderboardCache.nominationId, nominationId)
      ));
  }

  getSystem(): FencingRatingSystem {
    if (!this.initialized) throw new Error('Service not initialized');
    return this.system!;
  }
}