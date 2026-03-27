/**
 * Clash Server - Tournament Management System
 * Copyright (C) 2026 Clash Contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { seedDatabase } from "./shared/db/seed.js";
import { authRouter, userRouter, cityRouter, clubRouter } from "./modules/users/routes.js";
import { ratingRouter } from "./modules/ratings/routes.js";
import { tournamentRouter } from "./modules/tournaments/routes.js";
import { translateRouter } from "./modules/ai/routes.js";
import { uploadRouter } from "./modules/upload/routes.js";
import { withCors, corsResponse, isPreflight, preflightResponse } from "./shared/utils/cors.js";
import { initUsersModule } from "./modules/users/index.js";
import { initTournamentsModule } from "./modules/tournaments/index.js";
import { initRatingsModule, ratingService } from "./modules/ratings/index.js";

const PORT = parseInt(process.env.PORT || "3000");

await seedDatabase();
await ratingService.initialize()
initUsersModule()
initTournamentsModule()
initRatingsModule()

const server = Bun.serve({
  port: PORT,
  maxRequestBodySize: 1024 * 1024 * 10,

  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // Preflight OPTIONS запрос
    if (isPreflight(req)) return preflightResponse(req);

    // Health check
    if (path === "/health" && method === "GET") {
      return corsResponse({ status: "ok" }, 200, req);
    }

    const routers = [
      authRouter,
      userRouter,
      cityRouter,
      clubRouter,
      tournamentRouter,
      uploadRouter,
      translateRouter,
      ratingRouter
    ];

    for (const router of routers) {
      const result = await router(path, method, req);
      if (result) return withCors(result, req);
    }

    // 404
    return corsResponse({ error: "Not found" }, 404, req);
  },
});

console.log(`🚀 Server running at http://localhost:${PORT}`);