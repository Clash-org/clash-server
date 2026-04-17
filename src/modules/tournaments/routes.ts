/**
 * Clash Server - Tournament Management System
 * Copyright (C) 2026 Clash Contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { tournamentHandlers } from "./handlers.js";
import { getToken, getTokenPayload } from "../../shared/utils/jwt.js";
import { nominationService, tournamentService, weaponService } from "./index.js";
import { getContract, parseContractError } from "../../shared/utils/helpers.js";
import addresses from "../../../blockchain/addresses.json"
import ServerABI from "../../../blockchain/abi/ClashServer.json"

export async function tournamentRouter(path: string, method: string, req: Request) {
  // ========== WEAPONS ==========
  if (path === "/weapons" && method === "GET") {
    try {
      const weapons = await tournamentHandlers.getAllWeapons();
      return Response.json(weapons, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  if (path === "/weapons" && method === "POST") {
    try {
      const token = getToken(req);
      if (!token) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      const payload = await getTokenPayload(token);
      if (!payload) return Response.json({ error: "Id is null" }, { status: 404 });
      const actorId = payload.sub;
      const body = await req.json();
      const weapon = await tournamentHandlers.createWeapon(body, actorId);
      return Response.json(JSON.stringify(weapon), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      return Response.json(JSON.stringify({ error: error.message }), { status: 400 });
    }
  }

  if (path === "/weapons" && method === "DELETE") {
    try {
      const token = getToken(req);
      if (!token) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      const payload = await getTokenPayload(token);
      if (!payload) return Response.json({ error: "Id is null" }, { status: 404 });
      const actorId = payload.sub;
      const { id } = await req.json();
      const res = await weaponService.delete(id, actorId);
      return Response.json(JSON.stringify(res));
    } catch (error: any) {
      return Response.json(JSON.stringify({ error: error.message }), { status: 400 });
    }
  }

  // ========== NOMINATIONS ==========
  if (path === "/nominations" && method === "GET") {
    try {
      const url = new URL(req.url)
      const lang = url.searchParams.get("lang");
      const nominations = await tournamentHandlers.getAllNominations(String(lang));
      return Response.json(nominations, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  if (path === "/nominations" && method === "POST") {
    try {
      const token = getToken(req);
      if (!token) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      const payload = await getTokenPayload(token);
      if (!payload) return Response.json({ error: "Id is null" }, { status: 404 });
      const actorId = payload.sub;
      const body = await req.json();
      const nomination = await tournamentHandlers.createNomination(body, actorId);
      return Response.json(JSON.stringify(nomination), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      return Response.json(JSON.stringify({ error: error.message }), { status: 400 });
    }
  }

  if (path === "/nominations" && method === "DELETE") {
    try {
      const token = getToken(req);
      if (!token) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      const payload = await getTokenPayload(token);
      if (!payload) return Response.json({ error: "Id is null" }, { status: 404 });
      const actorId = payload.sub;
      const { id } = await req.json();
      const res = await nominationService.delete(id, actorId);
      return Response.json(JSON.stringify(res));
    } catch (error: any) {
      return Response.json(JSON.stringify({ error: error.message }), { status: 400 });
    }
  }

  // ========== TOURNAMENTS ==========
  if (path === "/tournaments" && method === "GET") {
    try {
      const url = new URL(req.url)
      const lang = url.searchParams.get("lang") as string
      const short = Boolean(url.searchParams.get("short"))
      const page = Number(url.searchParams.get("page"))
      const pageSize = Number(url.searchParams.get("pageSize"))
      const ids = JSON.parse(url.searchParams.get("ids") || "[]")
      if (ids.length) {
        return Response.json(await tournamentService.getByIds(ids, lang));
      }
      return Response.json(await tournamentService.getAll(lang, short, page, pageSize))
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  if (path === "/tournaments" && method === "POST") {
    try {
      const token = getToken(req);
      if (!token) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      const payload = await getTokenPayload(token)
      if (!payload) {
        return Response.json({ error: "Id is null" }, { status: 404 });
      }
      const contract = getContract(addresses.Server, ServerABI)
      const { userWallet, ...other } = await req.json();
      if (!userWallet)
        return Response.json({ error: "I need to send you a wallet" }, { status: 404 });
      const payment = await contract.getUserLastPayment(userWallet);
      if (payment) {
        if (payment.refunded || new Date(Number(payment.expiresAt) * 1000) < new Date()) {
          return Response.json({ error: "You need to pay for this month" }, { status: 404 });
        }
      } else {
        return Response.json({ error: "You haven't paid for the server" }, { status: 404 });
      }
      const tournament = await tournamentHandlers.createTournament(other, payload.sub);
      return Response.json(tournament, { status: 201 });
    } catch (error: any) {
      const errorMessage = parseContractError(error)
      return Response.json({ error: errorMessage || error.message }, { status: 400 });
    }
  }

  if (path === "/tournaments" && method === "PUT") {
    try {
      const token = getToken(req);
      if (!token) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      const body = await req.json();
      const tournament = await tournamentHandlers.updateTournament(body);
      return Response.json(tournament, { status: 200 });
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 400 });
    }
  }

  if (path === "/tournaments/status" && method === "PATCH") {
    try {
      const token = getToken(req);
      if (!token) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      const body = await req.json();
      const tournament = await tournamentHandlers.updateTournamentStatus(body);
      return Response.json(tournament, { status: 200 });
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 400 });
    }
  }

  if (path === "/tournaments" && method === "DELETE") {
    try {
      const token = getToken(req);
      if (!token) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      const payload = await getTokenPayload(token);
      if (!payload) return Response.json({ error: "Id is null" }, { status: 404 });
      const actorId = payload.sub;
      const { tournamentId } = await req.json();
      const tournament = await tournamentService.deleteTournament(tournamentId, actorId);
      return Response.json(tournament, { status: 200 });
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 400 });
    }
  }

  if (path === "/tournaments/participants/info" && method === "POST") {
    try {
      const token = getToken(req);
      if (!token) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      const { lang, ...other } = await req.json();
      const info = await tournamentHandlers.addParticipantInfo(other, lang);
      return Response.json(info, { status: 201 });
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 400 });
    }
  }

  const participantCountMatch = path.match(/^\/tournaments\/participants\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
  if (participantCountMatch && method === "GET") {
    try {
      const token = getToken(req);
      if (!token) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      const id = String(participantCountMatch[1]);
      const lang = new URL(req.url).searchParams.get("lang") as string
      const tournaments = await tournamentService.getTournamentsByUserId(id, lang);
      return Response.json(tournaments);
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 400 });
    }
  }

  // GET /tournaments/:id
  const tournamentMatch = path.match(/^\/tournaments\/(\d+)$/);
  if (tournamentMatch && method === "GET") {
    try {
      const id = parseInt(tournamentMatch[1]);
      const lang = new URL(req.url).searchParams.get("lang") as string
      const tournament = await tournamentService.getById(id, lang);
      return Response.json(tournament, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 404 });
    }
  }

  // /tournaments/organizer/:id
  const organizerMatch = path.match(/^\/tournaments\/organizer\/(.+)$/);
  if (organizerMatch && method === "GET") {
    try {
      const id = String(organizerMatch[1]);
      const lang = new URL(req.url).searchParams.get("lang") as string
      const tournaments = await tournamentService.getByOrganizerId(id, lang);
      return Response.json(tournaments, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 404 });
    }
  }

  // ========== PARTICIPANTS ==========
  // GET /tournaments/:id/participants (узнать участников турнира по номинациям)
  const participantMatch = path.match(/^\/tournaments\/(\d+)\/participants$/);

  if (participantMatch && method === "GET") {
    try {
      const tournamentId = parseInt(participantMatch[1]);
      const url = new URL(req.url)
      const nominationIdsStr = url.searchParams.get("nominationIds")
      if (!nominationIdsStr) return Response.json({ error: "Nomination ids not found" }, { status: 400 })
      const nominationIds: number[] = JSON.parse(nominationIdsStr)
      const result = await tournamentHandlers.getParticipants(tournamentId, nominationIds);
      return Response.json(result, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 400 });
    }
  }

  // POST /tournaments/:id/participants (регистрация на турнир)
  if (participantMatch && method === "POST") {
    try {
      const token = getToken(req);
      if (!token) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      const payload = await getTokenPayload(token);
      if (!payload) return Response.json({ error: "Id is null" }, { status: 404 });
      const actorId = payload.sub;
      const tournamentId = parseInt(participantMatch[1]);
      const { nominationId } = await req.json();
      const result = await tournamentHandlers.addParticipant({ nominationId: Number(nominationId), tournamentId }, actorId);
      return Response.json(result, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 400 });
    }
  }

  // PATCH /tournaments/:id/participants/status (обновление статуса)
  const statusMatch = path.match(/^\/tournaments\/(\d+)\/participants\/status$/);
  if (statusMatch && method === "PATCH") {
    try {
      const token = getToken(req);
      if (!token) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      const tournamentId = parseInt(statusMatch[1]);
      const body = await req.json();
      const result = await tournamentHandlers.updateParticipantStatus(tournamentId, body);
      return Response.json(result, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 400 });
    }
  }

  // DELETE /tournaments/:id/participants/:userId (удаление участника)
  const removeMatch = path.match(/^\/tournaments\/(\d+)\/participants\/([^\/]+)$/);
  if (removeMatch && method === "DELETE") {
    try {
      const token = getToken(req);
      if (!token) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      const payload = await getTokenPayload(token);
      if (!payload) return Response.json({ error: "Id is null" }, { status: 404 });
      const actorId = payload.sub;
      const tournamentId = parseInt(removeMatch[1]);
      const userId = removeMatch[2];
      const { nominationId } = req.body
      const result = await tournamentHandlers.removeParticipant(actorId, userId, tournamentId, nominationId);
      return Response.json(result, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 403 });
    }
  }

  // GET /tournaments/:id/participants/info (узнать информацию участников)
  const participantsInfoMatch = path.match(/^\/tournaments\/(\d+)\/participants\/info$/);
  if (participantsInfoMatch && method === "GET") {
    try {
      const token = getToken(req);
      if (!token) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      const lang = new URL(req.url).searchParams.get("lang") as string
      const info = await tournamentHandlers.getParticipantsInfo(parseInt(participantsInfoMatch[1]), lang);
      return Response.json(info, { status: 200 });
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 400 });
    }
  }

  const poolMatch = path.match(/^\/tournaments\/(\d+)\/pool$/);

  if (poolMatch && method === "GET") {
    try {
      const token = getToken(req);
      if (!token) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      const payload = await getTokenPayload(token);
      if (!payload) return Response.json({ error: "Id is null" }, { status: 404 });
      const actorId = payload.sub;
      const tournamentId = parseInt(poolMatch[1])
      const pools = await tournamentService.getPools(tournamentId, actorId)
      return Response.json(pools, { status: 201 });
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 400 });
    }
  }

  if (poolMatch && method === "POST") {
    try {
      const token = getToken(req);
      if (!token) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      const tournamentId = parseInt(poolMatch[1])
      const body = await req.json();
      const res = await tournamentHandlers.createPool({ ...body, tournamentId})
      return Response.json(res, { status: 201 });
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 400 });
    }
  }

  if (path === "/tournaments/pool" && method === "PUT") {
    try {
      const token = getToken(req);
      if (!token) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      const { poolId, ...other } = await req.json();
      const res = await tournamentHandlers.updatePool(poolId, other)
      return Response.json(res, { status: 201 });
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 400 });
    }
  }

  if (path === "/tournaments/pool" && method === "PATCH") {
    try {
      const token = getToken(req);
      if (!token) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      const { poolId, isEnd } = await req.json();
      const res = await tournamentService.updatePoolEnd(poolId, Boolean(isEnd))
      return Response.json(res, { status: 201 });
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 400 });
    }
  }

  // Не нашли подходящий роут
  return null;
}