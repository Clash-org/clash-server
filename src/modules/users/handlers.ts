/**
 * Clash Server - Tournament Management System
 * Copyright (C) 2026 Clash Contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { authService, cityService, clubService, userService } from "./index.js";
import { registerSchema, loginSchema, clubSchema, citySchema, userUpdateSchema } from "./validation.js";

export const authHandlers = {
  async register(body: unknown, lang: string) {
    const input = registerSchema.parse(body);
    return await authService.register(input, lang);
  },

  async login(body: unknown, lang: string) {
    const input = loginSchema.parse(body);
    return await authService.login(input, lang);
  },

  async refresh(refreshToken: string) {
    return await authService.refresh(refreshToken);
  },

  async me(token: string, lang: string) {
    return await authService.validateToken(token, lang);
  }
}

export const userHandlers = {
  async getByClubId(clubId: number) {
    return await userService.getByClubId(clubId)
  },

  async update(body: unknown, actorId: string, lang: string) {
    const { id, ...other } = userUpdateSchema.parse(body)
    return await userService.update(id, other, actorId, lang)
  }
}

export const clubHandlers = {
  async getAll() {
    return await clubService.getAll();
  },

  async getById(id: number) {
    const club = await clubService.getById(id);
    return club;
  },

  async create(body: unknown) {
    const input = clubSchema.parse(body);
    return await clubService.create(input.title);
  },

  async delete(id: number) {
    return await clubService.delete(id);
  }
};

export const cityHandlers = {
  async getAll(lang: string) {
    return await cityService.getAll(lang);
  },

  async getById(id: number) {
    const city = await cityService.getById(id);
    return city;
  },

  async create(body: unknown) {
    const input = citySchema.parse(body);
    return await cityService.create(input.title);
  },

  async delete(id: number) {
    return await cityService.delete(id);
  }
};