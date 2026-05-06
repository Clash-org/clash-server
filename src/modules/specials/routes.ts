/**
 * Clash Server - Tournament Management System
 * Copyright (C) 2026 Clash Contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { dirname, join, resolve } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isAdmin } from "../../shared/utils/helpers";
import { getToken, getTokenPayload } from "../../shared/utils/jwt";
import { Manifest } from "../../shared/typings";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const manifestPath = join(__dirname, '..', '..', '..', 'manifest.json');

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
        try {
            return deepLinkResponse;
        } catch(error: any) {
            return Response.json({ error: error.message }, { status: 400 });
        }
    }

    if (path.startsWith("/privacy-policy") && method === "GET") {
        try {
            const lang = String(new URL(req.url).searchParams.get("lang"))
            let path = resolve(process.cwd(), `public/privacy-policy-${lang}.md`)
            const policyMd = readFileSync(path, "utf-8");
            return Response.json(policyMd)
        } catch(error: any) {
            return Response.json({ error: error.message }, { status: 400 });
        }
    }

    if (path.startsWith("/pay-server-link") && method === "GET") {
        try {
            const existingData = readFileSync(manifestPath, 'utf8');
            const manifest: Manifest = JSON.parse(existingData);
            return Response.json({
                link: manifest.payServerLink,
                price: manifest.fiatPrice,
                currencyCode: manifest.currencyCode
            })
        } catch(error: any) {
            return Response.json({ error: error.message }, { status: 400 });
        }
    }

    if (path.startsWith("/pay-server-link") && method === "POST") {
        try {
            const token = getToken(req);
            if (!token) {
                return Response.json({ error: "Unauthorized" }, { status: 401 });
            }
            const payload = await getTokenPayload(token)
            if (!payload) {
                return Response.json({ error: "Id is null" }, { status: 404 });
            }
            if (!(await isAdmin(payload.sub))) {
                return Response.json({ error: "Is not admin" }, { status: 404 });
            }

            const { fiatPrice, payServerLink, currencyCode } = await req.json();
            const manifest = { fiatPrice, payServerLink, currencyCode }
            if (await Bun.file(manifestPath).exists()) {
                const existingData = JSON.parse(readFileSync(manifestPath, 'utf8'));
                writeFileSync(manifestPath, JSON.stringify({ ...existingData, ...manifest }, null, 2), 'utf8');
            } else {
                writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
            }
            return Response.json({ success: true }, { status: 200 });
        } catch(error: any) {
            return Response.json({ error: error.message }, { status: 400 });
        }
    }
}