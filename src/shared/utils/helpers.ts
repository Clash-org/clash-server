/**
 * Clash Server - Tournament Management System
 * Copyright (C) 2026 Clash Contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { eq } from "drizzle-orm";
import { db } from "../db/postgres";
import { users } from "../../modules/users/schema";
import { ethers } from "ethers";

/**
 * Проверка является ли пользователь админом
 */
export async function isAdmin(userId: string, byEmail=false) {
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
    });
    if (!user) return false
    if (byEmail) return user.email === Bun.env.ADMIN_EMAIL
    return user.isAdmin || user.email === Bun.env.ADMIN_EMAIL
}

export function removeEmptyFields(obj: any): any {
  const result = { ...obj };
  Object.keys(result).forEach(key => {
    const value = result[key];
    if (
      value === null ||
      value === undefined ||
      value === '' ||
      (Array.isArray(value) && value.length === 0)
    ) {
      delete result[key];
    }
  });
  return result;
}

export function getContract(address: string, abi: any[]) {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://172.17.144.1:8545');
  const wallet = new ethers.Wallet(process.env.CRYPTO_PRIVATE_KEY!, provider);
  return new ethers.Contract(address, abi, wallet);
}

export function parseContractError(error: any): string {
  // Вариант 1: error.message содержит текст
  if (error.message) {
    // Извлекаем reason из revert
    const reasonMatch = error.message.match(/reason="([^"]+)"/);
    if (reasonMatch) {
      return reasonMatch[1];
    }

    // Или напрямую message
    return error.message;
  }

  // Вариант 2: error.reason
  if (error.reason) {
    return error.reason;
  }

  // Вариант 3: error.data
  if (error.data) {
    return error.data;
  }

  return "";
}