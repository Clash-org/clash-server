/**
 * Clash Server - Tournament Management System
 * Copyright (C) 2026 Clash Contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { authHandlers, cityHandlers, clubHandlers, userHandlers } from "./handlers";
import { getToken, getTokenPayload } from "../../shared/utils/jwt";
import { COOKIE_OPTIONS, parseCookies, serializeCookie } from "../../shared/utils/cookies";
import { aiService } from "../ai";
import { clubService, cityService, userService } from "./index";

export async function authRouter(path: string, method: string, req: Request) {
  // ========== AUTH ROUTES ==========
  if (path === "/auth/register" && method === "POST") {
    try {
      const body = await req.json();
      const { cityName, clubName, lang, ...other } = body
      let newCityId: number = NaN;
      let newClubId: number = NaN;
      if (cityName && other.cityId === null) {
        newCityId = (await cityService.create(cityName)).id
      }

      if (clubName && other.clubId === null) {
        newClubId = (await clubService.create(clubName)).id
      }

      const result = await authHandlers.register({
        ...other,
        cityId: other.cityId === null ? newCityId : other.cityId,
        clubId: other.clubId === null ? newClubId : other.clubId
      }, lang);
      return Response.json(result, { status: 201 });
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 400 });
    }
  }

  if (path === "/auth/login" && method === "POST") {
    try {
      const body = await req.json();
      const { lang, ...other } = body
      const result = await authHandlers.login(other, lang);
      return Response.json({
        accessToken: result.accessToken,
        user: result.user
      }, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": serializeCookie("refreshToken", result.refreshToken)
      },
      });
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 401 });
    }
  }

  if (path === "/auth/refresh" && method === "POST") {
    try {
      const cookies = parseCookies(req.headers.get("cookie") || "");
      const refreshToken = cookies.refreshToken;
      if (!refreshToken) {
        return new Response(JSON.stringify({ error: "No refresh token" }), {
          status: 401
        });
      }
      const result = await authHandlers.refresh(refreshToken);
      return Response.json({
        accessToken: result.accessToken
      }, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": serializeCookie("refreshToken", result.refreshToken)
        }
      });
    } catch (error: any) {
      // Чистим протухший cookie
      return new Response(
        JSON.stringify({ error: "Invalid refresh token" }),
        {
          status: 401,
          headers: {
            "Set-Cookie": serializeCookie("refreshToken", "", { ...COOKIE_OPTIONS, maxAge: 0 })
          },
        }
      );
    }
  }

  if (path === "/auth/logout" && method === "POST") {
    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: {
          // Чистим cookie
          "Set-Cookie": serializeCookie("refreshToken", "", { ...COOKIE_OPTIONS, maxAge: 0 })
        },
      }
    );
  }

  if (path === "/auth/me" && method === "GET") {
    const token = getToken(req)
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    const lang = String(new URL(req.url).searchParams.get("lang"))
    const user = await authHandlers.me(token, lang);

    if (!user) {
      return Response.json({ error: "Invalid token" }, { status: 401 });
    }

    return Response.json(user);
  }

  // Не нашли подходящий роут
  return null;
}

export async function userRouter(path: string, method: string, req: Request) {
  const userClubMatch = path.match(/^\/users\/club\/(\d+)$/);
  if (userClubMatch && method === "GET") {
    try {
      const id = Number(userClubMatch[1]);
      const users = await userHandlers.getByClubId(id)
      return Response.json(users, { status: 200 })
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 404 });
    }
  }

  const userMatch = path.match(/^\/users\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);

  if (userMatch && method === "GET") {
    try {
      const id = String(userMatch[1]);
      const users = await userService.getById(id)
      return Response.json(users, { status: 200 })
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 404 });
    }
  }

  if (path === "/users" && method === "GET") {
    try {
      const lang = String(new URL(req.url).searchParams.get("lang"))
      const page = Number(new URL(req.url).searchParams.get("page"))
      const pageSize = Number(new URL(req.url).searchParams.get("pageSize"))
      const res = await userService.getAll(page, pageSize, lang)
      return Response.json(res, { status: 200 })
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 404 });
    }
  }

  if (path === "/users" && method === "PUT") {
    try {
      const token = getToken(req)
      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }
      const payload = await getTokenPayload(token);
      if (!payload) return Response.json({ error: "Id is null" }, { status: 404 });
      const actorId = payload.sub;
      const lang = String(new URL(req.url).searchParams.get("lang"))
      const body = await req.json();
      const user = await userHandlers.update(body, actorId, lang)
      return Response.json(user)
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 404 });
    }
  }

  if (path === "/users" && method === "DELETE") {
    try {
      const token = getToken(req)
      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }
      const payload = await getTokenPayload(token);
      if (!payload) return Response.json({ error: "Id is null" }, { status: 404 });
      const actorId = payload.sub;
      const { id } = await req.json();
      const res = await userService.delete(id, actorId)
      return Response.json(res)
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 404 });
    }
  }

  return null;
}

export async function clubRouter(path: string, method: string, req: Request) {
  // ========== clubs ROUTES ==========
  if (path === "/clubs" && method === "GET") {
    try {
      const clubs = await clubService.getAll();
      return Response.json(clubs);
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  if (path === "/clubs" && method === "POST") {
    try {
      const body = await req.json();
      const club = await clubHandlers.create(body);
      return Response.json(club, { status: 201 });
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 400 });
    }
  }

  // GET /clubs/:id или DELETE /clubs/:id
  const clubMatch = path.match(/^\/clubs\/(\d+)$/);
  if (clubMatch && method === "GET") {
    try {
      const id = parseInt(clubMatch[1]);
      const club = await clubService.getById(id);
      return Response.json(club);
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 404 });
    }
  }

  if (clubMatch && method === "DELETE") {
    try {
      const token = getToken(req)
      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }
      const id = parseInt(clubMatch[1]);
      await clubService.delete(id);
      return Response.json({ success: true });
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 404 });
    }
  }

  // Не нашли подходящий роут
  return null;
}

export async function cityRouter(path: string, method: string, req: Request) {
  // ========== CITIES ROUTES ==========
  if (path === "/cities" && method === "GET") {
    try {
      const url = new URL(req.url)
      const lang = url.searchParams.get("lang");
      const cities = await cityService.getAll(String(lang));
      return Response.json(cities);
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  if (path === "/cities" && method === "POST") {
    try {
      const body = await req.json();
      const city = await cityHandlers.create(body);
      return Response.json(city, { status: 201 });
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 400 });
    }
  }

  if (path === "/cities" && method === "PATCH") {
    try {
      const { lang, ...other } = await req.json();
      const res = await cityHandlers.update(other, lang);
      return Response.json(res);
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 400 });
    }
  }

  // GET /cities/:id или DELETE /cities/:id
  const cityMatch = path.match(/^\/cities\/(\d+)$/);
  if (cityMatch && method === "GET") {
    try {
      const id = parseInt(cityMatch[1]);
      const city = await cityService.getById(id);
      return Response.json(city);
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 404 });
    }
  }

  if (cityMatch && method === "DELETE") {
    try {
      const token = getToken(req)
      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      }
      const payload = await getTokenPayload(token);
      if (!payload) return Response.json({ error: "Id is null" }, { status: 404 });
      const actorId = payload.sub;
      const id = parseInt(cityMatch[1]);
      await cityService.delete(id, actorId);
      return Response.json({ success: true });
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 404 });
    }
  }

  // Не нашли подходящий роут
  return null;
}