/**
 * Clash Server - Tournament Management System
 * Copyright (C) 2026 Clash Contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { and, desc, eq } from "drizzle-orm";
import { db } from "../../shared/db/postgres";
import { nominationService, tournamentService, weaponService } from "../tournaments";
import { userService } from "../users";
import { matches, userRatings } from "./schema";

export class RatingRepository {
    async getUserById(userId: string) {
        return await userService.getById(userId)
    }

    async getTournamentById(tournamentId: number) {
        return await tournamentService.getById(tournamentId, "en")
    }

    async getUsersWithRatings() {
        return await db.query.users.findMany({
              with: {
                ratings: {
                  with: {
                    weapon: true,
                    nomination: true
                  }
                }
              },
            //   where: sql`${users.totalMatches} > 0`
        });
    }

    async getWeaponById(weaponId: number) {
        return await weaponService.getById(weaponId)
    }

    async getNominations() {
        return await nominationService.getAll("en")
    }

    async getNominationById(nominationId: number) {
        return await nominationService.getById(nominationId)
    }

    async getTournamentsCount() {
        return await tournamentService.getCount()
    }

    async getRatingsWithUsers(weaponId: number, nominationId: number, limit: number) {
        return await db.query.userRatings.findMany({
              where: and(
                eq(userRatings.weaponId, weaponId),
                eq(userRatings.nominationId, nominationId)
              ),
              orderBy: desc(userRatings.rating),
              // limit,
              with: {
                user: {
                  columns: {
                    id: true,
                    username: true
                  }
                }
              }
            });
    }

    async getMatchesWithUsers(tournamentId: number, nominationId: number) {
      return await db.query.matches.findMany({
        where: and(
          eq(matches.tournamentId, tournamentId),
          eq(matches.nominationId, nominationId)
        ),
        columns: {
          redId: false,
          blueId: false
        },
        with: {
          red: true,
          blue: true
        }
      })
    }
}