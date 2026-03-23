import { eq } from "drizzle-orm";
import { db } from "../db/postgres";
import { users } from "../../modules/users/schema";

/**
 * Проверка является ли пользователь админом
 */
export async function isAdmin(userId: string) {
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
    });
    if (!user) return false
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