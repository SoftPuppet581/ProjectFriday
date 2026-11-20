// 이미 DB에 들어 있는 성인 게임을 찾아 지운다.
// 사용법: npm run db:purge-adult -- --dry   (지우지 않고 대상 목록만 보여 줌)
//         npm run db:purge-adult            (실제로 지움)
import 'dotenv/config';
import pool from '../src/config/db.js';
import { findEveryGame, removeMany } from '../src/models/Game.js';
import { adultReason } from '../src/services/contentFilter.js';

const dry = process.argv.includes('--dry');

try {
  const games = await findEveryGame();
  const targets = games.map((g) => ({ g, reason: adultReason(g) })).filter((x) => x.reason);

  console.log(`전체 ${games.length}개 중 성인 게임 ${targets.length}개${dry ? ' (미리보기: 지우지 않음)' : ''}`);
  for (const { g, reason } of targets) console.log(`  #${g.id} ${g.title} [${reason}]`);

  if (!dry && targets.length) {
    const deleted = await removeMany(targets.map((x) => x.g.id));
    console.log(`삭제 완료: ${deleted}개`);
  }
} finally {
  await pool.end();
}
