import { SignJWT, jwtVerify, JWTPayload } from "jose";

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-32-byte-secret-key-here!!".padEnd(32, '!')
);

export interface TokenPayload extends JWTPayload {
  sub: string; // user id
  email: string;
  type: "access" | "refresh";
}

export async function generateTokens(
  userId: string,
  email: string
): Promise<{ accessToken: string; refreshToken: string }> {

  // Access token - 30 minutes
  const accessToken = await new SignJWT({
    sub: userId,
    email,
    type: "access",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(SECRET_KEY);

  // Refresh token - 7 days
  const refreshToken = await new SignJWT({
    sub: userId,
    email,
    type: "refresh",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET_KEY);

  return { accessToken, refreshToken };
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload as TokenPayload;
  } catch {
    return null;
  }
}

export async function getTokenPayload(token: string) {
    const payload = await verifyToken(token);

    if (!payload || payload.type !== "access") {
      return null
    }

    return payload
}

export function getToken(req: Request): string|null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null
  }
  return authHeader.slice(7);
}