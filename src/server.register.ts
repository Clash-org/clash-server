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
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const manifestPath = join(__dirname, '..', 'manifest.json');

async function main() {
  if (await Bun.file(manifestPath).exists()) {
    console.log("❌ Server is already registered")
    return
  }
  const contract = getContract(addresses.Server, ServerABI);

  const tx = await contract.registerServer(
    process.env.CRYPTO_WALLET,
    process.env.HOST,
    process.env.CITY_HOST,
    process.env.PRICE_PER_MONTH,
    { gasLimit: 500000 }
  );

  const receipt = await tx.wait();
  const serverId = ethers.toNumber(receipt?.logs[0]?.topics[1]); // Парсим из события

  console.log(`✅ Server registered with ID: ${serverId}`);

  // Записываем обновлённый manifest.json
  writeFileSync(manifestPath, JSON.stringify({ serverId }, null, 2), 'utf8');
  console.log(`✅ Manifest saved to: ${manifestPath}`);
}

main().catch(console.error);