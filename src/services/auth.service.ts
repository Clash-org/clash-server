import { db } from "../db/postgres";
import { cities, users } from "../db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "../utils/password";
import { generateTokens, verifyToken } from "../utils/jwt";
import type { RegisterInput, LoginInput } from "../schemas/auth.schema";

export class AuthService {
  async register(input: RegisterInput & { cityId?: number }) {
    const city = await db.query.cities.findFirst({
        where: eq(cities.id, input.cityId),
    });
    if (!city) {
      throw new Error("City not found");
    }

    const existing = await db.query.users.findFirst({
      where: eq(users.email, input.email),
    });

    if (existing) {
      throw new Error("User with this email already exists");
    }

    const passwordHash = await hashPassword(input.password);
    const [user] = await db
      .insert(users)
      .values({
        email: input.email,
        username: input.username,
        passwordHash,
      })
      .returning();

    const tokens = await generateTokens(user.id, user.email);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        gender: user.gender,
        city: city.title,
        tournamentsIds: user.tournamentsIds,
        createdAt: user.createdAt.toISOString(),
      },
    };
  }

  async login(input: LoginInput) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, input.email),
    });

    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new Error("Invalid credentials");
    }

    const city = await db.query.cities.findFirst({
        where: eq(cities.id, user.cityId!),
    });

    const tokens = await generateTokens(user.id, user.email);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        city: city,
        gender: user.gender,
        username: user.username,
        tournamentsIds: user.tournamentsIds,
        createdAt: user.createdAt.toISOString()
      },
    };
  }

  async refresh(refreshToken: string) {
    const payload = await verifyToken(refreshToken);

    if (!payload || payload.type !== "refresh") {
      throw new Error("Invalid refresh token");
    }

    const tokens = await generateTokens(payload.sub, payload.email);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async validateToken(token: string) {
    const payload = await verifyToken(token);

    if (!payload || payload.type !== "access") {
      return null;
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.sub),
    });

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      createdAt: user.createdAt.toISOString(),
    };
  }
}