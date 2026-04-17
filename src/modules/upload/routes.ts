/**
 * Clash Server - Tournament Management System
 * Copyright (C) 2026 Clash Contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { fileURLToPath } from "node:url";
import { convertToWebP } from "../../shared/utils/image.js";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { getToken } from "../../shared/utils/jwt.js";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const UPLOAD_DIR = resolve(__dirname, "../../../uploads/images");

export async function uploadRouter(path: string, method: string, req: Request) {
  if (path === "/upload/image" && method === "POST") {
    try {
      const token = getToken(req)
      if (!token) {
        return Response.json({ error: "Unauthorized" }, 401);
      }
      const dir = new URL(req.url).searchParams.get("dir") as string
      if (!["covers", "profiles"].includes(dir)) {
        return Response.json({ error: "Invalid directory" }, 400);
      }
      // Получаем form data
      const formData = await req.formData();
      const file = formData.get("image") as File;

      if (!file) {
        return Response.json({ error: "No image provided" }, 400);
      }

      // Валидация
      if (!ALLOWED_TYPES.includes(file.type)) {
        return Response.json({ error: "Invalid file type. Allowed: JPEG, PNG, GIF, WebP" }, 400);
      }

      if (file.size > MAX_SIZE) {
        return Response.json({ error: "File too large. Max 5MB" }, 400);
      }

      // Создаём директорию если нет
      await mkdir(UPLOAD_DIR + `/${dir}`, { recursive: true });

      const filename = `${file.name.split(".")[0]}_${Date.now()}.webp`;
      const filepath = `${UPLOAD_DIR}/${dir}/${filename}`;

      // Читаем файл и конвертируем в WebP
      const buffer = await file.arrayBuffer();
      const webpBuffer = await convertToWebP(buffer);

      // Сохраняем
      await Bun.write(filepath, webpBuffer);

      return Response.json(`/uploads/images/${dir}/${filename}`, 201);

    } catch (error: any) {
      console.error("Upload error:", error);
      return Response.json({ error: error.message }, 500);
    }
  }

  // Получение загруженного изображения
  if (path.startsWith("/uploads/images/") && method === "GET") {
    try {
      const filename = path.replace("/uploads/images/", "").replace(/\.\./g, ""); // защита от path traversal
      const filepath = `${UPLOAD_DIR}/${filename}`;
      const file = Bun.file(filepath);

      if (!(await file.exists())) {
        return new Response("Not found", { status: 404 });
      }

      return new Response(file, {
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": "public, max-age=31536000",
        },
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  }

  return null;
}