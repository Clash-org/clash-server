/**
 * Система рейтинга для исторического фехтования на базе glicko2.ts
 * Запуск: bun run rating.ts
 */

import { Glicko2, Player as GlickoPlayer } from 'glicko2.ts';

// Типы оружия и категории из вашего описания
type WeaponType = 'longsword' | 'rapier' | 'saber' | 'sword_buckler' | 'polearm';
type Category = 'open' | 'advanced' | 'women' | 'unsharpened';

// Интерфейс бойца в системе
interface Fighter {
  id: string;
  name: string;
  ratings: Map<string, FighterRating>;
  createdAt: Date;
  totalMatches: number;
}

// Рейтинг бойца по конкретному подтипу оружия
interface FighterRating {
  weaponSubtype: string;
  glickoPlayer: GlickoPlayer;
  matchesCount: number;
  lastTournamentDate?: Date;
  lastRank?: number;
  currentRank?: number;
}

// Результат матча в турнире
interface TournamentMatch {
  fighterId: string;
  opponentId: string;
  result: 0 | 0.5 | 1;
}

// Результат обработки турнира
interface TournamentResult {
  fighterId: string;
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

class FencingRatingSystem {
  private rankingSystems: Map<string, Glicko2> = new Map();
  private fighters: Map<string, Fighter> = new Map();

  private readonly defaultRating = 1500;
  private readonly defaultRD = 300;
  private readonly defaultVolatility = 0.06;
  private readonly tau = 0.5;

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

  private getOrCreateRating(fighterId: string, weaponSubtype: string): FighterRating {
    const fighter = this.fighters.get(fighterId);
    if (!fighter) throw new Error(`Fighter ${fighterId} not found`);

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
    category: Category,
    matches: TournamentMatch[],
    tournamentDate: Date
  ): TournamentResult[] {
    const weaponSubtype = `${weaponType}_${category}`;
    const ranking = this.getRankingSystem(weaponSubtype);

    const matchesByFighter = new Map<string, TournamentMatch[]>();
    matches.forEach(match => {
      if (!matchesByFighter.has(match.fighterId)) {
        matchesByFighter.set(match.fighterId, []);
      }
      matchesByFighter.get(match.fighterId)!.push(match);
    });

    const activeFighterIds = new Set(matches.map(m => m.fighterId));

    const glickoMatches: Array<[GlickoPlayer, GlickoPlayer, number]> = [];

    matches.forEach(match => {
      const ratingA = this.getOrCreateRating(match.fighterId, weaponSubtype);
      const ratingB = this.getOrCreateRating(match.opponentId, weaponSubtype);

      glickoMatches.push([
        ratingA.glickoPlayer,
        ratingB.glickoPlayer,
        match.result
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
      const fighterRating = this.fighters.get(entry.fighterId)?.ratings.get(weaponSubtype);
      if (fighterRating) {
        beforeState.set(entry.fighterId, {
          rating: fighterRating.glickoPlayer.getRating(),
          rd: fighterRating.glickoPlayer.getRd(),
          volatility: fighterRating.glickoPlayer.getVol(),
          rank: index + 1
        });
        fighterRating.lastRank = index + 1;
      }
    });

    ranking.updateRatings(glickoMatches);

    activeFighterIds.forEach(fighterId => {
      const rating = this.getOrCreateRating(fighterId, weaponSubtype);
      const fighterMatches = matchesByFighter.get(fighterId) || [];
      rating.matchesCount += fighterMatches.length;
      rating.lastTournamentDate = tournamentDate;

      const fighter = this.fighters.get(fighterId)!;
      fighter.totalMatches += fighterMatches.length;
    });

    const newLeaderboard = this.getLeaderboard(weaponType, category);
    const rankMap = new Map<string, number>();
    newLeaderboard.forEach((entry, index) => {
      rankMap.set(entry.fighterId, index + 1);
      const rating = this.fighters.get(entry.fighterId)?.ratings.get(weaponSubtype);
      if (rating) rating.currentRank = index + 1;
    });

    const results: TournamentResult[] = [];

    activeFighterIds.forEach(fighterId => {
      const before = beforeState.get(fighterId);
      if (!before) return;

      const rating = this.getOrCreateRating(fighterId, weaponSubtype);
      const glicko = rating.glickoPlayer;
      const matchesPlayed = matchesByFighter.get(fighterId)?.length || 0;

      results.push({
        fighterId,
        weaponSubtype,
        matchesPlayed,
        ratingBefore: before.rating,
        ratingAfter: glicko.getRating(),
        rdBefore: before.rd,
        rdAfter: glicko.getRd(),
        volatilityBefore: before.volatility,
        volatilityAfter: glicko.getVol(),
        rankBefore: before.rank,
        rankAfter: rankMap.get(fighterId),
        rankChange: (before.rank || 0) - (rankMap.get(fighterId) || 0)
      });
    });

    currentLeaderboard.forEach(entry => {
      if (!activeFighterIds.has(entry.fighterId)) {
        const before = beforeState.get(entry.fighterId);
        if (!before || before.rank === rankMap.get(entry.fighterId)) return;

        const rating = this.getOrCreateRating(entry.fighterId, weaponSubtype);
        const glicko = rating.glickoPlayer;

        results.push({
          fighterId: entry.fighterId,
          weaponSubtype,
          matchesPlayed: 0,
          ratingBefore: glicko.getRating(),
          ratingAfter: glicko.getRating(),
          rdBefore: before.rd,
          rdAfter: glicko.getRd(),
          volatilityBefore: before.volatility,
          volatilityAfter: glicko.getVol(),
          rankBefore: before.rank,
          rankAfter: rankMap.get(entry.fighterId),
          rankChange: (before.rank || 0) - (rankMap.get(entry.fighterId) || 0)
        });
      }
    });

    return results.sort((a, b) => (b.rankChange || 0) - (a.rankChange || 0));
  }

  getLeaderboard(
    weaponType: WeaponType,
    category: Category,
    limit?: number
  ): Array<{
    rank: number;
    fighterId: string;
    name: string;
    rating: number;
    rd: number;
    matches: number;
    lastActive?: Date;
  }> {
    const weaponSubtype = `${weaponType}_${category}`;

    // Получаем всех бойцов этого подтипа оружия из нашей мапы
    const leaderboard: Array<{
      fighterId: string;
      name: string;
      rating: number;
      rd: number;
      matches: number;
      lastActive?: Date;
    }> = [];

    for (const [fighterId, fighter] of this.fighters) {
      const rating = fighter.ratings.get(weaponSubtype);
      if (rating) {
        leaderboard.push({
          fighterId,
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
    fighterAId: string,
    fighterBId: string,
    weaponType: WeaponType,
    category: Category
  ): { fighterAWin: number; draw: number; fighterBWin: number } {
    const weaponSubtype = `${weaponType}_${category}`;

    const ratingA = this.getOrCreateRating(fighterAId, weaponSubtype);
    const ratingB = this.getOrCreateRating(fighterBId, weaponSubtype);

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

    // Учитываем ничью (5% как пример для фехтования)
    const drawProbability = 0.05;
    const adjustedWin = expected * (1 - drawProbability);
    const adjustedLoss = (1 - expected) * (1 - drawProbability);

    return {
      fighterAWin: adjustedWin,
      draw: drawProbability,
      fighterBWin: adjustedLoss
    };
  }

  getFighterStats(fighterId: string): {
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
    const fighter = this.fighters.get(fighterId);
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
    { fighterId: "f1", opponentId: "f2", result: 1 },
    { fighterId: "f2", opponentId: "f1", result: 0 },
    { fighterId: "f1", opponentId: "f3", result: 0 },
    { fighterId: "f3", opponentId: "f1", result: 1 },
    { fighterId: "f2", opponentId: "f3", result: 0.5 },
    { fighterId: "f3", opponentId: "f2", result: 0.5 },
  ];

  const results1 = system.processTournament(
    "longsword",
    "advanced",
    tournament1,
    new Date("2024-01-15")
  );

  results1.forEach(r => {
    const fighter = system.getFighterStats(r.fighterId)?.fighter;
    console.log(
      `${fighter?.name}: ${r.ratingBefore.toFixed(0)} -> ${r.ratingAfter.toFixed(0)} ` +
      `(боёв: ${r.matchesPlayed}, ранг: ${r.rankBefore} -> ${r.rankAfter}, ` +
      `изменение: ${r.rankChange > 0 ? '+' : ''}${r.rankChange})`
    );
  });

  console.log("\n=== Турнир 2: Продвинутый длинный меч (Иван отсутствует) ===");

  const tournament2: TournamentMatch[] = [
    { fighterId: "f2", opponentId: "f3", result: 1 },
    { fighterId: "f3", opponentId: "f2", result: 0 },
    { fighterId: "f2", opponentId: "f4", result: 0 },
    { fighterId: "f4", opponentId: "f2", result: 1 },
  ];

  const results2 = system.processTournament(
    "longsword",
    "advanced",
    tournament2,
    new Date("2024-02-01")
  );

  results2.forEach(r => {
    const fighter = system.getFighterStats(r.fighterId)?.fighter;
    const status = r.matchesPlayed === 0 ? "[не участвовал]" : "";
    console.log(
      `${fighter?.name} ${status}: ${r.ratingBefore.toFixed(0)} -> ${r.ratingAfter.toFixed(0)} ` +
      `(боёв: ${r.matchesPlayed}, ранг: ${r.rankBefore} -> ${r.rankAfter}, ` +
      `изменение: ${r.rankChange > 0 ? '+' : ''}${r.rankChange})`
    );
  });

  console.log("\n=== Лидерборд: Продвинутый длинный меч ===");
  const leaderboard = system.getLeaderboard("longsword", "advanced");
  leaderboard.forEach(entry => {
    console.log(
      `${entry.rank}. ${entry.name}: ${entry.rating.toFixed(0)} ` +
      `(RD: ${entry.rd.toFixed(0)}, боёв: ${entry.matches})`
    );
  });

  console.log("\n=== Предсказание: Иван vs Мария ===");
  const prediction = system.predictMatch("f1", "f4", "longsword", "advanced");
  console.log(`Иван победит: ${(prediction.fighterAWin * 100).toFixed(1)}%`);
  console.log(`Ничья: ${(prediction.draw * 100).toFixed(1)}%`);
  console.log(`Мария победит: ${(prediction.fighterBWin * 100).toFixed(1)}%`);
}

example();