import { seedCities } from "./db/seed.js";
import { authRouter } from "./routes/auth.routes.js";
import { cityRouter } from "./routes/city.routes.js";
import { withCors, corsResponse, isPreflight, preflightResponse } from "./utils/cors.js";

const PORT = parseInt(process.env.PORT || "3000");

await seedCities();

const server = Bun.serve({
  port: PORT,

  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // Preflight OPTIONS запрос
    if (isPreflight(req)) return preflightResponse();

    // Health check
    if (path === "/health" && method === "GET") {
      return corsResponse({ status: "ok" });
    }

    // Пробуем auth роуты
    const authResult = await authRouter(path, method, req);
    if (authResult) {
      return withCors(authResult);
    }

    // Пробуем city роуты
    const cityResult = await cityRouter(path, method, req);
    if (cityResult) {
      return withCors(cityResult);
    }

    // 404
    return corsResponse({ error: "Not found" }, 404);
  },
});

console.log(`🚀 Server running at http://localhost:${PORT}`);