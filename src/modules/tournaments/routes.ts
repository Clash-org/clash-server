import { tournamentHandlers } from "./handlers.js";
import { getToken, getTokenPayload } from "../../shared/utils/jwt.js";
import { tournamentService } from "./index.js";

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
      const body = await req.json();
      const weapon = await tournamentHandlers.createWeapon(body);
      return Response.json(JSON.stringify(weapon), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
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
      const body = await req.json();
      const nomination = await tournamentHandlers.createNomination(body);
      return Response.json(JSON.stringify(nomination), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
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
      const ids = JSON.parse(url.searchParams.get("ids") || "[]")
      if (ids.length) {
        return Response.json(await tournamentService.getByIds(ids, lang));
      }
      return Response.json(await tournamentHandlers.getAllTournaments(lang, short, page))
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
      const body = await req.json();
      const tournament = await tournamentHandlers.createTournament(body, payload.sub);
      return Response.json(tournament, { status: 201 });
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 400 });
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

  // GET /tournaments/:id
  const tournamentMatch = path.match(/^\/tournaments\/(\d+)$/);
  if (tournamentMatch && method === "GET") {
    try {
      const id = parseInt(tournamentMatch[1]);
      const lang = new URL(req.url).searchParams.get("lang") as string
      const tournament = await tournamentHandlers.getTournamentById(id, lang);
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
      const tournaments = await tournamentHandlers.getByOrganizerId(id, lang);
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
      const nominationIdsStr = new URL(req.url).searchParams.get("nominationIds")
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

  // Не нашли подходящий роут
  return null;
}