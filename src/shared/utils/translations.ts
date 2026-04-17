/**
 * Clash Server - Tournament Management System
 * Copyright (C) 2026 Clash Contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { eq } from "drizzle-orm";
import { db } from "../db/postgres";
import { nominations, nominationsCN, nominationsRU, weapons, weaponsCN, weaponsRU } from "../../modules/tournaments/schema";
import { cities, citiesCN, citiesRU } from "../../modules/users/schema";

// lang: 'ru' | 'zh'
export async function translateNomination(lang: string, nomination: string, id?: number) {
    return await translate(nominationsRU, nominationsCN, nominations, lang, nomination, id)
}

export async function translateWeapon(lang: string, weapon: string, id?: number) {
    return await translate(weaponsRU, weaponsCN, weapons, lang, weapon, id)
}

export async function reverseTranslateWeapon(lang: string, weapon: string) {
    return await translateReverse(weaponsRU, weaponsCN, weapons, lang, weapon)
}

export async function translateCity(lang: string, city: string, id?: number) {
    return await translate(citiesRU, citiesCN, cities, lang, city, id)
}

export async function getTranslateValue(tableTranslate: any, tableOrigin: any, value: string, id?: number): Promise<string> {
  try {
    let originId: number
    if (id) {
      originId = id
    } else {
      const [enValue] = await db.select().from(tableOrigin).where(eq(tableOrigin.title, value))
      originId = enValue.id
    }
    const [translates] = await db.select().from(tableTranslate).where(eq(tableTranslate.id, originId))
    return translates.title
  } catch {
    return value
  }
}

export async function translate(tableTranslateRU: any, tableTranslateCN: any, tableOrigin: any, lang: string, value: string, id?: number) {
    if (lang === "en") return value

    if (lang === "ru") {
      return await getTranslateValue(tableTranslateRU, tableOrigin, value, id)
    }

    if (lang === "zh") {
      return await getTranslateValue(tableTranslateCN, tableOrigin, value, id)
    }

    return value
}

export async function translateReverse(tableTranslateRU: any, tableTranslateCN: any, tableOrigin: any, lang: string, value: string) {
    if (lang === "en") return value

    if (lang === "ru") {
      return await getTranslateValue(tableOrigin, tableTranslateRU, value)
    }

    if (lang === "zh") {
      return await getTranslateValue(tableOrigin, tableTranslateCN, value)
    }

    return value
}