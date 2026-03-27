/**
 * Clash Server - Tournament Management System
 * Copyright (C) 2026 Clash Contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Система рейтинга для исторического фехтования на базе glicko2.ts
 * Запуск: bun run rating.ts
 */

import { Glicko2, Player as GlickoPlayer } from 'glicko2.ts';
import { nominations } from "../translations/nominations";
import { MatchTypesType } from '../typings';

// Маппинг оружия к индексам (для удобства)
export enum WeaponIndex {
  LONGSWORD=1,
  RAPIER,
  SABER,
  SWORD_BUCKLER,
  SPEAR,
  OTHER
};

// Номинации с привязкой к оружию
export const defaultWeaponsNominations = [
  { title: "Longsword", weaponId: WeaponIndex.LONGSWORD },
  { title: "Longsword & Rondel", weaponId: WeaponIndex.LONGSWORD },
  { title: "Longsword - Advanced", weaponId: WeaponIndex.LONGSWORD },
  { title: "Longsword - Beginner", weaponId: WeaponIndex.LONGSWORD },
  { title: "Longsword - Continuous", weaponId: WeaponIndex.LONGSWORD },
  { title: "Longsword - Kids", weaponId: WeaponIndex.LONGSWORD },
  { title: "Longsword - Team", weaponId: WeaponIndex.LONGSWORD },
  { title: "Longsword - Women", weaponId: WeaponIndex.LONGSWORD },

  { title: "Rapier - Kids", weaponId: WeaponIndex.RAPIER },
  { title: "Rapier - Women", weaponId: WeaponIndex.RAPIER },

  { title: "Saber", weaponId: WeaponIndex.SABER },
  { title: "Saber - Advanced", weaponId: WeaponIndex.SABER },
  { title: "Saber - Kids", weaponId: WeaponIndex.SABER },
  { title: "Saber - Team", weaponId: WeaponIndex.SABER },
  { title: "Saber - Woman", weaponId: WeaponIndex.SABER },
  { title: "Saber - kids (boys)", weaponId: WeaponIndex.SABER },
  { title: "Saber - kids (girls)", weaponId: WeaponIndex.SABER },

  { title: "Sword & Buckler - Kids", weaponId: WeaponIndex.SWORD_BUCKLER },
  { title: "Sword & Buckler - Open", weaponId: WeaponIndex.SWORD_BUCKLER },
  { title: "Sword & Buckler - Women", weaponId: WeaponIndex.SWORD_BUCKLER },
  { title: "Sword & Shield", weaponId: WeaponIndex.SWORD_BUCKLER },
  { title: "Sidesword", weaponId: WeaponIndex.SWORD_BUCKLER },
  { title: "Sidesword - Woman", weaponId: WeaponIndex.SWORD_BUCKLER },

  { title: "Spear", weaponId: WeaponIndex.SPEAR },
  { title: "Spear & Shield", weaponId: WeaponIndex.SPEAR },

  { title: "Canne de combat", weaponId: WeaponIndex.OTHER },
  { title: "Canne de combat (kids)", weaponId: WeaponIndex.OTHER },
  { title: "Canne de combat (mixed)", weaponId: WeaponIndex.OTHER },
  { title: "Canne de combat (women)", weaponId: WeaponIndex.OTHER },
  { title: "Combat Knife - Kids", weaponId: WeaponIndex.OTHER },
  { title: "Combat Knife - Men", weaponId: WeaponIndex.OTHER },
  { title: "Combat Knife - Mixed", weaponId: WeaponIndex.OTHER },
  { title: "Combat Knife - Women", weaponId: WeaponIndex.OTHER },
  { title: "Dussak", weaponId: WeaponIndex.OTHER },
  { title: "Dussak - Women", weaponId: WeaponIndex.OTHER },
  { title: "Harnischfechten", weaponId: WeaponIndex.OTHER },
  { title: "Harnischfechten - kids", weaponId: WeaponIndex.OTHER },
  { title: "Harnischfechten - mixed", weaponId: WeaponIndex.OTHER },
  { title: "Harnischfechten - women", weaponId: WeaponIndex.OTHER },
  { title: "Katana", weaponId: WeaponIndex.OTHER },
  { title: "Messer", weaponId: WeaponIndex.OTHER },
  { title: "Mixed", weaponId: WeaponIndex.OTHER },
  { title: "Smallsword - Base", weaponId: WeaponIndex.OTHER },
  { title: "Smallsword - Kids", weaponId: WeaponIndex.OTHER },
  { title: "Smallsword - Mixed", weaponId: WeaponIndex.OTHER },
  { title: "Smallsword - Women", weaponId: WeaponIndex.OTHER },
  { title: "Tapfight", weaponId: WeaponIndex.OTHER },
  { title: "Triathlon", weaponId: WeaponIndex.OTHER }
] as const;

// Типы оружия и категории из вашего описания
export type WeaponType = "longsword" | "rapier" | "saber" | "sword_buckler" | "spear" | "other";
export type NominationType = typeof nominations.en[number];

// Интерфейс бойца в системе
export interface Fighter {
  id: string;
  name: string;
  ratings: Map<string, FighterRating>;
  createdAt: Date;
  totalMatches: number;
}

// Рейтинг бойца по конкретному подтипу оружия
export interface FighterRating {
  weaponSubtype: string;
  glickoPlayer: GlickoPlayer;
  matchesCount: number;
  lastTournamentDate?: Date;
  lastRank?: number;
  currentRank?: number;
}

// Результат матча в турнире
export interface TournamentMatch {
  redId: string;
  blueId: string;
  resultRed: 0 | 0.5 | 1;
  scoreRed: number;
  scoreBlue: number;
  type?: MatchTypesType;
  doubleHits?: number;
  protestsRed?: number;
  protestsBlue?: number;
  warningsRed?: number;
  warningsBlue?: number;
  metadata?: MatchMetadata,
  poolIndex?: number;
}

// Результат обработки турнира
export interface TournamentResult {
  userId: string;
  weaponSubtype: string;
  matchesPlayed: number;
  ratingBefore: number;
  ratingAfter: number;
  rdBefore: number;
  rdAfter: number;
  volatilityBefore: number;
  volatilityAfter: number;
  rankBefore?: number;
  rankAfter?: number;
  rankChange: number;
}

// === СЕРИАЛИЗУЕМЫЕ ФОРМАТЫ ДЛЯ СОХРАНЕНИЯ ===

// Данные для сохранения рейтинга бойца
export interface SerializableRating {
  weaponSubtype: string;
  rating: number;           // Текущий рейтинг
  rd: number;              // Отклонение
  volatility: number;      // Волатильность
  matchesCount: number;    // Количество боёв
  lastTournamentDate?: string; // ISO строка
  lastRank?: number;
  currentRank?: number;
}

// Данные для сохранения бойца целиком
export interface SerializableFighter {
  id: string;
  name: string;
  createdAt: string;        // ISO строка
  totalMatches: number;
  ratings: SerializableRating[];
}

// Полное состояние системы
export interface SystemState {
  fighters: SerializableFighter[];
  version: number;          // Для миграций в будущем
  savedAt: string;          // ISO строка
}

export interface MatchMetadata {
  // Видео
  videoUrl?: string;
  // Произвольные дополнительные данные
  [key: string]: any;
}

export interface TopUsers {
  userId: string;
  username: string;
  rating: number;
  rd: number;
  matches: number;
  rank: number;
}

export class FencingRatingSystem {
  private rankingSystems: Map<string, Glicko2> = new Map();
  private fighters: Map<string, Fighter> = new Map();

  private readonly defaultRating = 1500;
  private readonly defaultRD = 300;
  private readonly defaultVolatility = 0.06;
  private readonly tau = 0.5;

  /**
   * КОНСТРУКТОР с поддержкой восстановления состояния
   *
   * @param savedState - Опциональное сохранённое состояние из БД/файла/блокчейна
   */
  constructor(savedState?: SystemState) {
    if (savedState) {
      this.loadState(savedState);
    }
  }

  /**
   * Восстановление состояния из сериализованных данных
   */
  private loadState(state: SystemState): void {
    // Восстанавливаем каждого бойца
    for (const savedFighter of state.fighters) {
      const fighter: Fighter = {
        id: savedFighter.id,
        name: savedFighter.name,
        ratings: new Map(),
        createdAt: new Date(savedFighter.createdAt),
        totalMatches: savedFighter.totalMatches
      };

      // Восстанавливаем рейтинги по каждому подтипу оружия
      for (const savedRating of savedFighter.ratings) {
        const ranking = this.getRankingSystem(savedRating.weaponSubtype);

        // Создаём игрока с сохранёнными параметрами
        const glickoPlayer = ranking.makePlayer(
          savedRating.rating,
          savedRating.rd,
          savedRating.volatility
        );

        const fighterRating: FighterRating = {
          weaponSubtype: savedRating.weaponSubtype,
          glickoPlayer,
          matchesCount: savedRating.matchesCount,
          lastTournamentDate: savedRating.lastTournamentDate
            ? new Date(savedRating.lastTournamentDate)
            : undefined,
          lastRank: savedRating.lastRank,
          currentRank: savedRating.currentRank
        };

        fighter.ratings.set(savedRating.weaponSubtype, fighterRating);
      }

      this.fighters.set(fighter.id, fighter);
    }

    console.log(`[FencingRatingSystem] Загружено ${state.fighters.length} бойцов`);
  }

  /**
   * СЕРИАЛИЗАЦИЯ: Получить текущее состояние для сохранения
   */
  serialize(): SystemState {
    const fighters: SerializableFighter[] = [];

    for (const [id, fighter] of this.fighters) {
      const ratings: SerializableRating[] = [];

      for (const [subtype, rating] of fighter.ratings) {
        ratings.push({
          weaponSubtype: subtype,
          rating: rating.glickoPlayer.getRating(),
          rd: rating.glickoPlayer.getRd(),
          volatility: rating.glickoPlayer.getVol(),
          matchesCount: rating.matchesCount,
          lastTournamentDate: rating.lastTournamentDate?.toISOString(),
          lastRank: rating.lastRank,
          currentRank: rating.currentRank
        });
      }

      fighters.push({
        id: fighter.id,
        name: fighter.name,
        createdAt: fighter.createdAt.toISOString(),
        totalMatches: fighter.totalMatches,
        ratings
      });
    }

    return {
      fighters,
      version: 1,
      savedAt: new Date().toISOString()
    };
  }

  /**
   * Сохранение в JSON строку (для файла или БД)
   */
  toJSON(): string {
    return JSON.stringify(this.serialize(), null, 2);
  }

  /**
   * Статический метод создания из JSON
   */
  static fromJSON(jsonString: string): FencingRatingSystem {
    const state: SystemState = JSON.parse(jsonString);
    return new FencingRatingSystem(state);
  }

  // ============ ОСНОВНЫЕ МЕТОДЫ ============

  private getRankingSystem(weaponSubtype: string): Glicko2 {
    if (!this.rankingSystems.has(weaponSubtype)) {
      this.rankingSystems.set(weaponSubtype, new Glicko2({
        tau: this.tau,
        rating: this.defaultRating,
        rd: this.defaultRD,
        vol: this.defaultVolatility
      }));
    }
    return this.rankingSystems.get(weaponSubtype)!;
  }

  registerFighter(id: string, name: string): Fighter {
    const fighter: Fighter = {
      id,
      name,
      ratings: new Map(),
      createdAt: new Date(),
      totalMatches: 0
    };
    this.fighters.set(id, fighter);
    return fighter;
  }

  /**
   * Проверка существования бойца
   */
  hasFighter(id: string): boolean {
    return this.fighters.has(id);
  }

  /**
   * Получить бойца (включая приватные данные)
   */
  getFighter(id: string): Fighter | undefined {
    return this.fighters.get(id);
  }

  private getOrCreateRating(redId: string, weaponSubtype: string): FighterRating {
    if (!this.fighters.has(redId)) {
      this.registerFighter(redId, `Fighter_${redId.substring(0, 8)}`);
    }

    const fighter = this.fighters.get(redId);
    if (!fighter) throw new Error(`Fighter ${redId} not found`);

    if (!fighter.ratings.has(weaponSubtype)) {
      const ranking = this.getRankingSystem(weaponSubtype);
      const glickoPlayer = ranking.makePlayer(
        this.defaultRating,
        this.defaultRD,
        this.defaultVolatility
      );

      fighter.ratings.set(weaponSubtype, {
        weaponSubtype,
        glickoPlayer,
        matchesCount: 0
      });
    }

    return fighter.ratings.get(weaponSubtype)!;
  }

  processTournament(
    weaponType: WeaponType,
    category: NominationType,
    matches: TournamentMatch[],
    tournamentDate: Date
  ): TournamentResult[] {
    const weaponSubtype = `${weaponType}_${category}`;
    const ranking = this.getRankingSystem(weaponSubtype);

    const matchesByFighter = new Map<string, TournamentMatch[]>();
    matches.forEach(match => {
      if (!matchesByFighter.has(match.redId)) {
        matchesByFighter.set(match.redId, []);
      }
      matchesByFighter.get(match.redId)!.push(match);
    });

    const activeFighterIds = new Set(matches.map(m => m.redId));

    const glickoMatches: Array<[GlickoPlayer, GlickoPlayer, number]> = [];

    matches.forEach(match => {
      const ratingA = this.getOrCreateRating(match.redId, weaponSubtype);
      const ratingB = this.getOrCreateRating(match.blueId, weaponSubtype);

      glickoMatches.push([
        ratingA.glickoPlayer,
        ratingB.glickoPlayer,
        match.resultRed
      ]);
    });

    const beforeState = new Map<string, {
      rating: number;
      rd: number;
      volatility: number;
      rank?: number;
    }>();

    const currentLeaderboard = this.getLeaderboard(weaponType, category);
    currentLeaderboard.forEach((entry, index) => {
      const fighterRating = this.fighters.get(entry.redId)?.ratings.get(weaponSubtype);
      if (fighterRating) {
        beforeState.set(entry.redId, {
          rating: fighterRating.glickoPlayer.getRating(),
          rd: fighterRating.glickoPlayer.getRd(),
          volatility: fighterRating.glickoPlayer.getVol(),
          rank: index + 1
        });
        fighterRating.lastRank = index + 1;
      }
    });

    ranking.updateRatings(glickoMatches);

    activeFighterIds.forEach(redId => {
      const rating = this.getOrCreateRating(redId, weaponSubtype);
      const fighterMatches = matchesByFighter.get(redId) || [];
      rating.matchesCount += fighterMatches.length;
      rating.lastTournamentDate = tournamentDate;

      const fighter = this.fighters.get(redId)!;
      fighter.totalMatches += fighterMatches.length;
    });

    const newLeaderboard = this.getLeaderboard(weaponType, category);
    const rankMap = new Map<string, number>();
    newLeaderboard.forEach((entry, index) => {
      rankMap.set(entry.redId, index + 1);
      const rating = this.fighters.get(entry.redId)?.ratings.get(weaponSubtype);
      if (rating) rating.currentRank = index + 1;
    });

    const results: TournamentResult[] = [];

    activeFighterIds.forEach(redId => {
      const before = beforeState.get(redId);
      if (!before) return;

      const rating = this.getOrCreateRating(redId, weaponSubtype);
      const glicko = rating.glickoPlayer;
      const matchesPlayed = matchesByFighter.get(redId)?.length || 0;

      results.push({
        userId: redId,
        weaponSubtype,
        matchesPlayed,
        ratingBefore: before.rating,
        ratingAfter: glicko.getRating(),
        rdBefore: before.rd,
        rdAfter: glicko.getRd(),
        volatilityBefore: before.volatility,
        volatilityAfter: glicko.getVol(),
        rankBefore: before.rank,
        rankAfter: rankMap.get(redId),
        rankChange: (before.rank || 0) - (rankMap.get(redId) || 0)
      });
    });

    currentLeaderboard.forEach(entry => {
      if (!activeFighterIds.has(entry.redId)) {
        const before = beforeState.get(entry.redId);
        if (!before || before.rank === rankMap.get(entry.redId)) return;

        const rating = this.getOrCreateRating(entry.redId, weaponSubtype);
        const glicko = rating.glickoPlayer;

        results.push({
          userId: entry.redId,
          weaponSubtype,
          matchesPlayed: 0,
          ratingBefore: glicko.getRating(),
          ratingAfter: glicko.getRating(),
          rdBefore: before.rd,
          rdAfter: glicko.getRd(),
          volatilityBefore: before.volatility,
          volatilityAfter: glicko.getVol(),
          rankBefore: before.rank,
          rankAfter: rankMap.get(entry.redId),
          rankChange: (before.rank || 0) - (rankMap.get(entry.redId) || 0)
        });
      }
    });

    return results.sort((a, b) => (b.rankChange || 0) - (a.rankChange || 0));
  }

  getLeaderboard(
    weaponType: WeaponType,
    category: NominationType,
    limit?: number
  ): Array<{
    rank: number;
    redId: string;
    name: string;
    rating: number;
    rd: number;
    matches: number;
    lastActive?: Date;
  }> {
    const weaponSubtype = `${weaponType}_${category}`;

    // Получаем всех бойцов этого подтипа оружия из нашей мапы
    const leaderboard: Array<{
      redId: string;
      name: string;
      rating: number;
      rd: number;
      matches: number;
      lastActive?: Date;
    }> = [];

    for (const [redId, fighter] of this.fighters) {
      const rating = fighter.ratings.get(weaponSubtype);
      if (rating) {
        leaderboard.push({
          redId,
          name: fighter.name,
          rating: rating.glickoPlayer.getRating(),
          rd: rating.glickoPlayer.getRd(),
          matches: rating.matchesCount,
          lastActive: rating.lastTournamentDate
        });
      }
    }

    // Сортируем по рейтингу (убывание) и добавляем ранг
    return leaderboard
      .sort((a, b) => b.rating - a.rating)
      .map((entry, index) => ({ ...entry, rank: index + 1 }))
      .slice(0, limit ?? leaderboard.length);
  }

  predictMatch(
    redId: string,
    blueId: string,
    weaponType: WeaponType,
    category: NominationType
  ): { fighterAWin: number; fighterBWin: number } {
    const weaponSubtype = `${weaponType}_${category}`;

    const ratingA = this.getOrCreateRating(redId, weaponSubtype);
    const ratingB = this.getOrCreateRating(blueId, weaponSubtype);

    // Формула Glicko-2 для ожидаемого результата
    // E = 1 / (1 + 10^(-g(phi) * (mu1 - mu2) / 400))
    // где g(phi) = 1 / sqrt(1 + 3 * phi^2 / pi^2)

    const pi = Math.PI;
    const scale = 173.7178; // Константа для перевода между шкалами

    // Переводим во внутреннюю шкалу Glicko-2
    const mu1 = (ratingA.glickoPlayer.getRating() - 1500) / scale;
    const mu2 = (ratingB.glickoPlayer.getRating() - 1500) / scale;
    const phi1 = ratingA.glickoPlayer.getRd() / scale;
    const phi2 = ratingB.glickoPlayer.getRd() / scale;

    // Функция g(phi)
    const g = (phi: number) => 1 / Math.sqrt(1 + 3 * phi * phi / (pi * pi));

    // Ожидаемый результат для игрока A
    const gPhi2 = g(phi2);
    const expected = 1 / (1 + Math.exp(-gPhi2 * (mu1 - mu2)));

    const adjustedWin = expected;
    const adjustedLoss = (1 - expected);

    return {
      fighterAWin: adjustedWin,
      fighterBWin: adjustedLoss
    };
  }

  getFighterStats(redId: string): {
    fighter: Fighter;
    ratings: Array<{
      weaponSubtype: string;
      rating: number;
      rd: number;
      volatility: number;
      matches: number;
      rank?: number;
    }>;
  } | null {
    const fighter = this.fighters.get(redId);
    if (!fighter) return null;

    const ratings = Array.from(fighter.ratings.values()).map(r => ({
      weaponSubtype: r.weaponSubtype,
      rating: r.glickoPlayer.getRating(),
      rd: r.glickoPlayer.getRd(),
      volatility: r.glickoPlayer.getVol(),
      matches: r.matchesCount,
      rank: r.currentRank
    }));

    return { fighter, ratings };
  }

  /**
   * Получить статистику системы
   */
  getSystemStats(): {
    totalFighters: number;
    weaponSubtypes: string[];
    totalMatches: number;
  } {
    const subtypes = new Set<string>();
    let totalMatches = 0;

    for (const fighter of this.fighters.values()) {
      totalMatches += fighter.totalMatches;
      for (const subtype of fighter.ratings.keys()) {
        subtypes.add(subtype);
      }
    }

    return {
      totalFighters: this.fighters.size,
      weaponSubtypes: Array.from(subtypes),
      totalMatches
    };
  }
}

// ==================== ПРИМЕР ИСПОЛЬЗОВАНИЯ ====================

function example() {
  const system = new FencingRatingSystem();

  system.registerFighter("f1", "Иван Сидоров");
  system.registerFighter("f2", "Пётр Петров");
  system.registerFighter("f3", "Алексей Иванов");
  system.registerFighter("f4", "Мария Смирнова");

  console.log("=== Турнир 1: Продвинутый длинный меч ===");

  const tournament1: TournamentMatch[] = [
    { redId: "f1", blueId: "f2", resultRed: 1, scoreRed: 6, scoreBlue: 5 },
    { redId: "f2", blueId: "f1", resultRed: 0, scoreRed: 8, scoreBlue: 12 },
    { redId: "f1", blueId: "f3", resultRed: 0, scoreRed: 3, scoreBlue: 7 },
    { redId: "f3", blueId: "f1", resultRed: 1, scoreRed: 9, scoreBlue: 8 },
    { redId: "f2", blueId: "f3", resultRed: 0.5, scoreRed: 10, scoreBlue: 10 },
    { redId: "f3", blueId: "f2", resultRed: 0.5, scoreRed: 6, scoreBlue: 6 },
  ];

  const results1 = system.processTournament(
    "longsword",
    "Longsword - Advanced",
    tournament1,
    new Date("2024-01-15")
  );

  results1.forEach(r => {
    const fighter = system.getFighterStats(r.userId)?.fighter;
    console.log(
      `${fighter?.name}: ${r.ratingBefore.toFixed(0)} -> ${r.ratingAfter.toFixed(0)} ` +
      `(боёв: ${r.matchesPlayed}, ранг: ${r.rankBefore} -> ${r.rankAfter}, ` +
      `изменение: ${r.rankChange > 0 ? '+' : ''}${r.rankChange})`
    );
  });

  console.log("\n=== Турнир 2: Продвинутый длинный меч (Иван отсутствует) ===");

  const tournament2: TournamentMatch[] = [
    { redId: "f2", blueId: "f3", resultRed: 1, scoreRed: 7, scoreBlue: 6 },
    { redId: "f3", blueId: "f2", resultRed: 0, scoreRed: 9, scoreBlue: 12 },
    { redId: "f2", blueId: "f4", resultRed: 0, scoreRed: 4, scoreBlue: 7 },
    { redId: "f4", blueId: "f2", resultRed: 1, scoreRed: 9, scoreBlue: 8 },
  ];

  const results2 = system.processTournament(
    "longsword",
    "Longsword - Advanced",
    tournament2,
    new Date("2024-02-01")
  );

  results2.forEach(r => {
    const fighter = system.getFighterStats(r.userId)?.fighter;
    const status = r.matchesPlayed === 0 ? "[не участвовал]" : "";
    console.log(
      `${fighter?.name} ${status}: ${r.ratingBefore.toFixed(0)} -> ${r.ratingAfter.toFixed(0)} ` +
      `(боёв: ${r.matchesPlayed}, ранг: ${r.rankBefore} -> ${r.rankAfter}, ` +
      `изменение: ${r.rankChange > 0 ? '+' : ''}${r.rankChange})`
    );
  });

  console.log("\n=== Лидерборд: Продвинутый длинный меч ===");
  const leaderboard = system.getLeaderboard("longsword", "Longsword - Advanced");
  leaderboard.forEach(entry => {
    console.log(
      `${entry.rank}. ${entry.name}: ${entry.rating.toFixed(0)} ` +
      `(RD: ${entry.rd.toFixed(0)}, боёв: ${entry.matches})`
    );
  });

  console.log("\n=== Предсказание: Иван vs Мария ===");
  const prediction = system.predictMatch("f1", "f4", "longsword", "Longsword - Advanced");
  console.log(`Иван победит: ${(prediction.fighterAWin * 100).toFixed(1)}%`);
  console.log(`Мария победит: ${(prediction.fighterBWin * 100).toFixed(1)}%`);
}

// ==========================================
// ПРИМЕР ИСПОЛЬЗОВАНИЯ С СОХРАНЕНИЕМ/ВОССТАНОВЛЕНИЕМ
// ==========================================

async function exampleWithPersistence() {
  const fs = {
    writeFileSync: (path: string, data: string) => {
      // Заглушка для Bun/Node
      console.log(`[SAVE] Сохранено в ${path}, размер: ${data.length} байт`);
    },
    readFileSync: (path: string) => {
      // Заглушка
      return '{"fighters":[],"version":1,"savedAt":"2024-01-01T00:00:00.000Z"}';
    },
    existsSync: (path: string) => false
  };

  // === СЦЕНАРИЙ 1: Первый запуск (создание с нуля) ===
  console.log("=== СЦЕНАРИЙ 1: Первый запуск ===");

  let ratingSystem: FencingRatingSystem;

  // Проверяем, есть ли сохранённое состояние
  if (fs.existsSync('./rating-state.json')) {
    // Восстанавливаем из файла
    const savedData = fs.readFileSync('./rating-state.json');
    ratingSystem = FencingRatingSystem.fromJSON(savedData);
    console.log("Система восстановлена из сохранения");
  } else {
    // Создаём новую систему
    ratingSystem = new FencingRatingSystem();
    console.log("Создана новая система");
  }

  // Регистрируем бойцов (только если их ещё нет)
  if (!ratingSystem.hasFighter("user_1")) {
    ratingSystem.registerFighter("user_1", "Иван Сидоров");
    ratingSystem.registerFighter("user_2", "Пётр Петров");
    ratingSystem.registerFighter("user_3", "Алексей Иванов");
  }

  // Обрабатываем турнир
  const matches = [
    { redId: "user_1", blueId: "user_2", resultRed: 1 as const, scoreRed: 5, scoreBlue: 3 },
    { redId: "user_2", blueId: "user_1", resultRed: 0 as const, scoreRed: 7, scoreBlue: 11 },
    { redId: "user_1", blueId: "user_3", resultRed: 0 as const, scoreRed: 10, scoreBlue: 11 },
    { redId: "user_3", blueId: "user_1", resultRed: 1 as const, scoreRed: 6, scoreBlue: 4 },
  ];

  const results = ratingSystem.processTournament(
    "longsword",
    "Longsword - Advanced",
    matches,
    new Date()
  );

  console.log("Результаты турнира:", results);

  // === СОХРАНЕНИЕ ===
  const state = ratingSystem.serialize();
  fs.writeFileSync('./rating-state.json', JSON.stringify(state, null, 2));

  // Также можно сохранить в БД:
  // await db.ratingState.upsert({ id: 'main', data: state });

  // === СЦЕНАРИЙ 2: Перезапуск сервера ===
  console.log("\n=== СЦЕНАРИЙ 2: Восстановление после перезапуска ===");

  // Имитируем чтение из файла/БД
  const savedState: SystemState = {
    fighters: [
      {
        id: "user_1",
        name: "Иван Сидоров",
        createdAt: "2024-03-01T10:00:00.000Z",
        totalMatches: 2,
        ratings: [
          {
            weaponSubtype: "longsword_advanced",
            rating: 1485,
            rd: 285,
            volatility: 0.059,
            matchesCount: 2,
            lastTournamentDate: "2024-03-01T12:00:00.000Z",
            currentRank: 2
          }
        ]
      },
      {
        id: "user_2",
        name: "Пётр Петров",
        createdAt: "2024-03-01T10:00:00.000Z",
        totalMatches: 1,
        ratings: [
          {
            weaponSubtype: "longsword_advanced",
            rating: 1360,
            rd: 290,
            volatility: 0.059,
            matchesCount: 1,
            lastTournamentDate: "2024-03-01T12:00:00.000Z",
            currentRank: 3
          }
        ]
      },
      {
        id: "user_3",
        name: "Алексей Иванов",
        createdAt: "2024-03-01T10:00:00.000Z",
        totalMatches: 1,
        ratings: [
          {
            weaponSubtype: "longsword_advanced",
            rating: 1655,
            rd: 290,
            volatility: 0.059,
            matchesCount: 1,
            lastTournamentDate: "2024-03-01T12:00:00.000Z",
            currentRank: 1
          }
        ]
      }
    ],
    version: 1,
    savedAt: "2024-03-01T12:00:00.000Z"
  };

  // Восстанавливаем систему
  const restoredSystem = new FencingRatingSystem(savedState);

  console.log("Статистика восстановленной системы:", restoredSystem.getSystemStats());

  // Проверяем, что рейтинги сохранились
  const leaderboard = restoredSystem.getLeaderboard("longsword", "Longsword - Advanced");
  console.log("Лидерборд после восстановления:", leaderboard);

  // Продолжаем работу — добавляем новый турнир
  const newMatches = [
    { redId: "user_3", blueId: "user_2", resultRed: 0 as const, scoreRed: 8, scoreBlue: 10 },
    { redId: "user_2", blueId: "user_3", resultRed: 1 as const, scoreRed: 11, scoreBlue: 7 },
  ];

  const newResults = restoredSystem.processTournament(
    "longsword",
    "Longsword - Advanced",
    newMatches,
    new Date("2024-03-15")
  );

  console.log("Новые результаты:", newResults);

  // Сохраняем обновлённое состояние
  const newState = restoredSystem.serialize();
  console.log("Состояние для сохранения:", JSON.stringify(newState, null, 2));
}

// exampleWithPersistence();

// example();