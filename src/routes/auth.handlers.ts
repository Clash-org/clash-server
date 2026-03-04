import { AuthService } from "../services/auth.service.js";
import { registerSchema, loginSchema } from "../schemas/auth.schema.js";

const authService = new AuthService();

export const authRoutes = {
  async register(body: unknown) {
    const input = registerSchema.parse(body);
    return await authService.register(input);
  },

  async login(body: unknown) {
    const input = loginSchema.parse(body);
    return await authService.login(input);
  },

  async refresh(refreshToken: string) {
    return await authService.refresh(refreshToken);
  },

  async me(token: string) {
    return await authService.validateToken(token);
  }
};