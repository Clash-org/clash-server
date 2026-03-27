/**
 * Clash Server - Tournament Management System
 * Copyright (C) 2026 Clash Contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

// Разрешённые origins (вынеси в константу)
const ALLOWED_ORIGINS = [
  "http://localhost:1420",  // Tauri
  "http://localhost:3001",  // React dev
  "http://localhost:5173",  // Vite
];

function getAllowOrigin(req: Request): string {
  const origin = req.headers.get("origin");
  return origin && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];
}

export function isPreflight(req: Request): boolean {
  return req.method === "OPTIONS";
}

export function preflightResponse(req: Request): Response {
  const allowOrigin = getAllowOrigin(req);

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": allowOrigin,  // ← не *
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true"
    },
  });
}

export function withCors(response: Response, req: Request): Response {
  const allowOrigin = getAllowOrigin(req);

  response.headers.set("Access-Control-Allow-Origin", allowOrigin);  // ← не *
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.headers.set("Access-Control-Allow-Credentials", "true");
  return response;
}

export function corsResponse(body: unknown, status: number = 200, req: Request): Response {
  const allowOrigin = getAllowOrigin(req);

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": allowOrigin,  // ← не *
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true"
    },
  });
}