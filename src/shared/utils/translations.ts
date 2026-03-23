import { eq } from "drizzle-orm";
import { cityService } from "../../modules/users";
import { db } from "../db/postgres";
import { nominations, nominationsCN, nominationsRU, weapons, weaponsCN, weaponsRU } from "../../modules/tournaments/schema";
import { cities, citiesCN, citiesRU } from "../../modules/users/schema";

// lang: 'ru' | 'cn'
export async function translateNomination(lang: string, nomination: string) {
    return await translate(nominationsRU, nominationsCN, nominations, lang, nomination)
}

export async function translateWeapon(lang: string, weapon: string) {
    return await translate(weaponsRU, weaponsCN, weapons, lang, weapon)
}

export async function reverseTranslateWeapon(lang: string, weapon: string) {
    return await translateReverse(weaponsRU, weaponsCN, weapons, lang, weapon)
}

export async function translateCity(lang: string, city: string) {
    return await translate(citiesRU, citiesCN, cities, lang, city)
}

export async function getTranslateValue(tableTranslate: any, tableOrigin: any, value: string): Promise<string> {
  try {
    const translates = await db.select().from(tableTranslate)
    const [enValue] = await db.select().from(tableOrigin).where(eq(tableOrigin.title, value))
    return translates[enValue.id - 1].title
  } catch {
    return value
  }
}

export async function translate(tableTranslateRU: any, tableTranslateCN: any, tableOrigin: any, lang: string, value: string) {
    if (lang === "en") return value

    if (lang === "ru") {
      return await getTranslateValue(tableTranslateRU, tableOrigin, value)
    }

    if (lang === "cn") {
      return await getTranslateValue(tableTranslateCN, tableOrigin, value)
    }

    return value
}

export async function translateReverse(tableTranslateRU: any, tableTranslateCN: any, tableOrigin: any, lang: string, value: string) {
    if (lang === "en") return value

    if (lang === "ru") {
      return await getTranslateValue(tableOrigin, tableTranslateRU, value)
    }

    if (lang === "cn") {
      return await getTranslateValue(tableOrigin, tableTranslateCN, value)
    }

    return value
}