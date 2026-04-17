/**
 * Clash Server - Tournament Management System
 * Copyright (C) 2026 Clash Contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { onEvent, RATING_EVENTS, TOURNAMENT_EVENTS } from "../../shared/event-bus";
import { UserRepository } from "./repository";
import { AuthService, CityService, ClubService, UserService } from "./service";

const authService = new AuthService();
const userService = new UserService()
const clubService = new ClubService();
const cityService = new CityService();
const userRepository = new UserRepository();

function initUsersModule() {
  onEvent(RATING_EVENTS.HISTORY_ADDED, async ({ matchesPlayed, userId }) => {
    // ✅ Обновляем рейтинг у пользователя
    await userService.updateUserMatches(matchesPlayed, userId);
  });

  onEvent(TOURNAMENT_EVENTS.CREATED, async ({ tournamentId, userId })=>{
    await userService.updateUserTournamentModerator(tournamentId, userId)
  })

  onEvent(TOURNAMENT_EVENTS.UPDATED, async ({ tournamentId, userId })=>{
    await userService.deleteTournamenModerator(tournamentId, userId)
  })
}

export { authService, userService, clubService, cityService, userRepository, initUsersModule }
