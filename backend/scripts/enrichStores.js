// 아직 스토어를 확인하지 않은 게임의 스토어 링크(Steam, PlayStation Store 등)를 RAWG에서 가져온다.
// 사용법: npm run stores:enrich -- [--limit 600]    (키: backend/.env 의 RAWG_API_KEY)
import 'dotenv/config';
import pool from '../src/config/db.js';
import { findNeedingStores, updateStores } from '../src/models/Game.js';
import { createRawgClient } from '../src/services/rawgClient.js';
import { enrichStores } from '../src/services/storesService.js';

const limitIndex = process.argv.indexOf('--limit');
const limit = limitIndex === -1 ? 1000 : Number(process.argv[limitIndex + 1]);

try {
  const client = createRawgClient({ key: process.env.RAWG_API_KEY });
  const games = await findNeedingStores(limit);
  console.log(`스토어를 확인할 게임 ${games.length}개`);
  const stats = await enrichStores({ client, games, save: updateStores, log: console.log });
  console.log('완료:', stats);
} catch (error) {
  console.error(`스토어 확인 실패: ${error.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
