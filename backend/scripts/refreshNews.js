// 게임 뉴스 RSS를 지금 바로 가져와 저장한다. 사용법: npm run news:refresh
import 'dotenv/config';
import pool from '../src/config/db.js';
import { refreshNews } from '../src/services/newsService.js';

try {
  const results = await refreshNews();
  for (const r of results) console.log(`  ${r.source.padEnd(10)} ${r.ok ? `${r.count}개 저장` : `실패: ${r.error}`}`);
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM news');
  console.log(`뉴스 전체 ${total}개`);
  if (results.every((r) => !r.ok)) process.exitCode = 1;
} finally {
  await pool.end();
}
