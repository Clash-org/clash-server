import { onEvent, RATING_EVENTS, TOURNAMENT_EVENTS } from "../../shared/event-bus";
import { UserRepository } from "./repository";
import { AuthService, CityService, ClubService, UserService } from "./service";

const authService = new AuthService();
const userService = new UserService()
const clubService = new ClubService();
const cityService = new CityService();
const userRepository = new UserRepository();

function initUsersModule() {
  onEvent(RATING_EVENTS.HISTORY_ADDED, async ({ matchesPlayed, redId }) => {
    // ✅ Обновляем рейтинг у пользователя
    await userService.updateUserMatches(matchesPlayed, redId);
  });

  onEvent(TOURNAMENT_EVENTS.CREATED, async ({ tournamentId, userId })=>{
    userService.updateUserTournamentModerator(tournamentId, userId)
  })
}

export { authService, userService, clubService, cityService, userRepository, initUsersModule }
