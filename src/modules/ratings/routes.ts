
import { ratingHandlers } from "./handlers.js";
import { getToken } from "../../shared/utils/jwt.js"

export async function ratingRouter(path: string, method: string, req: Request) {
  // ========== LEADERBOARD ROUTES ==========
  // GET /ratings/leaderboard?weaponId=1&nominationId=2&limit=100
  if (path === "/ratings/leaderboard" && method === "GET") {
    try {
      const url = new URL(req.url);
      const weaponId = parseInt(url.searchParams.get("weaponId") || "0");
      const nominationId = parseInt(url.searchParams.get("nominationId") || "0");
      const limit = parseInt(url.searchParams.get("limit") || "100");

      if (!weaponId || !nominationId) {
        return Response.json(
          { error: "weaponId and nominationId are required" },
          { status: 400 }
        );
      }

      const leaderboard = await ratingHandlers.getLeaderboard(
        weaponId,
        nominationId,
        limit
      );
      return Response.json(leaderboard);
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  // ========== USER RATING HISTORY ==========
  // GET /ratings/history/:userId?weaponId=1&nominationId=2
  const historyMatch = path.match(/^\/ratings\/history\/([a-f0-9-]+)$/);
  if (historyMatch && method === "GET") {
    try {
      const token = getToken(req);
      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }
      const userId = historyMatch[1];
      const url = new URL(req.url);
      const weaponId = parseInt(url.searchParams.get("weaponId") || "0");
      const nominationId = parseInt(url.searchParams.get("nominationId") || "0");

      if (!weaponId || !nominationId) {
        return Response.json(
          { error: "weaponId and nominationId are required" },
          { status: 400 }
        );
      }

      const history = await ratingHandlers.getUserHistory(
        token,
        userId,
        weaponId,
        nominationId
      );
      return Response.json(history);
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  // ========== USER STATS ==========
  // GET /ratings/user/:userId
  const userStatsMatch = path.match(/^\/ratings\/user\/([a-f0-9-]+)$/);
  if (userStatsMatch && method === "GET") {
    try {
      const userId = userStatsMatch[1];
      const stats = await ratingHandlers.getUserStats(userId);
      return Response.json(stats);
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 404 });
    }
  }

  // ========== PROCESS TOURNAMENT ==========
  // POST /ratings/process-tournament
  if (path === "/ratings/process-tournament" && method === "POST") {
    try {
      const token = getToken(req)
      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }
      const body = await req.json();
      const result = await ratingHandlers.processTournament(token, body);
      return Response.json(result, { status: 200 });
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 400 });
    }
  }

  // ========== PREDICT MATCH ==========
  // POST /ratings/predict
  if (path === "/ratings/predict" && method === "POST") {
    try {
      const body = await req.json();
      const prediction = await ratingHandlers.predictMatch(body);
      return Response.json(prediction);
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 400 });
    }
  }

  // ========== SYSTEM SNAPSHOTS ==========
  // POST /ratings/snapshot (admin only)
  if (path === "/ratings/snapshot" && method === "POST") {
    try {
      const token = getToken(req)
      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }
      const { note } = await req.json();
      const snapshot = await ratingHandlers.createSnapshot(token, note);
      return Response.json(snapshot, { status: 201 });
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  // GET /ratings/snapshots
  if (path === "/ratings/snapshots" && method === "GET") {
    try {
      const snapshots = await ratingHandlers.getSnapshots();
      return Response.json(snapshots);
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  // ========== WEAPONS & NOMINATIONS ==========
  // GET /ratings/weapons
  if (path === "/ratings/weapons" && method === "GET") {
    try {
      const weapons = await ratingHandlers.getWeapons();
      return Response.json(weapons);
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  // GET /ratings/nominations
  if (path === "/ratings/nominations" && method === "GET") {
    try {
      const nominations = await ratingHandlers.getNominations();
      return Response.json(nominations);
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  if (path === "/match" && method === "GET") {
    try {
      const tournamentId = parseInt(String(new URL(req.url).searchParams.get("tournamentId")));
      const nominationId = parseInt(String(new URL(req.url).searchParams.get("nominationId")));
      const matches = ratingHandlers.getMatches(tournamentId, nominationId)
      return Response.json(matches);
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  // Не нашли подходящий роут
  return null;
}