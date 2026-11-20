// db/featured.json 에 적힌 대작을 메인 화면 고정 대상으로 지정하고 트레일러를 넣는다.
// 사람이 직접 고른 목록이다. YouTube 주소는 퍼가기가 되는지 oEmbed로 확인하고, 안 되면 적용하지 않는다.
// 사용법: npm run db:featured            (YouTube 확인 후 적용)
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import pool from '../src/config/db.js';

const YOUTUBE_ID = /(?:youtube\.com\/watch\?(?:[^#]*&)?v=|youtu\.be\/)([\w-]{11})/;

async function verifyYoutube(url) {
  const match = url.match(YOUTUBE_ID);
  if (!match) return { ok: true, info: 'YouTube 주소가 아니라서 확인을 건너뜀' };
  const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${match[1]}&format=json`);
  if (!res.ok) return { ok: false, info: `퍼가기 확인 실패 (HTTP ${res.status})` };
  const body = await res.json();
  return { ok: true, info: `${body.title} / ${body.author_name}` };
}

const entries = JSON.parse(readFileSync(new URL('../db/featured.json', import.meta.url), 'utf8'));
let failed = false;

try {
  await pool.query('UPDATE games SET featured_order = NULL');
  for (const entry of entries) {
    const [rows] = await pool.query('SELECT id, title FROM games WHERE title = ?', [entry.title]);
    if (rows.length !== 1) {
      console.error(`[실패] "${entry.title}": DB에서 ${rows.length}개 찾음 (정확히 1개여야 함)`);
      failed = true;
      continue;
    }
    if (entry.trailerUrl) {
      const check = await verifyYoutube(entry.trailerUrl);
      if (!check.ok) {
        console.error(`[실패] "${entry.title}" 트레일러: ${check.info}`);
        failed = true;
        continue;
      }
      console.log(`  트레일러 확인: ${check.info}`);
    }
    await pool.query('UPDATE games SET featured_order = ?, trailer_url = COALESCE(?, trailer_url) WHERE id = ?', [
      entry.order,
      entry.trailerUrl ?? null,
      rows[0].id,
    ]);
    console.log(`[적용] #${rows[0].id} ${entry.title} (순서 ${entry.order})`);
  }
} finally {
  await pool.end();
}
if (failed) process.exitCode = 1;
