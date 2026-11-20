// 시연용 샘플 계정 20개와 포럼 활동(글, 댓글, 좋아요)을 넣거나 지운다.
// 사용법: npm run seed:demo           (넣기. 다시 실행하면 샘플만 지우고 새로 넣는다)
//         npm run seed:demo:remove    (샘플만 지우기. 실제 사용자의 계정과 글은 그대로)
import 'dotenv/config';
import pool from '../src/config/db.js';
import { seedDemo, removeDemo } from '../src/services/demoSeed.js';

try {
  if (process.argv.includes('--remove')) {
    console.log(`시연용 샘플 계정 ${await removeDemo(pool)}개와 그 글/댓글/좋아요를 지웠습니다.`);
  } else {
    const stats = await seedDemo(pool, { log: console.log });
    console.log(`완료: 계정 ${stats.users}개, 글 ${stats.posts}개, 댓글 ${stats.comments}개, 좋아요 ${stats.likes}개`);
    if (stats.unlinkedGames.length) console.log(`  (DB에 없어서 게임 연결을 못 한 글: ${stats.unlinkedGames.join(', ')})`);
    console.log('  샘플 계정은 로그인할 수 없고, npm run seed:demo:remove 로 지울 수 있습니다.');
  }
} finally {
  await pool.end();
}
