// 설명이 없는 게임의 상세 정보(설명, 개발사, 배급사, 공식 사이트)를 RAWG에서 가져온다.
// 사용법: npm run details:fill -- [--limit 600]    (키: backend/.env 의 RAWG_API_KEY)
import 'dotenv/config';
import pool from '../src/config/db.js';
import { findNeedingDetails, markExistingDetailsChecked, updateDetails, removeMany } from '../src/models/Game.js';
import { createRawgClient } from '../src/services/rawgClient.js';
import { fillDetails } from '../src/services/detailsService.js';

const limitIndex = process.argv.indexOf('--limit');
const limit = limitIndex === -1 ? 1000 : Number(process.argv[limitIndex + 1]);

try {
  const client = createRawgClient({ key: process.env.RAWG_API_KEY });
  await markExistingDetailsChecked();
  const games = await findNeedingDetails(limit);
  console.log(`상세를 확인할 게임 ${games.length}개`);
  const stats = await fillDetails({ client, games, save: updateDetails, remove: (id) => removeMany([id]), log: console.log });
  console.log('완료:', stats);
} catch (error) {
  console.error(`상세 채우기 실패: ${error.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
