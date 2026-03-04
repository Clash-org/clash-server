import { authRoutes } from "./auth.handlers";

export async function authRouter(path: string, method: string, req: Request) {
  // ========== AUTH ROUTES ==========
  if (path === "/auth/register" && method === "POST") {
    try {
      const body = await req.json();
      const result = await authRoutes.register(body);
      return Response.json(result, { status: 201 });
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 400 });
    }
  }

  if (path === "/auth/login" && method === "POST") {
    try {
      const body = await req.json();
      const result = await authRoutes.login(body);
      return Response.json(result);
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 401 });
    }
  }

  if (path === "/auth/refresh" && method === "POST") {
    try {
      const { refreshToken } = await req.json();
      const result = await authRoutes.refresh(refreshToken);
      return Response.json(result);
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 401 });
    }
  }

  if (path === "/auth/me" && method === "GET") {
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = auth.slice(7);
    const user = await authRoutes.me(token);

    if (!user) {
      return Response.json({ error: "Invalid token" }, { status: 401 });
    }

    return Response.json(user);
  }

  // Не нашли подходящий роут
  return null;
}