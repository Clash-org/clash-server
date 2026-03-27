/**
 * Clash Server - Tournament Management System
 * Copyright (C) 2026 Clash Contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { db } from "../../shared/db/postgres";
import { hashPassword, verifyPassword } from "../../shared/utils/password";
import { getTokenPayload, generateTokens, verifyToken } from "../../shared/utils/jwt";
import type { RegisterInput, LoginInput } from "./validation";
import { translateCity } from "../../shared/utils/translations";
import { emitEvent, USER_EVENTS } from "../../shared/event-bus";
import { asc, eq, sql } from "drizzle-orm";
import { cities, citiesCN, citiesRU, City, Club, clubs, NewUser, User, users } from "./schema";
import { userRepository } from "./index";
import { isAdmin, removeEmptyFields } from "../../shared/utils/helpers"

const getUser = async (lang: string, user: User & { city: City, club: Club }) => ({
  id: user.id,
  email: user.email,
  username: user.username,
  gender: user.gender,
  city: {
    ...user.city,
    title: await translateCity(lang, user.city.title)
  },
  moderatorTournamentsIds: user.moderatorTournamentsIds,
  club: user.club,
  isAdmin: user.isAdmin,
  totalMatches: user.totalMatches,
  createdAt: user.createdAt.toISOString()
})

export class AuthService {
  async register(input: RegisterInput & { cityId?: number }, lang: string) {
    const city = await db.query.cities.findFirst({
        where: eq(cities.id, input.cityId),
    });
    if (!city) {
      throw new Error("City not found");
    }

    const existing = await db.query.users.findFirst({
      where: eq(users.email, input.email),
    });

    if (existing) {
      throw new Error("User with this email already exists");
    }

    const club = await db.query.clubs.findFirst({
      where: eq(clubs.id, input.clubId),
    });

    if (!club) {
      throw new Error("Club not found");
    }

    const passwordHash = await hashPassword(input.password);
    const [user] = await db
      .insert(users)
      .values({
        email: input.email,
        username: input.username,
        gender: input.gender,
        cityId: input.cityId,
        clubId: input.clubId,
        passwordHash,
      })
      .returning();

    emitEvent(USER_EVENTS.CREATED, {
      userId: user.id
    });
    const tokens = await generateTokens(user.id, user.email);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: await getUser(lang, {...user, city, club: club }),
    };
  }

  async login(input: LoginInput, lang: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, input.email),
      with: {
        city: true,
        club: true
      }
    });

    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new Error("Invalid credentials");
    }

    const tokens = await generateTokens(user.id, user.email);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: await getUser(lang, user),
    };
  }

  async refresh(refreshToken: string) {
    const payload = await verifyToken(refreshToken);

    if (!payload || payload.type !== "refresh") {
      throw new Error("Invalid refresh token");
    }

    const tokens = await generateTokens(payload.sub, payload.email);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async validateToken(token: string, lang: string) {
    const payload = await getTokenPayload(token)
    if (!payload) return null

    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.sub),
      with: {
        city: true,
        club: true
      }
    });

    if (!user) return null;

    return await getUser(lang, user);
  }
}

export class UserService {
  async getAll(lang?: string) {
    const usersArr = await db.query.users.findMany({
      with: {
        city: true,
        club: true
      },
      orderBy: asc(users.createdAt)
    })
    const result: User[] = new Array(usersArr.length)
    for (let i = 0; i < result.length; i++) {
      result[i] = await getUser(lang||"en", usersArr[i])
    }
    return result
  }

  async getByClubId(clubId: number) {
    const usersArr = await db.query.users.findMany({
      where: eq(users.clubId, clubId)
    })

    return userRepository.getUsersCountFromParticipants(usersArr)
  }

  async getById(userId: string) {
    const user = db.query.users.findFirst({
          where: eq(users.id, userId),
          with: {
            club: true,
            city: true
          }
    });

    if (!user) throw new Error("User not found")
    return user
  }

  async update(userId: string, data: (Partial<Omit<NewUser, "passwordHash">> & { password?: string }), actorId: string, lang: string) {
    const { password, isAdmin: adminIs, ...other } = data
    let passwordHash = ""
    let isAdminVar = false
    if (password) {
      passwordHash = await hashPassword(password);
    }

    if (await isAdmin(actorId) && adminIs) {
      isAdminVar = adminIs
    }
    const pureData = removeEmptyFields(other)
    await db.update(users)
      .set(passwordHash ? {...pureData, isAdmin: isAdminVar, passwordHash, updatedAt: new Date()} : {...pureData, isAdmin: isAdminVar, updatedAt: new Date()})
      .where(eq(users.id, userId))

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      with: {
        city: true,
        club: true
      }
    })
    return await getUser(lang, user)
  }

  async updateUserTournamentModerator(tournamentId: number, userId: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        moderatorTournamentsIds: true
      }
    });

    if (!user || !user.moderatorTournamentsIds) return

    if (user.moderatorTournamentsIds.includes(tournamentId))
      return

    const newIds = [...user.moderatorTournamentsIds, tournamentId];

    await db.update(users)
      .set({
        moderatorTournamentsIds: newIds,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
    }

    async updateUserMatches(matchesPlayed: number, userId: string) {
      await db.update(users)
        .set({
          totalMatches: sql`${users.totalMatches} + ${matchesPlayed}`,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));
    }
}

export class ClubService {
  async getAll() {
    return await db.select().from(clubs);
  }

  async getById(id: number) {
    return await db.query.clubs.findFirst({
      where: eq(clubs.id, id),
    });
  }

  async create(title: string) {
    const isClub = await db.query.clubs.findFirst({
      where: eq(clubs.title, title),
    });
    if (isClub) {
      throw new Error("Club is exist");
    }

    const [club] = await db
      .insert(clubs)
      .values({ title })
      .returning();
    return club;
  }

  async delete(id: number) {
    await db.delete(clubs).where(eq(clubs.id, id));
    return { success: true };
  }
}

export class CityService {
  async getAll(lang: string) {
    const citiesArr = await db.select().from(cities);
    if (lang === "en") {
      return citiesArr;
    } else {
      const translatedCities = new Array(citiesArr.length);
      for (let i = 0; i < citiesArr.length; i++) {
        translatedCities[i] = {
          ...citiesArr[i],
          title: await translateCity(lang, citiesArr[i].title)
        };
      }
      return translatedCities;
    }
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
    if (isCity) {
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

  async createRU(title: string) {
    await db
          .insert(citiesRU)
          .values({ title })
  }

  async createCN(title: string) {
    await db
          .insert(citiesCN)
          .values({ title })
  }

  async deleteAllRU() {
    await db.delete(citiesRU);
    return { success: true };
  }

  async deleteAllCN() {
    await db.delete(citiesCN);
    return { success: true };
  }
}