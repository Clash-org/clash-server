/**
 * Clash Server - Tournament Management System
 * Copyright (C) 2026 Clash Contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import ServerABI from "../blockchain/abi/ClashServer.json";
import addresses from "../blockchain/addresses.json";
import { getContract } from './shared/utils/helpers';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Manifest } from "./shared/typings";

const manifestPath = join(import.meta.dir, '..', 'manifest.json');

async function updateServerPrice(serverId: number, newPrice: number) {
  const contract = getContract(addresses.Server, ServerABI);

  console.log(`🔄 Updating server ${serverId} price to ${newPrice}...`);

  const tx = await contract.setServerPrice(
    serverId,
    newPrice,
    { gasLimit: 500000 }
  );

  const receipt = await tx.wait();
  console.log(`✅ Server ${serverId} price updated! TX: ${receipt.hash}`);

  return receipt;
}

async function main() {
  // Читаем manifest.json
  let manifest: Manifest;

  try {
    const content = readFileSync(manifestPath, 'utf-8');
    manifest = JSON.parse(content);

    if (!manifest.serverId) {
      console.error('❌ No server ID found in manifest.json');
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Failed to read manifest.json from ${manifestPath}:`, error);
    process.exit(1);
  }

  // Получаем новую цену из .env
  const newPrice = Number(process.env.PRICE_PER_MONTH);

  if (!newPrice) {
    console.error('❌ PRICE_PER_MONTH not found in .env file');
    process.exit(1);
  }

  console.log(`📊 New price: ${newPrice}`);
  console.log(`🆔 Server to update: ${manifest.serverId}`);
  console.log('---');

  try {
    const receipt = await updateServerPrice(manifest.serverId, newPrice);
    console.log(`✅ Server ${manifest.serverId}: ${receipt.txHash}`);
  } catch (error: any) {
    console.log(`❌ Server ${manifest.serverId}: ${error.message}`);
  }
}

main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});