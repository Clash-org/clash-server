/**
 * Clash Server - Tournament Management System
 * Copyright (C) 2026 Clash Contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { onEvent, RATING_EVENTS } from "../../shared/event-bus";
import { TournamentRepository } from "./repository";
import { NominationService, TournamentService, WeaponService } from "./service";

const tournamentService = new TournamentService();
const weaponService = new WeaponService();
const nominationService = new NominationService();
const tournamentRepository = new TournamentRepository()

function initTournamentsModule() {
    onEvent(RATING_EVENTS.PROCESS_TOURNAMENT, async ({ matchesCount, participantsCount, tournamentId, nominationId }) => {
        await tournamentService.updateParticipantsCountAndMatchesCount(tournamentId, nominationId, participantsCount, matchesCount)
    })

    onEvent(RATING_EVENTS.TOURNAMENT_END, async ({ winners, tournamentId }) => {
        await tournamentService.setWinners(winners, tournamentId)
    })
}

export { tournamentService, weaponService, nominationService, tournamentRepository, initTournamentsModule }