/**
 * Clash Server - Tournament Management System
 * Copyright (C) 2026 Clash Contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { aiService } from "./index.js";

export async function translateRouter(path: string, method: string, req: Request) {
  // POST /translate/city
  if (path === "/translate/city" && method === "POST") {
    try {
      const body = await req.json();
      const { cityName } = body;

      if (!cityName) {
        return Response.json({ error: "cityName required" }, 400);
      }

      const translations = await aiService.translateCity(cityName);
      return Response.json({
        original: cityName,
        translations: {
          en: { [cityName]: translations.en },
          ru: { [cityName]: translations.ru },
          cn: { [cityName]: translations.cn },
        },
      });

    } catch (error: any) {
      return Response.json({ error: error.message }, 500);
    }
  }

  // POST /translate/cities (пакетный перевод)
  if (path === "/translate/cities" && method === "POST") {
    try {
      const body = await req.json();
      const { cities } = body;

      if (!Array.isArray(cities)) {
        return Response.json({ error: "cities array required" }, 400);
      }

      const allTranslations = await aiService.translateCities(cities);

      // Форматируем ответ в нужную структуру
      const formatted = {
        en: {} as Record<string, string>,
        ru: {} as Record<string, string>,
        zh: {} as Record<string, string>,
      };

      for (const [original, trans] of Object.entries(allTranslations)) {
        formatted.en[original] = trans.en;
        formatted.ru[original] = trans.ru;
        formatted.zh[original] = trans.zh;
      }

      return Response.json({
        translations: formatted,
      });

    } catch (error: any) {
      return Response.json({ error: error.message }, 500);
    }
  }

  return null;
}