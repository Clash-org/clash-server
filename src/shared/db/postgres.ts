/**
 * Clash Server - Tournament Management System
 * Copyright (C) 2026 Clash Contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as  userSchema from "../../modules/users/schema"
import * as  tournamentsSchema from "../../modules/tournaments/schema"
import * as  ratingsSchema from "../../modules/ratings/schema"

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "clash_db",
});

export const db = drizzle(pool, { schema: { ...userSchema, ...tournamentsSchema, ...ratingsSchema } });
export { pool };