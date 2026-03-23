import { db } from "../../shared/db/postgres";
import { and, eq } from "drizzle-orm";
import { User } from "./schema";
import { tournamentParticipants } from "../tournaments/schema";
import { ParticipantStatus } from "../../shared/typings";

export class UserRepository {
    async getUsersCountFromParticipants(users: User[]) {
        const result = []
        for (let user of users) {
            const tournaments = await db.select()
            .from(tournamentParticipants)
            .where(and(
                eq(tournamentParticipants.userId, user.id),
                eq(tournamentParticipants.status, ParticipantStatus.CONFIRMED)
            ));
            const nominationCount = tournaments.map(tournament=>tournament.tournamentId)
            const tournamentsCount = [...new Set(nominationCount)].length
            result.push({
                ...user,
                tournamentsCount,
                nominationCount: nominationCount.length
            })
        }
        return result
    }
}