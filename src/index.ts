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
import { specialRouter } from "./modules/specials/routes.js";
import { streamsWebSocket } from "./modules/streams/websocket.js";
import { streamsManager } from "./modules/streams/streamManager.js";

const PORT = parseInt(process.env.PORT || "3000");

await seedDatabase();
await ratingService.initialize()
initUsersModule()
initTournamentsModule()
initRatingsModule()

const server = Bun.serve({
  hostname: "0.0.0.0",
  port: PORT,
  maxRequestBodySize: 1024 * 1024 * 10,

  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // WebSocket upgrade для стримов - ИСПОЛЬЗУЕМ НАТИВНЫЙ API BUN
    if (path === '/ws') {
      // Проверяем заголовок upgrade
      const upgrade = req.headers.get('upgrade');
      if (upgrade === 'websocket') {
        // Выполняем upgrade - Bun обработает все автоматически
        const upgraded = server.upgrade(req);
        if (upgraded) {
          // Возвращаем undefined, чтобы Bun отправил 101 Switching Protocols
          return;
        }
        return new Response("WebSocket upgrade failed", { status: 500 });
      }
    }

    // Preflight OPTIONS запрос
    if (isPreflight(req)) return preflightResponse(req);

    const routers = [
      specialRouter,
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
  // WebSocket конфигурация - ИСПОЛЬЗУЕМ НАТИВНЫЙ API BUN
  websocket: streamsWebSocket,
});

// Сохраняем экземпляр сервера в streamsManager для publish
streamsManager.setServer(server);
setInterval(() => {
  streamsManager.cleanupDeadConnections();
}, 30000);

console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);