// Steam 앱 번호가 있는 게임의 원화 가격을 Steam에서 새로 가져온다. 사용법: npm run prices:refresh
// 가격은 계속 바뀌므로 시연 직전에 한 번 실행해 두면 좋다. (먼저 npm run stores:enrich 로 Steam 앱 번호가 채워져 있어야 한다)
import 'dotenv/config';
import pool from '../src/config/db.js';
import { findWithSteamApp, updatePrice } from '../src/models/Game.js';
import { refreshPrices } from '../src/services/steamPriceService.js';

try {
  const games = await findWithSteamApp();
  console.log(`Steam 가격을 확인할 게임 ${games.length}개`);
  const stats = await refreshPrices({ games, save: updatePrice, log: console.log });
  console.log('완료:', stats);
  if (games.length && stats.unknown === games.length) process.exitCode = 1;
} catch (error) {
  console.error(`가격 갱신 실패: ${error.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
