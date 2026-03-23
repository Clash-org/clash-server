import { nominationService, tournamentService, weaponService } from "./index.js";
import {
  weaponSchema,
  nominationSchema,
  tournamentSchema,
  tournamentParticipantSchema,
  tournamentSchemaWithId,
  tournamentStatusWithIdSchema,
  tournamentAddParticipantSchema,
  tournamentAddParticipantInfoSchema,
  poolSchema,
} from "./validation.js";

export const tournamentHandlers = {
  // ========== WEAPONS ==========
  async getAllWeapons() {
    return await weaponService.getAll();
  },

  async createWeapon(body: unknown) {
    const input = weaponSchema.parse(body);
    return await weaponService.create(input.title);
  },

  // ========== NOMINATIONS ==========
  async getAllNominations(lang: string) {
    return await nominationService.getAll(lang);
  },

  async createNomination(body: unknown) {
    const input = nominationSchema.parse(body);
    return await nominationService.create(input.title, input.weaponId);
  },

  // ========== TOURNAMENTS ==========
  async getAllTournaments(lang: string, short: boolean, page: number) {
    return await tournamentService.getAll(lang, short, page);
  },

  async getByOrganizerId(id: string, lang: string) {
    return await tournamentService.getByOrganizerId(id, lang)
  },

  async getTournamentById(id: number, lang: string) {
    return await tournamentService.getById(id, lang);
  },

  async createTournament(body: unknown, organizerId: string) {
    const input = tournamentSchema.parse(body);
    return await tournamentService.create({
      ...input,
      organizerId,
      date: new Date(input.date)
    });
  },

  async updateTournament(body: unknown) {
    const input = tournamentSchemaWithId.parse(body);
    return await tournamentService.update({
      ...input,
      date: new Date(input.date)
    });
  },

  async updateTournamentStatus(body: unknown) {
    const input = tournamentStatusWithIdSchema.parse(body);
    return await tournamentService.updateStatus(input);
  },

  // ========== PARTICIPANTS ==========
  async getParticipants(tournamentId: number, nominationIds: number[]) {
    return await tournamentService.getTournamentUsers(tournamentId, nominationIds)
  },

  async addParticipant(body: unknown, actorId: string) {
    const input = tournamentAddParticipantSchema.parse(body)
    return await tournamentService.addUserToTournament(actorId, input.tournamentId, input.nominationId);
  },

  async updateParticipantStatus(tournamentId: number, body: unknown) {
    const input = tournamentParticipantSchema.parse({ tournamentId, ...body });
    return await tournamentService.updateUserTournamentStatus(input.tournamentId, input.nominationId, input.userId, input.status);
  },

  async removeParticipant(actorId: string, userId: string, tournamentId: number, nominationId: number) {
    return await tournamentService.deleteUserFromTournament(actorId, userId, tournamentId, nominationId);
  },

  async addParticipantInfo(body: unknown, lang: string) {
    const input = tournamentAddParticipantInfoSchema.parse(body)
    return await tournamentService.addParticipantInfo(input.tournamentId, input.userId, input.info, lang)
  },

  async getParticipantsInfo(tournamentId: number, lang: string) {
    return await tournamentService.getParticipantInfo(tournamentId, lang)
  },

  async createPool(body: unknown) {
    const input = poolSchema.parse(body)
    return await tournamentService.createPool(input)
  },

  async updatePool(poolId: number, body: unknown) {
    const input = poolSchema.parse(body)
    return await tournamentService.updatePool(poolId, input)
  }
};