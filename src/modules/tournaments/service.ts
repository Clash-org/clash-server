/**
 * Clash Server - Tournament Management System
 * Copyright (C) 2026 Clash Contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { db } from "../../shared/db/postgres.js";
import { and, count, eq, inArray, or, sql, asc } from "drizzle-orm";
import { isAdmin } from "../../shared/utils/helpers.js";
import { reverseTranslateWeapon, translateCity, translateNomination, translateWeapon } from "../../shared/utils/translations.js";
import { AdditionsInfoType, ParticipantStatusType, TournamentStatus, TournamentStatusType } from "../../shared/typings/index.js";
import { nominations, tournamentParticipants, Weapon, Nomination, weapons, additionalParticipantsInfo, AdditionalParticipantsInfo, NewTournament, pools, NewPool, nominationsRU, nominationsCN, weaponsRU, weaponsCN, tournaments } from "./schema.js";
import { tournamentRepository } from "./index.js";
import { NominationType } from "../../shared/utils/rating.js";
import { User } from "../users/schema.js";
import { emitEvent, TOURNAMENT_EVENTS } from "../../shared/event-bus.js";

function getNewAdditionsWeapons(info: AdditionsInfoType, weapons: string[]) {
  return Object.keys(info).reduce((sum, weapon, idx)=>({ ...sum, [weapons[idx]]: info[weapon] }), {})
}

export class WeaponService {
  async getAll() {
    return await db.select().from(weapons);
  }

  async create(title: string) {
    const translates = await tournamentRepository.getAiTranslateWeapon(title)
    const [weapon] = await db.insert(weapons).values({ title: translates.en }).returning()
    await db.insert(weaponsRU).values({ title: translates.ru })
    await db.insert(weaponsCN).values({ title: translates.cn })
    return weapon.id
  }

  async getById(id: number) {
    return await db.query.weapons.findFirst({ where: eq(weapons.id, id) })
  }
}

export class NominationService {
  async getAll(lang: string) {
    const response = await db.query.nominations.findMany({
      with: {
        weapon: true  // автоматически подгружает связанное оружие
      }
    });

    type Res = Omit<typeof response[number], "weaponId">
    const result: Res[] = new Array(response.length)
    for (let [i, r] of response.entries()) {
      const { weaponId, ...otherData } = r
        result[i] = {
          ...otherData,
          title: await translateNomination(lang, otherData.title),
          weapon: otherData.weapon ? {
            ...otherData.weapon,
            title: await translateWeapon(lang, otherData.weapon.title)
          } : null
        }
    }

    return result
  }

  async create(title: NominationType, weaponId: number) {
    const translates = await tournamentRepository.getAiTranslateWeapon(title)
    await db.insert(nominations).values({ title: translates.en, weaponId })
    await db.insert(nominationsRU).values({ title: translates.ru })
    await db.insert(nominationsCN).values({ title: translates.cn })
    return { success: true };
  }

  async getById(id: number) {
    return await db.query.nominations.findFirst({ where: eq(nominations.id, id), with: { weapon: true } })
  }
}

export class TournamentService {
  async getAll(lang: string, short: boolean, page: number) {
    const PAGE_SIZE = 10
    const tournamentsArray = await db.query.tournaments.findMany({
      where: eq(tournaments.isInternal, false),
      with: {
        city: true,
      },
      limit: PAGE_SIZE * page,
      offset: (page - 1) * PAGE_SIZE,
    });
    const tournamentsCount = await this.getCount()
    if (short) {
      const transformedTournaments = new Array(tournamentsArray.length);
      for (let i = 0; i < tournamentsArray.length; i++) {
        const { cityId, ...tournament } = tournamentsArray[i];
        transformedTournaments[i] = {
          id: tournament.id,
          title: tournament.title,
          date: tournament.date,
          image: tournament.image,
          status: tournament.status,
          organizer: await tournamentRepository.getUserById(tournament.organizerId),
          city: await translateCity(lang, tournament.city.title)
        };
      }

      return {
        tournaments: transformedTournaments,
        tournamentsCount: tournamentsCount
      }
    }

    const transformedTournaments = new Array(tournamentsArray.length);
    for (let i = 0; i < tournamentsArray.length; i++) {
      const { cityId, ...tournament } = tournamentsArray[i];
      transformedTournaments[i] = {
        ...tournament,
        city: {
          ...tournament.city,
          title: await translateCity(lang, tournament.city.title)
        }
      };
    }

    return {
      tournaments: transformedTournaments,
      tournamentsCount: tournamentsCount
    };
  }

  async getById(id: number, lang: string) {
    const tournament = await tournamentRepository.getTournamentsWithParticipantsAndCity(id)
    if (!tournament) throw new Error("Tournament doesn't exist");
    if (!tournament.city) throw new Error("City doesn't exist");

    const nominationsArr = await db.query.nominations.findMany({
      where: inArray(nominations.id, tournament.nominationsIds),
      with: {
        weapon: true,
      },
    });

    const { cityId, ...otherData } = tournament;

    const transformedNominations = new Array(nominationsArr.length);
    for (let i = 0; i < nominationsArr.length; i++) {
      const nom = nominationsArr[i];
      transformedNominations[i] = {
        ...nom,
        title: await translateNomination(lang, nom.title),
        weapon: {
          ...nom.weapon,
          title: await translateWeapon(lang, nom.weapon!.title)
        }
      };
    }

    return {
      ...otherData,
      city: {
        ...tournament.city,
        title: await translateCity(lang, tournament.city.title)
      },
      nominations: transformedNominations,
      participants: tournament.participants.map(p => p.user)
    };
  }

  async getByIds(ids: number[], lang: string) {
    const results = []
    for (let id of ids) {
      results.push(await this.getById(id, lang))
    }

    return results
  }

  async getTournamentsByUserId(userId: string, lang: string) {
    const tournamentParticipantsArr = await db.query.tournamentParticipants.findMany({
      where: eq(tournamentParticipants.userId, userId),
      with: {
        tournament: true
      }
    })

    const newTournamentParticipantsArr = tournamentParticipantsArr.filter((obj, idx, arr) => idx === arr.findIndex((t) => t.tournamentId === obj.tournamentId))

    const nominationsArr: (Nomination & { weapon: Weapon })[][] = []
    for (let tournamentParticipant of tournamentParticipantsArr) {
      nominationsArr.push(await db.query.nominations.findMany({
        where: eq(nominations.id, tournamentParticipant.nominationId),
        with: {
          weapon: true,
        },
      }))

    }

    const transformedNominations = new Array(nominationsArr.flat().length);
    for (let i = 0; i < newTournamentParticipantsArr.length; i++) {
      // Трансформируем nominations
      const flatNominations = nominationsArr.flat();
      for (let j = 0; j < flatNominations.length; j++) {
        const nom = flatNominations[j];
        transformedNominations[j] = {
          ...nom,
          title: await translateNomination(lang, nom.title),
          weapon: {
            ...nom.weapon,
            title: await translateWeapon(lang, nom.weapon!.title)
          }
        };
      }
    }

    return newTournamentParticipantsArr.map(t=>({ ...t.tournament, nominations: transformedNominations }))
  }

  async getByOrganizerId(id: string, lang: string) {
    const data = await db.execute(
      sql`SELECT * FROM tournaments WHERE organizer_id = ${id}`
    )

    const nominationsArr: (Nomination & { weapon: Weapon })[][] = []
    const moderators: User[] = []
    for (let tournament of data.rows) {
      for (let moderatorId of tournament["moderators_ids"]) {
        moderators.push(await tournamentRepository.getUserById(moderatorId))
      }
      nominationsArr.push(await db.query.nominations.findMany({
        where: inArray(nominations.id, tournament["nominations_ids"]),
        with: {
          weapon: true,
        },
      }))

    }

    const transformedRows = new Array(data.rows.length);
    for (let i = 0; i < data.rows.length; i++) {
      const d = data.rows[i];

      // Трансформируем nominations
      const transformedNominations = new Array(nominationsArr.flat().length);
      const flatNominations = nominationsArr.flat();
      for (let j = 0; j < flatNominations.length; j++) {
        const nom = flatNominations[j];
        transformedNominations[j] = {
          ...nom,
          title: await translateNomination(lang, nom.title),
          weapon: {
            ...nom.weapon,
            title: await translateWeapon(lang, nom.weapon!.title)
          }
        };
      }

      const { city_id,
        nominations_ids,
        organizer_id,
        social_medias,
        participants_count,
        matches_count,
        is_additions,
        is_internal,
        moderators_ids,
        created_at, ...other } = {
        ...d,
        cityId: d.city_id,
        nominationsIds: d.nominations_ids,
        organizerId: d.organizer_id,
        socialMedias: d.social_medias,
        participantsCount: d.participants_count,
        matchesCount: d.matches_count,
        isAdditions: d.is_additions,
        isInternal: d.is_internal,
        moderatorsIds: d.moderators_ids,
        moderators: moderators,
        nominations: transformedNominations,
        createdAt: d.created_at
      };

      transformedRows[i] = other;
    }

    return transformedRows;
  }

  async getCount() {
    return (await db.select({ count: count() })
          .from(tournaments))[0].count;
  }

  async addParticipantInfo(tournamentId: number, userId: string, info: AdditionsInfoType, lang: string) {
    const weaponsKeys = Object.keys(info["weaponsRental"]);
    const weapons = new Array(weaponsKeys.length);
    for (let i = 0; i < weaponsKeys.length; i++) {
      weapons[i] = await reverseTranslateWeapon(lang, weaponsKeys[i]);
    }
    await db.insert(additionalParticipantsInfo).values({
      tournamentId,
      userId,
      info: {
        ...info,
        weaponsRental: getNewAdditionsWeapons(info["weaponsRental"], weapons)
      }
    })

    return { success: true }
  }

  async getParticipantInfo(tournamentId: number, lang: string) {
    const result: (Omit<AdditionalParticipantsInfo, "userId"> & { user: User|undefined }|undefined)[] = []
    const res = await db.query.additionalParticipantsInfo.findMany({
        where: eq(additionalParticipantsInfo.tournamentId, tournamentId)
    })
    for (let data of res) {
      const user = await tournamentRepository.getUserById(data.userId)
      const weaponsKeys = Object.keys(data.info["weaponsRental"]);
      const weapons = new Array(weaponsKeys.length);
      for (let i = 0; i < weaponsKeys.length; i++) {
        weapons[i] = await translateWeapon(lang, weaponsKeys[i]);
      }
      const newWeaponsRental = getNewAdditionsWeapons(data.info["weaponsRental"], weapons)
      result.push({
        ...data,
        info: {
          ...data.info,
          weaponsRental: newWeaponsRental
        },
        user
      })
    }

    return result
  }

  async create(data: NewTournament) {
    const [tournament] = await db
      .insert(tournaments)
      .values(data)
      .returning();

    if (data.moderatorsIds) {
      for (let moderatorId of data.moderatorsIds) {
        emitEvent(TOURNAMENT_EVENTS.CREATED, { tournamentId: tournament.id, userId: moderatorId })
      }
    }
    return tournament;
  }

  async update(data: Omit<NewTournament, "organizerId"> & { tournamentId: number }) {
    const { tournamentId, ...other } = data
    const [tournament] = await db
      .update(tournaments)
      .set(other)
      .where(eq(tournaments.id, tournamentId))
      .returning()

    const moderators: User[] = []
    if (data.moderatorsIds) {
      for (let moderatorId of data.moderatorsIds) {
        emitEvent(TOURNAMENT_EVENTS.CREATED, { tournamentId: tournament.id, userId: moderatorId })
        const user = await tournamentRepository.getUserById(moderatorId)
        if (user)
          moderators.push(user)
      }
    }
    const { moderatorsIds, ...t } = tournament
    return {...t, moderators }
  }

  async updateStatus(data: { status: TournamentStatusType, tournamentId: number }) {
    const { tournamentId, ...other } = data
    const [tournament] = await db
      .update(tournaments)
      .set(other)
      .where(eq(tournaments.id, tournamentId))
      .returning()
    return tournament
  }

  async setWinners(winners: {[nominationId: number]: string[]}, tournamentId: number) {
    await db.update(tournaments).set({ winners }).where(eq(tournaments.id, tournamentId))
  }

  async updateParticipantsCountAndMatchesCount(tournamentId: number, nominationId: number, participantsCount: number, matchesCount: number) {
    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId)
    })

    const bufParticipantsCountInFact = {...tournament?.participantsCountInFact}
    const bufMatchesCount = {...tournament?.matchesCount}

    bufParticipantsCountInFact[nominationId] = participantsCount
    bufMatchesCount[nominationId] = matchesCount
    await db.update(tournaments)
      .set({
        participantsCountInFact: bufParticipantsCountInFact,
        matchesCount: bufMatchesCount
      })
      .where(eq(tournaments.id, tournamentId));
  }

  async deleteTournament(tournamentId: number, actorId: string) {
    const tournament = await db.query.tournaments.findFirst({
      where: and(
        eq(tournaments.organizerId, actorId),
        eq(tournaments.id, tournamentId)
      )
    })

    if (!tournament) {
      if (!(await isAdmin(actorId))) {
        throw new Error("You not a organizer or admin")
      }
    }
    await db
      .delete(tournaments)
      .where(eq(tournaments.id, tournamentId));

    return { success: true }
  }

  async createPool(pool: NewPool) {
    await db
          .insert(pools)
          .values(pool)
    return { success: true }
  }

  async updatePool(poolId: number, pool: NewPool) {
    await db
          .update(pools)
          .set(pool)
          .where(eq(pools.id, poolId))
    return { success: true }
  }

  async updatePoolEnd(poolId: number, isEnd: boolean) {
    await db
          .update(pools)
          .set({ isEnd })
          .where(eq(pools.id, poolId))
    return { success: true }
  }

  async getPoolNomination(tournamentId: number, nominationId: number) {
    const pool = await db.query.pools.findFirst({
      where: and(
        eq(pools.tournamentId, tournamentId),
        eq(pools.nominationId, nominationId)
      )
    })

    if (!pool) {
      throw new Error("Pool is not exist")
    }

    return pool
  }

  async getPools(tournamentId: number, moderatorId: string) {
    const poolArr = (await db.select()
    .from(pools)
    .innerJoin(tournaments, eq(pools.tournamentId, tournaments.id))
    .orderBy(asc(pools.createdAt))
    .where(
      and(
        eq(pools.tournamentId, tournamentId),
        or(eq(pools.moderatorId, moderatorId), eq(tournaments.organizerId, moderatorId))
      )
    )).map(res=>res.pools)

    const pairs: [User|null, User|null][][] = new Array(poolArr.length)
    for (let poolIndex in poolArr) {
      pairs[poolIndex] = []
      for (let id of poolArr[poolIndex].pairsIds) {
        const newPair: [User|null, User|null] = [null, null]
        if (id[0] !== "null") {
          const fighterRed = await tournamentRepository.getUserById(id[0])
          if (fighterRed)
            newPair[0] = fighterRed
        }

        if (id[1] !== "null") {
          const fighterBlue = await tournamentRepository.getUserById(id[1])
          if (fighterBlue)
            newPair[1] = fighterBlue
        }
        pairs[poolIndex].push(newPair)
      }
    }

    return poolArr.map((pool, i)=>({
      ...pool,
      pairs: pairs[i]
    }))
  }

  async getTournamentUsers(tournamentId: number, nominationIds: number[]) {
    return await tournamentRepository.getParticipantsWithUserAndClub(tournamentId, nominationIds)
  }

  async addUserToTournament(userId: string, tournamentId: number, nominationId: number) {
    // Проверяем, не зарегистрирован ли пользователь уже на этот турнир
    const existingRegistration = await db.execute(
      sql`SELECT * FROM tournament_participants WHERE user_id = ${userId} AND tournament_id = ${tournamentId} AND nomination_id = ${nominationId}`
    )

    if (existingRegistration.rowCount) {
      throw new Error("User already registered for this tournament");
    }

    const tournament = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId)
    })

    if (tournament?.status !== TournamentStatus.ACTIVE) {
      throw new Error("Tournament has 'pending' status");
    }

    await db
      .insert(tournamentParticipants)
      .values({ userId, tournamentId, nominationId })

    return { success: true };
  }

  async updateUserTournamentStatus(tournamentId: number, nominationId: number, userId: string, status: ParticipantStatusType) {
    const currentRegistration = await db.query.tournamentParticipants.findFirst({
      where: and(
        eq(tournamentParticipants.tournamentId, tournamentId),
        eq(tournamentParticipants.nominationId, nominationId),
        eq(tournamentParticipants.userId, userId)
      ),
    });

    if (!currentRegistration) {
      throw new Error("No active registration found for this user in the tournament");
    }

    // 2. Проверяем, не пытаемся ли установить тот же статус
    if (currentRegistration.status === status) {
      return {
        success: true
      };
    }

    await db
        .update(tournamentParticipants)
        .set({
          status
        })
        .where(eq(tournamentParticipants.id, currentRegistration.id))
    return { success: true };
  }

  async deleteUserFromTournament(actorId: string, userId: string, tournamentId: number, nominationId: number) {
    const registration = await db.query.tournamentParticipants.findFirst({
      where: and(
        eq(tournamentParticipants.tournamentId, tournamentId),
        eq(tournamentParticipants.nominationId, nominationId),
        eq(tournamentParticipants.userId, userId)
      ),
    });

    if (!registration) {
      throw new Error("Registration not found for this user in the tournament");
    }

    if (registration.userId !== actorId && await !isAdmin(actorId)) {
      throw new Error("You not admin or this person");
    }

    await db
      .delete(tournamentParticipants)
      .where(eq(tournamentParticipants.id, registration.id));

    return { success: true }
  }
}