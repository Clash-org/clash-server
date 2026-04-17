import { ethers } from "ethers";
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

    if (!manifest.serversIds || manifest.serversIds.length === 0) {
      console.error('❌ No servers IDs found in manifest.json');
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Failed to read manifest.json from ${manifestPath}:`, error);
    process.exit(1);
  }

  // Получаем новую цену из .env
  let newPrice = Number(process.env.PRICE_PER_MONTH);

  if (!newPrice) {
    console.error('❌ PRICE_PER_MONTH not found in .env file');
    process.exit(1);
  }

  console.log(`📊 New price: ${manifest.prices ? JSON.stringify(manifest.prices) : newPrice}`);
  console.log(`🆔 Servers to update: ${manifest.serversIds.join(', ')}`);
  console.log('---');

  // Обновляем цену для каждого сервера
  const results = [];
  for (const [i, serverId] of manifest.serversIds.entries()) {
    try {
        if (manifest.prices) {
            newPrice = manifest.prices[i]
        }
      const receipt = await updateServerPrice(serverId, newPrice);
      results.push({ serverId, success: true, txHash: receipt.hash });
    } catch (error: any) {
      console.error(`❌ Failed to update server ${serverId}:`, error.message);
      results.push({ serverId, success: false, error: error.message });
    }
    console.log('---');
  }

  // Выводим итоги
  console.log('\n📊 SUMMARY:');
  console.log(`✅ Success: ${results.filter(r => r.success).length}/${results.length}`);
  results.forEach(result => {
    if (result.success) {
      console.log(`  ✅ Server ${result.serverId}: ${result.txHash}`);
    } else {
      console.log(`  ❌ Server ${result.serverId}: ${result.error}`);
    }
  });
}

main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});