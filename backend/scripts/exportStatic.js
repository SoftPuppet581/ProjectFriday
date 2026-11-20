// 배포용 정적 데이터를 frontend/public/data/ 에 JSON으로 내보낸다. 사용법: npm run export:static
// 이 파일들은 커밋해서 GitHub에 올리고, Vercel이 빌드할 때 화면과 함께 배포된다. (DB가 바뀌면 다시 실행해서 커밋)
import 'dotenv/config';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import pool from '../src/config/db.js';
import { buildSnapshot } from '../src/services/staticExport.js';

const OUT = new URL('../../frontend/public/data/', import.meta.url);

try {
  const snapshot = await buildSnapshot(pool);
  mkdirSync(OUT, { recursive: true });
  for (const [name, value] of Object.entries(snapshot)) {
    writeFileSync(new URL(`${name}.json`, OUT), JSON.stringify(value)); // 한 줄로 저장해서 크기를 줄인다
  }
  let total = 0;
  for (const name of Object.keys(snapshot)) {
    const size = statSync(new URL(`${name}.json`, OUT)).size;
    total += size;
    console.log(`  ${name}.json  ${(size / 1024).toFixed(0)} KB`);
  }
  console.log(`내보내기 완료: 게임 ${snapshot.meta.games}개, 뉴스 ${snapshot.meta.news}건, 포럼 글 ${snapshot.meta.forumPosts}개 (합계 ${(total / 1024).toFixed(0)} KB)`);
} finally {
  await pool.end();
}
