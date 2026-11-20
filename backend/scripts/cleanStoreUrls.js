// 이미 저장된 스토어 주소에서 추적용 파라미터(예: ?curator_clanid=...)를 지운다. 한 번 실행하면 된다. 사용법: npm run stores:clean
import 'dotenv/config';
import pool from '../src/config/db.js';
import { findEveryGame, updateStores } from '../src/models/Game.js';
import { cleanStoreUrl, steamAppIdFrom } from '../src/services/storesService.js';

try {
  const games = await findEveryGame();
  let changed = 0;
  for (const game of games) {
    if (!game.stores.length) continue;
    const seen = new Set();
    const cleaned = [];
    for (const store of game.stores) {
      const url = cleanStoreUrl(store.url);
      if (seen.has(url)) continue;
      seen.add(url);
      cleaned.push({ name: store.name, url });
    }
    if (JSON.stringify(cleaned) !== JSON.stringify(game.stores.map(({ name, url }) => ({ name, url })))) {
      await updateStores(game.id, cleaned, steamAppIdFrom(cleaned));
      changed += 1;
      console.log(`  정리: ${game.title}`);
    }
  }
  console.log(`스토어 주소를 정리한 게임 ${changed}개 (전체 ${games.length}개 중)`);
} finally {
  await pool.end();
}
