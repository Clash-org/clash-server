import { cityRoutes } from "./city.handlers.js";

export async function cityRouter(path: string, method: string, req: Request) {
  // ========== CITIES ROUTES ==========
  if (path === "/cities" && method === "GET") {
    try {
      const cities = await cityRoutes.getAll();
      return Response.json(cities);
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  if (path === "/cities" && method === "POST") {
    try {
      const body = await req.json();
      const city = await cityRoutes.create(body);
      return Response.json(city, { status: 201 });
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 400 });
    }
  }

  // GET /cities/:id или DELETE /cities/:id
  const cityMatch = path.match(/^\/cities\/(\d+)$/);
  if (cityMatch && method === "GET") {
    try {
      const id = parseInt(cityMatch[1]);
      const city = await cityRoutes.getById(id);
      return Response.json(city);
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 404 });
    }
  }

  if (cityMatch && method === "DELETE") {
    try {
      const id = parseInt(cityMatch[1]);
      await cityRoutes.delete(id);
      return Response.json({ success: true });
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 404 });
    }
  }

  // Не нашли подходящий роут
  return null;
}