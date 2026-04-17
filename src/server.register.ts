/**
 * Clash Server - Tournament Management System
 * Copyright (C) 2026 Clash Contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { ethers } from "ethers";
import ServerABI from "../blockchain/abi/ClashServer.json"
import addresses from "../blockchain/addresses.json"
import { getContract } from './shared/utils/helpers';
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Manifest } from "./shared/typings";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const manifestPath = join(__dirname, '..', 'manifest.json');

async function main() {
  const contract = getContract(addresses.Server, ServerABI);

  const tx = await contract.registerServer(
    process.env.CRYPTO_WALLET,
    process.env.HOST,
    process.env.PRICE_PER_MONTH,
    { gasLimit: 500000 }
  );

  const receipt = await tx.wait();
  const serverId = ethers.toNumber(receipt?.logs[0]?.topics[1]); // Парсим из события

  console.log(`✅ Server registered with ID: ${serverId}`);

  // Читаем существующий manifest.json или создаём новый
  let manifest: Manifest = { serversIds: [] };

  try {
    const existingData = readFileSync(manifestPath, 'utf8');
    manifest = JSON.parse(existingData);

    // Убеждаемся, что поле serversIds существует
    if (!manifest.serversIds) {
      manifest.serversIds = [];
    }
  } catch (error) {
    // Файл не существует, создаём новый
    console.log('📝 Creating new manifest.json');
  }

  // Добавляем новый serverId, если его ещё нет
  if (!manifest.serversIds.includes(serverId)) {
    manifest.serversIds.push(serverId);
    console.log(`➕ Added server ID ${serverId} to manifest`);
  } else {
    console.log(`⚠️ Server ID ${serverId} already exists in manifest`);
  }

  // Записываем обновлённый manifest.json
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`✅ Manifest saved to: ${manifestPath}`);
  console.log(`📋 Current servers IDs: ${manifest.serversIds.join(', ')}`);
}

main().catch(console.error);