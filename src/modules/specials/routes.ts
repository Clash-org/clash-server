/**
 * Clash Server - Tournament Management System
 * Copyright (C) 2026 Clash Contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { resolve } from "node:path";
import { readFileSync } from "node:fs";

let deepLinkHtml: string;
try {
    // Путь к файлу (можно положить в public или другую директорию)
    const htmlPath = resolve(process.cwd(), "public/deeplink.html");
    deepLinkHtml = readFileSync(htmlPath, "utf-8");
} catch (error) {
    console.warn("Deep link HTML not found, using fallback");
    deepLinkHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"><title>Open in Clash</title></head>
        <body>
            <script>
                const path = window.location.pathname;
                window.location.href = 'clash://' + path.slice(1);
                setTimeout(() => { document.body.innerHTML = '<p>If the app doesn\'t open, <a href="https://github.com/Clash-org/clash-desktop/releases/latest">download it here</a></p>'; }, 2000);
            </script>
        </body>
        </html>
    `;
}

function handleDeepLink(path: string): Response | null {
    const deepLinkPath = "/open/"; // Добавляем слэш в начале

    // Проверяем, начинается ли путь с /open/
    if (!path.startsWith(deepLinkPath)) {
        return null;
    }

    // Убираем префикс /open/
    const remainingPath = path.slice(deepLinkPath.length);

    // Проверяем, что остаток пути начинается с одного из допустимых префиксов
    const validPrefixes = ['tournament', 'profile', 'leaderboard', 'match', 'club'];
    const isValid = validPrefixes.some(prefix =>
        remainingPath === prefix || remainingPath.startsWith(prefix + '/')
    );

    if (isValid) {
        return new Response(deepLinkHtml, {
            status: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
        });
    }

    return null;
}

export async function specialRouter(path: string, method: string, req: Request) {
     // Health check
    if (path === "/health" && method === "GET") {
        return Response.json({ status: "ok" });
    }

    const deepLinkResponse = handleDeepLink(path);
    if (deepLinkResponse) {
        return deepLinkResponse;
    }

    if (path.startsWith("/privacy-policy") && method === "GET") {
        const lang = String(new URL(req.url).searchParams.get("lang"))
        let path = resolve(process.cwd(), `public/privacy-policy-${lang}.md`)
        const policyMd = readFileSync(path, "utf-8");
        return Response.json(policyMd)
    }
}