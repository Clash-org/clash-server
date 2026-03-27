/**
 * Clash Server - Tournament Management System
 * Copyright (C) 2026 Clash Contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { and, asc, eq } from "drizzle-orm";
import { db } from "../../shared/db/postgres";
import { User } from "../users/schema";
import { tournamentParticipants, tournaments } from "./schema";
import { userService } from "../users";
import { aiService } from "../ai";

export class TournamentRepository {
  async getParticipantsWithUserAndClub(tournamentId: number, nominationIds: number[]) {
    const data: {[nominationId: number]: User[] } = {}
    for (let id of nominationIds) {
      const res = await db.query.tournamentParticipants.findMany({
        where: and(
          eq(tournamentParticipants.tournamentId, tournamentId),
          eq(tournamentParticipants.nominationId, id)
        ),
        orderBy: asc(tournamentParticipants.createdAt),
        with: {
          user: {
            with: {
              club: true
            }
          }
        }
      })
      data[id] = res.map(r=>({...r.user, status: r.status}))
    }
    return data
  }

  async getTournamentsWithParticipantsAndCity(tournamentId: number) {
    return await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId),
      with: {
        city: true, // автоматически подгружает город
        participants: {
          with: {
            user: true, // Получаем данные пользователя
          },
        },
      },
    });
  }

  async getUserById(userId: string) {
    return await userService.getById(userId)
  }

  async getAiTranslateWeapon(title: string) {
    return await aiService.translateValue(title)
  }
}