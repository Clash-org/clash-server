/**
 * Clash Server - Tournament Management System
 * Copyright (C) 2026 Clash Contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { db } from "./shared/db/postgres";
import { eq, desc, sql, and } from "drizzle-orm";
import { ethers } from 'ethers';
import { Cron } from 'croner';
import { schemas } from './shared/db/postgres';
import UserABI from '../blockchain/abi/ClashUser.json';
import TournamentABI from '../blockchain/abi/ClashTournament.json';
import addresses from "../blockchain/addresses.json";
import { SyncConfig } from "./shared/typings";
import { hashPassword } from "./shared/utils/password";

class BlockchainSyncService {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private tournamentContract: ethers.Contract;
  private userContract: ethers.Contract;
  private config: SyncConfig;
  private isSyncing: boolean = false;
  private eventListenersStarted: boolean = false;

  constructor(config: SyncConfig) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl, undefined, {
      staticNetwork: true
    });
    this.wallet = new ethers.Wallet(config.servicePrivateKey, this.provider);

    this.userContract = new ethers.Contract(
      config.userContractAddress,
      UserABI,
      this.provider
    );

    this.tournamentContract = new ethers.Contract(
      config.tournamentContractAddress,
      TournamentABI,
      this.provider
    );
  }

  async start(): Promise<void> {
    console.log('🚀 Starting Blockchain Sync Service...');
    console.log('🔐 Service wallet:', this.wallet.address);
    console.log('🏆 Tournament Contract:', this.config.tournamentContractAddress);
    console.log('👤 User Contract:', this.config.userContractAddress);

    // Проверяем права оракула
    const contractWithSigner = this.tournamentContract.connect(this.wallet);
    const hasRole = await contractWithSigner.checkIsOracle();

    if (!hasRole) {
      throw new Error('Service wallet does not a servers');
    }
    console.log('✅ Server confirmed');

    // Запускаем слушатели событий
    this.startEventListeners();

    // Первичная синхронизация
    await this.syncAll();

    // Периодическая синхронизация
    new Cron(this.config.syncInterval, async () => {
      if (!this.isSyncing) {
        await this.syncAll();
      }
    });

    console.log(`⏰ Scheduled sync: ${this.config.syncInterval}`);
  }

  private startEventListeners(): void {
    if (this.eventListenersStarted) return;
    this.eventListenersStarted = true;
    // ========== События из ClashUser ==========
    if (this.userContract) {
        this.userContract.on('UserRegistered', async (userId: bigint, username: string) => {
        console.log(`🔔 Event received: UserRegistered #${userId} - ${username}`);
        await this.processUserEvent(Number(userId), username);
        });

        this.userContract.on('RatingUpdated', async (
        userId: bigint,
        weaponId: bigint,
        nominationId: bigint,
        rating: number
        ) => {
        console.log(`🔔 Event received: RatingUpdated user #${userId}, rating: ${rating}`);
        await this.processRatingEvent(Number(userId), Number(weaponId), Number(nominationId));
        });
    }

    // ========== События из ClashTournament ==========
    if (this.tournamentContract) {
        this.tournamentContract.on('MatchRecorded', async (
        matchId: bigint,
        tournamentId: bigint,
        redFighter: string,
        blueFighter: string,
        result: number
        ) => {
        console.log(`🔔 Event received: MatchRecorded #${matchId}`);
        await this.processMatchRecordedEvent(Number(matchId), Number(tournamentId));
        });

        this.tournamentContract.on('TournamentCreated', async (
        tournamentId: bigint,
        title: string,
        organizerId: bigint,
        date: bigint
        ) => {
        console.log(`🔔 Event received: TournamentCreated #${tournamentId}`);
        await this.processTournamentCreatedEvent(Number(tournamentId), title, Number(organizerId));
        });
    }

    console.log('👂 Event listeners started');
  }

  // ============ ЗАПИСЬ В БЛОКЧЕЙН (БД → Blockchain) ============

  private async syncTournamentsToBlockchain(): Promise<void> {
    console.log('📤 Syncing tournaments DB → Blockchain...');

    const tournaments = await db.query.tournaments.findMany({
      where: eq(schemas.tournaments.syncedToBlockchain, false),
      limit: this.config.batchSize,
    });

    const contract = this.tournamentContract.connect(this.wallet);

    for (const tournament of tournaments) {
      await this.processTournamentToBlockchain(tournament, contract);
    }
  }

  private async processTournamentToBlockchain(tournament: any, contract: ethers.Contract): Promise<void> {
    try {
      // Проверяем, существует ли уже
      const existing = await contract.getTournament(tournament.id);

      if (!existing.exists) {
        const tx = await contract.createTournament(
          tournament.id,
          tournament.title,
          Math.floor(new Date(tournament.date).getTime() / 1000),
          tournament.cityId,
          tournament.nominationIds,
          tournament.image,
          tournament.organizerId
        );
        await tx.wait(this.config.confirmations);
      }

      await db.update(schemas.tournaments)
        .set({
          syncedToBlockchain: true,
          blockchainSyncedAt: new Date(),
          blockchainTxHash: tx?.hash,
        })
        .where(eq(schemas.tournaments.id, tournament.id));

      console.log(`✅ Tournament #${tournament.id}: synced`);

    } catch (error: any) {
      console.error(`❌ Failed to sync tournament #${tournament.id}:`, error.message);
    }
  }

  private async syncMatchesToBlockchain(): Promise<void> {
    console.log('📤 Syncing matches DB → Blockchain...');

    const matches = await db.query.matches.findMany({
      where: eq(schemas.matches.syncedToBlockchain, false),
      limit: this.config.batchSize,
    });

    const contract = this.tournamentContract.connect(this.wallet);

    for (const match of matches) {
      await this.processMatchToBlockchain(match, contract);
    }
  }

  private async processMatchToBlockchain(
    match: any,
    contract: ethers.Contract
  ): Promise<void> {
    try {
      // Формируем хеш для подписи
      const hash = ethers.solidityPackedKeccak256(
        ['uint256', 'uint256', 'address', 'address', 'uint256', 'uint8', 'uint8', 'uint8'],
        [
          match.id,
          match.tournamentId,
          match.redId,
          match.blueId,
          match.nominationId,
          match.resultRed === 0 ? 0 : match.resultRed === 1 ? 1 : 2, // DRAW = 2
          match.scoreRed,
          match.scoreBlue
        ]
      );

      const tx = await contract.recordMatch(
        match.id,
        match.tournamentId,
        match.redId,
        match.blueId,
        match.nominationId,
        match.resultRed === 0 ? 0 : match.resultRed === 1 ? 1 : 2,
        match.scoreRed,
        match.scoreBlue,
        match.doubleHits || 0
      );

      await tx.wait(this.config.confirmations);

      await db.update(schemas.matches)
        .set({
          syncedToBlockchain: true,
          blockchainSyncedAt: new Date(),
          blockchainTxHash: tx.hash,
          blockchainHash: hash,
        })
        .where(eq(schemas.matches.id, match.id));

      console.log(`✅ Match #${match.id}: synced`);

    } catch (error: any) {
      console.error(`❌ Failed to sync match #${match.id}:`, error.message);
    }
  }

  private async syncUsersToBlockchain(): Promise<void> {
    console.log('📤 Syncing users DB → Blockchain...');

    // Получаем пользователей, которые ещё не синхронизированы
    const users = await db.query.users.findMany({
        where: eq(schemas.users.syncedToBlockchain, false),
        limit: this.config.batchSize,
    });

    if (users.length === 0) {
        console.log('⏭️ No users to sync');
        return;
    }

    const contract = this.userContract.connect(this.wallet);

    for (const user of users) {
        // Получаем или создаём blockchainId
        let blockchainId = user.blockchainId;

        if (!blockchainId) {
        // Находим максимальный существующий blockchainId
        const result = await db.execute(sql`
            SELECT COALESCE(MAX(blockchain_id), 0) as max_id
            FROM users
            WHERE blockchain_id IS NOT NULL
        `);

        const maxId = result.rows[0]?.max_id || 0;
        blockchainId = Number(maxId) + 1;

        // Сохраняем blockchainId в БД
        await db.update(schemas.users)
            .set({ blockchainId })
            .where(eq(schemas.users.id, user.id));
        }

        await this.processUserToBlockchain(user, blockchainId, contract);
    }
  }

  private async processUserToBlockchain(
    user: any,
    blockchainId: number,
    contract: ethers.Contract
  ): Promise<void> {
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        attempts++;

        try {
            // ✅ Получаем актуальный nonce перед каждой попыткой
            const nonce = await this.wallet.getNonce('pending');

            const existingUser = await contract.users(BigInt(blockchainId));

            if (!existingUser.exists) {
                const tx = await contract.registerUser(
                    BigInt(blockchainId),
                    user.username,
                    BigInt(user.clubId || 0),
                    BigInt(user.cityId || 0),
                    user.gender,
                    { nonce, gasLimit: 200000 }  // ← явно указываем nonce
                );
                await tx.wait(this.config.confirmations);
                console.log(`✅ User ${user.username} (blockchainId: ${blockchainId}) registered`);
            }

            await db.update(schemas.users)
                .set({
                    syncedToBlockchain: true,
                    blockchainSyncedAt: new Date(),
                    blockchainId: blockchainId,
                })
                .where(eq(schemas.users.id, user.id));

            return;

        } catch (error: any) {
            console.error(`❌ Failed to sync user ${user.id} attempt ${attempts}:`, error.message);

            if (error.message?.includes('nonce')) {
                await new Promise(r => setTimeout(r, 1000));
            } else if (attempts < maxAttempts) {
                await new Promise(r => setTimeout(r, 1000 * attempts));
            }
        }
    }
  }

  private async syncRatingsToBlockchain(): Promise<void> {
    console.log('📤 Syncing ratings DB → Blockchain...');

    const ratings = await db.query.userRatings.findMany({
      where: eq(schemas.userRatings.syncedToBlockchain, false),
      limit: this.config.batchSize,
    });

    if (ratings.length === 0) {
      console.log('⏭️ No ratings to sync');
      return;
    }

    const contract = this.userContract.connect(this.wallet);

    for (const [i, rating] of ratings.entries()) {
      // Получаем blockchainId пользователя
      const user = await db.query.users.findFirst({
        where: eq(schemas.users.id, rating.userId),
        columns: { blockchainId: true }
      });

      if (!user?.blockchainId) {
        console.error(`❌ No blockchainId for user ${rating.userId}`);
        continue;
      }

      await this.processRatingToBlockchain(rating, user.blockchainId, contract);

      if (i < ratings.length - 1) {
          await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  private async processRatingToBlockchain(
    rating: any,
    blockchainUserId: number,
    contract: ethers.Contract
  ): Promise<void> {
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      attempts++;

      try {
        const userExists = await contract.users(BigInt(blockchainUserId));

        if (!userExists.exists) {
            console.log(`⏭️ User ${blockchainUserId} not in blockchain yet, skipping rating sync`);
            // Помечаем рейтинг как требующий повторной синхронизации позже
            await db.update(schemas.userRatings)
                .set({
                    syncedToBlockchain: false,
                    blockchainSyncedAt: new Date()
                })
                .where(eq(schemas.userRatings.id, rating.id));
            return;
        }
        const volatilityInt = Math.round((rating.volatility || 0.06) * 100);
        const nonce = await this.wallet.getNonce('pending');

        // ✅ Полная версия со всей статистикой
        const tx = await contract.updateRating(
          BigInt(blockchainUserId),
          BigInt(rating.weaponId),
          BigInt(rating.nominationId),
          Math.round(rating.rating),
          Math.round(rating.rd || 350),
          volatilityInt,
          rating.currentRank || 0,
          BigInt(rating.lastTournamentId || 0),
          rating.matchesCount || 0,
          rating.wins || 0,
          rating.losses || 0,
          rating.draws || 0,
          rating.previousRank || 0,
          { nonce, gasLimit: 200000 }
        );

        const receipt = await tx.wait(this.config.confirmations);

        console.log(`✅ Rating for user blockchainId ${blockchainUserId}: updated (tx: ${receipt.hash})`);

        await db.update(schemas.userRatings)
          .set({
            syncedToBlockchain: true,
            blockchainSyncedAt: new Date(),
            blockchainTxHash: receipt.hash
          })
          .where(eq(schemas.userRatings.id, rating.id));

        return;

      } catch (error: any) {
        console.error(`❌ Rating #${rating.id} attempt ${attempts}:`, error.message);

        if (error.message?.includes('User not found')) {
            // Пользователь ещё не создан - откладываем синхронизацию
            console.log(`⏭️ User ${blockchainUserId} not found, will retry later`);
            await db.update(schemas.userRatings)
                .set({
                    syncedToBlockchain: false
                })
                .where(eq(schemas.userRatings.id, rating.id));
            return;
        }

        if (error.message?.includes('nonce')) {
            // Ждём немного дольше при nonce ошибке
            await new Promise(r => setTimeout(r, 2000));
        } else if (attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, 1000 * attempts));
        }
      }
    }
  }

  // ============ ЧТЕНИЕ ИЗ БЛОКЧЕЙНА (Blockchain → БД) ============

  private async syncUsersFromBlockchain(): Promise<void> {
    console.log('📥 Syncing users Blockchain → DB...');

    let totalUsers = 0;
    try {
        totalUsers = Number(await this.userContract.totalUsers());
    } catch (e) {
        console.log('Cannot get totalUsers from contract');
        return;
    }

    if (totalUsers === 0) {
        console.log('⏭️ No users in blockchain');
        return;
    }

    // Получаем последний blockchainId из таблицы users
    const lastUser = await db.query.users.findFirst({
        where: sql`${schemas.users.blockchainId} IS NOT NULL`,
        orderBy: (fields, { desc }) => [desc(fields.blockchainId)],
    });

    const startFrom = lastUser?.blockchainId || 0;

    for (let blockchainId = startFrom + 1; blockchainId <= totalUsers; blockchainId++) {
        await this.processUserFromBlockchain(blockchainId);
    }
  }

  private async processUserFromBlockchain(blockchainId: number): Promise<void> {
    try {
        const user = await this.userContract.users(BigInt(blockchainId));

        if (!user.exists) return;

        // Проверяем, есть ли уже пользователь в БД по blockchainId
        const existing = await db.query.users.findFirst({
        where: eq(schemas.users.blockchainId, blockchainId)
        });

        if (!existing) {
        // Создаём временного пользователя
        const [newUser] = await db.insert(schemas.users).values({
            blockchainId: blockchainId,
            username: user.username,
            clubId: Number(user.clubId),
            cityId: Number(user.cityId),
            gender: user.gender,
            syncedToBlockchain: true,
            syncedFromBlockchain: true,
            blockchainSyncedAt: new Date(),
            blockchainUpdatedAt: new Date(Number(user.lastUpdate) * 1000),
            // Временные данные - пользователь должен будет их заполнить
            email: `${blockchainId}@blockchain.user`,
            passwordHash: await hashPassword('pending_activation')
        }).returning();

        console.log(`📥 User with blockchainId ${blockchainId}: imported as ${newUser.id} (needs email setup)`);

        } else if (Number(user.lastUpdate) > (existing.blockchainUpdatedAt?.getTime() / 1000 || 0)) {
        await db.update(schemas.users)
            .set({
            username: user.username,
            clubId: Number(user.clubId),
            cityId: Number(user.cityId),
            syncedFromBlockchain: true,
            blockchainUpdatedAt: new Date(Number(user.lastUpdate) * 1000),
            })
            .where(eq(schemas.users.blockchainId, blockchainId));

        console.log(`📥 User with blockchainId ${blockchainId}: updated from blockchain`);
        }
    } catch (error: any) {
        console.error(`❌ Failed to process user blockchainId ${blockchainId}:`, error.message);
    }
  }

  private async syncTournamentsFromBlockchain(): Promise<void> {
    console.log('📥 Syncing tournaments Blockchain → DB...');

    let totalTournaments = 0;
    try {
      totalTournaments = Number(await this.tournamentContract.totalTournaments());
    } catch (e) {
      console.log('Cannot get totalTournaments from contract');
      return;
    }

    if (totalTournaments === 0) {
      console.log('⏭️ No tournaments in blockchain');
      return;
    }

    // Получаем последний ID из БД
    const lastTournament = await db.query.tournaments.findFirst({
      orderBy: desc(schemas.tournaments.id),
    });

    const startFrom = lastTournament?.id || 0;

    for (let tournamentId = startFrom + 1; tournamentId <= totalTournaments; tournamentId++) {
      await this.processTournamentFromBlockchain(tournamentId);
    }
  }

  private async processTournamentFromBlockchain(tournamentId: number): Promise<void> {
    try {
      const tournament = await this.tournamentContract.getTournament(tournamentId);

      if (!tournament.exists) return;
      const user = await db.query.users.findFirst({
        where: eq(schemas.users.blockchainId, Number(tournament.organizerId))
      })
      if (!user) return;

      const commonData = {
          title: tournament.title,
          date: new Date(Number(tournament.date) * 1000),
          cityId: Number(tournament.cityId),
          nominationIds: tournament.nominationIds.map(Number),
          status: tournament.status,
          matchesRoot: tournament.matchesRoot,
          syncedFromBlockchain: true,
          blockchainSyncedAt: new Date()
      }

      // Сохраняем в БД
      await db.insert(schemas.tournaments).values({
        id: tournamentId,
        organizerId: user.id,
        syncedToBlockchain: true,
        image: tournament.image,
        ...commonData
      }).onConflictDoUpdate({
        target: schemas.tournaments.id,
        set: {
          ...commonData
        }
      });

    let matchIds: number[] = [];

    try {
      // Пытаемся получить через контракт
      matchIds = await this.tournamentContract.getTournamentMatches?.(tournamentId) || [];
    } catch (e) {
      // Если метода нет, получаем через события
      matchIds = await this.getMatchIdsByTournament(tournamentId);
    }

    // Синхронизируем каждый матч
    for (const matchId of matchIds) {
      await this.processMatchFromBlockchain(Number(matchId));
    }

      console.log(`📥 Tournament #${tournamentId}: synced from blockchain`);

    } catch (error: any) {
      console.error(`❌ Failed to sync tournament #${tournamentId}:`, error.message);
    }
  }

  private async processMatchFromBlockchain(matchId: number): Promise<void> {
    try {
      const match = await this.tournamentContract.getMatch(matchId);

      if (!match.exists) return;

      await db.insert(schemas.matches).values({
        id: matchId,
        tournamentId: Number(match.tournamentId),
        redId: match.redFighter,
        blueId: match.blueFighter,
        nominationId: Number(match.nominationId),
        resultRed: match.result === 0 ? 0 : match.result === 1 ? 1 : 0.5,
        scoreRed: match.scoreRed,
        scoreBlue: match.scoreBlue,
        doubleHits: match.doubleHits,
        blockchainHash: match.matchHash,
        syncedFromBlockchain: true,
        syncedToBlockchain: true,
        blockchainSyncedAt: new Date(),
      }).onConflictDoUpdate({
        target: schemas.matches.id,
        set: {
          resultRed: match.result === 0 ? 0 : match.result === 1 ? 1 : 0.5,
          scoreRed: match.scoreRed,
          scoreBlue: match.scoreBlue,
          doubleHits: match.doubleHits,
          syncedFromBlockchain: true,
          blockchainSyncedAt: new Date(),
        }
      });

      console.log(`📥 Match #${matchId}: synced from blockchain`);

    } catch (error: any) {
      console.error(`❌ Failed to sync match #${matchId}:`, error.message);
    }
  }

  // ============ ОБРАБОТКА СОБЫТИЙ ============

  private async processUserEvent(blockchainId: number): Promise<void> {
    // Получаем полные данные из контракта
    const user = await this.userContract.users(BigInt(blockchainId));

    if (!user.exists) return;

    // Проверяем, есть ли уже в БД
    const existing = await db.query.users.findFirst({
      where: eq(schemas.users.blockchainId, blockchainId)
    });

    if (!existing) {
      // Создаём временного пользователя
      await db.insert(schemas.users).values({
        blockchainId: blockchainId,
        username: user.username,
        clubId: Number(user.clubId),
        cityId: Number(user.cityId),
        gender: user.gender,
        syncedToBlockchain: true,
        syncedFromBlockchain: true,
        blockchainSyncedAt: new Date(),
        email: `${blockchainId}@blockchain.user`,
        passwordHash: await hashPassword('pending_activation'),
      });

      console.log(`📝 User with blockchainId ${blockchainId}: registered from event`);
    }
  }

  private async processRatingEvent(
    blockchainUserId: number,
    weaponId: number,
    nominationId: number
    ): Promise<void> {
    // Получаем пользователя напрямую по blockchainId
    const user = await db.query.users.findFirst({
        where: eq(schemas.users.blockchainId, blockchainUserId)
    });

    if (!user) {
        console.warn(`⚠️ No local user for blockchainId ${blockchainUserId}, skipping rating event`);
        return;
    }

    try {
        // Получаем полные данные рейтинга из контракта
        const fullRating = await this.userContract.getRating(
            BigInt(blockchainUserId),
            BigInt(weaponId),
            BigInt(nominationId)
        );

        // Конвертируем volatility обратно в float
        const volatilityFloat = Number(fullRating.volatility) / 100;

        // Проверяем существующую запись
        const existing = await db.query.userRatings.findFirst({
            where: and(
                eq(schemas.userRatings.userId, user.id),
                eq(schemas.userRatings.weaponId, weaponId),
                eq(schemas.userRatings.nominationId, nominationId)
            )
        });

        const ratingData = {
            rating: Number(fullRating.rating),
            rd: Number(fullRating.rd),
            volatility: volatilityFloat,
            currentRank: Number(fullRating.rank),
            lastTournamentId: Number(fullRating.lastTournamentId || 0) || null,
            lastTournamentAt: fullRating.lastUpdate ? new Date(Number(fullRating.lastUpdate) * 1000) : null,
            matchesCount: Number(fullRating.matchesCount),
            wins: Number(fullRating.wins),
            losses: Number(fullRating.losses),
            draws: Number(fullRating.draws),
            syncedFromBlockchain: true,
            blockchainSyncedAt: new Date(),
        };

        if (existing) {
            // ✅ ОБНОВЛЯЕМ существующую запись
            await db.update(schemas.userRatings)
                .set(ratingData)
                .where(eq(schemas.userRatings.id, existing.id));

            console.log(`📝 Rating for user ${user.id}: UPDATED from event (rating: ${fullRating.rating}, rank: ${fullRating.rank})`);
        } else {
            // ✅ ВСТАВЛЯЕМ новую запись
            await db.insert(schemas.userRatings).values({
                userId: user.id,
                weaponId: weaponId,
                nominationId: nominationId,
                ...ratingData,
                syncedToBlockchain: true,
            });

            console.log(`📝 Rating for user ${user.id}: INSERTED from event (rating: ${fullRating.rating}, rank: ${fullRating.rank})`);
        }

    } catch (error: any) {
        console.error(`❌ Failed to process rating event:`, error.message);
    }
  }

  private async processMatchRecordedEvent(matchId: number, tournamentId: number): Promise<void> {
    try {
        // Получаем полные данные матча из контракта
        const match = await this.tournamentContract.getMatch(matchId);

        if (!match.exists) return;

        await db.insert(schemas.matches).values({
        id: matchId,
        tournamentId: Number(match.tournamentId),
        redId: match.redFighter,
        blueId: match.blueFighter,
        nominationId: Number(match.nominationId),
        resultRed: match.result === 0 ? 0 : match.result === 1 ? 1 : 0.5,
        scoreRed: match.scoreRed,
        scoreBlue: match.scoreBlue,
        doubleHits: match.doubleHits,
        blockchainHash: match.matchHash,
        syncedFromBlockchain: true,
        syncedToBlockchain: true,
        blockchainSyncedAt: new Date(),
        }).onConflictDoUpdate({
        target: schemas.matches.id,
        set: {
            resultRed: match.result === 0 ? 0 : match.result === 1 ? 1 : 0.5,
            scoreRed: match.scoreRed,
            scoreBlue: match.scoreBlue,
            doubleHits: match.doubleHits,
            syncedFromBlockchain: true,
            blockchainSyncedAt: new Date(),
        }
        });

        console.log(`📝 Match #${matchId}: recorded from event`);

    } catch (error: any) {
        console.error(`❌ Failed to process match event #${matchId}:`, error.message);
    }
  }

  private async processTournamentCreatedEvent(
    tournamentId: number,
    title: string,
    organizerId: number
    ): Promise<void> {
    try {
        const tournament = await this.tournamentContract.getTournament(tournamentId);
        if (!tournament.exists) return;
        const user = await db.query.users.findFirst({
          where: eq(schemas.users.blockchainId, organizerId)
        })
        if (!user) return;

        const commonData = {
            title: tournament.title,
            date: new Date(Number(tournament.date) * 1000),
            cityId: Number(tournament.cityId),
            nominationIds: tournament.nominationIds.map(Number),
            status: tournament.status,
            matchesRoot: tournament.matchesRoot,
            syncedFromBlockchain: true,
            blockchainSyncedAt: new Date()
        }

      await db.insert(schemas.tournaments).values({
        id: tournamentId,
        organizerId: user.id,
        syncedToBlockchain: true,
        image: tournament.image,
        ...commonData
      }).onConflictDoUpdate({
        target: schemas.tournaments.id,
        set: {
          ...commonData
        }
      });

        console.log(`📝 Tournament #${tournamentId}: created from event`);

    } catch (error: any) {
        console.error(`❌ Failed to process tournament event #${tournamentId}:`, error.message);
    }
  }

  // ============ ОСНОВНАЯ СИНХРОНИЗАЦИЯ ============

  async syncAll(): Promise<void> {
    if (this.isSyncing) {
      console.log('⚠️ Sync already in progress, skipping...');
      return;
    }

    this.isSyncing = true;
    console.log('\n🔄 Starting full sync cycle...');

    try {
      // Запись в блокчейн (БД → Blockchain)
      await this.syncTournamentsToBlockchain();
      await this.syncMatchesToBlockchain();
      await this.syncUsersToBlockchain();
      await this.syncRatingsToBlockchain();

      // Чтение из блокчейна (Blockchain → БД)
      await this.syncUsersFromBlockchain();
      await this.syncTournamentsFromBlockchain()

      console.log(`✅ Full sync completed: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`);
    } catch (error) {
      console.error(`❌ Sync failed: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, error);
    } finally {
      this.isSyncing = false;
    }
  }

  async syncToBlockchainOnly(): Promise<void> {
    console.log('\n🔄 Syncing DB → Blockchain only...');

    try {
      await this.syncTournamentsToBlockchain();
      await this.syncMatchesToBlockchain();
      await this.syncUsersToBlockchain();
      await this.syncRatingsToBlockchain();
      console.log('✅ DB → Blockchain sync completed');
    } catch (error) {
      console.error('❌ Sync failed:', error);
    }
  }

  // ============ HELPER FUNCTIONS ============

  private async getMatchIdsByTournament(tournamentId: number): Promise<number[]> {
    // Если в контракте нет getTournamentMatches, получаем через события
    const filter = this.tournamentContract.filters.MatchRecorded();
    const events = await this.tournamentContract.queryFilter(filter);

    return events
      .filter(event => event.args?.tournamentId === BigInt(tournamentId))
      .map(event => Number(event.args?.matchId));
  }

  async stop(): Promise<void> {
    console.log('🛑 Stopping Blockchain Sync Service...');
    this.tournamentContract.removeAllListeners();
    this.userContract.removeAllListeners();
    this.isSyncing = false;
    console.log('✅ Service stopped');
  }
}

const config: SyncConfig = {
  rpcUrl: process.env.RPC_URL || 'http://127.0.0.1:8545',
  servicePrivateKey: process.env.CRYPTO_PRIVATE_KEY!,
  userContractAddress: addresses.User,
  tournamentContractAddress: addresses.Tournament,
  syncInterval: process.env.SYNC_INTERVAL || '*/5 * * * *',
  batchSize: 50,
  confirmations: 1,
};

// Создаём и экспортируем единственный экземпляр
const blockchainSyncService = new BlockchainSyncService(config);

// Функция для запуска (вызывается в main)
async function startBlockchainSync(): Promise<void> {
  try {
    await blockchainSyncService.start();
  } catch (error) {
    console.error('Failed to start blockchain sync:', error);
    process.exit(1);
  }
}

await startBlockchainSync()