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
}

export { tournamentService, weaponService, nominationService, tournamentRepository, initTournamentsModule }