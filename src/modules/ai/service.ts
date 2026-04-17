/**
 * Clash Server - Tournament Management System
 * Copyright (C) 2026 Clash Contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export type Translations = {
  en: string;
  ru: string;
  zh: string;
};

export class AiService {
  private ollamaUrl: string;
  private model: string;

  constructor(options?: {
    ollamaUrl?: string;
    model?: string;
    baseDir?: string;
  }) {
    this.ollamaUrl = options?.ollamaUrl || process.env.OLLAMA_URL || "http://localhost:11434";
    this.model = options?.model || process.env.OLLAMA_MODEL || "qwen2.5:1.5b";
  }

  /**
   * Перевод одного города
   */
  async translateCity(cityName: string): Promise<Translations> {
    return await this.translate(cityName, "If this is an abbreviation, then translate it taking into account the generally accepted name of the city.")
  }

  private async fetcher(prompt: string) {
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          prompt: prompt,
          stream: false,
          format: "json",
          options: {
            temperature: 0.1,
            num_predict: 100,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.status}`);
      }

      return await response.json()
  }

  private async translate(value: string, postfix=""): Promise<Translations> {
    const prompt = `
This value: "${value}"
Provide translations in 3 languages. Reply ONLY in this exact JSON format without any other text:
{"en":"English name","ru":"Russian name","zh":"中文名称"}.` + postfix
    try {
      const data = await this.fetcher(prompt);
      const parsed: Partial<Translations> = JSON.parse(data.response.trim());

      return {
        en: parsed.en || value,
        ru: parsed.ru || value,
        zh: parsed.zh || value,
      };
    } catch (error) {
      console.error(`Translation failed for "${value}":`, error);
      return {
        en: value,
        ru: value,
        zh: value,
      };
    }
  }

  /**
   * Пакетный перевод нескольких городов
   */
  async translateCities(cities: string[]): Promise<Map<string, Translations>> {
    const results = new Map<string, Translations>();

    for (const city of cities) {
      const translation = await this.translateCity(city);
      results.set(city, translation);

      // Небольшая задержка, чтобы не перегружать API
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return results;
  }

  async translateValue(value: string) {
    return await this.translate(value)
  }
}