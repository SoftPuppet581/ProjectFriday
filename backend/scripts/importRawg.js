// 사용법: npm run import -- [--from 2026-11-01] [--to 2027-04-30] [--pages 10] [--details 100] [--no-movies]
// 필요: backend/.env 의 RAWG_API_KEY
import 'dotenv/config';
import pool from '../src/config/db.js';
import { upsertByExternalId } from '../src/models/Game.js';
import { createRawgClient } from '../src/services/rawgClient.js';
import { importGames } from '../src/services/importService.js';

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

const isoDate = (d) => d.toISOString().slice(0, 10);
const today = new Date();
const inSixMonths = new Date(today);
inSixMonths.setUTCMonth(inSixMonths.getUTCMonth() + 6);

const options = {
  from: arg('from', isoDate(today)),
  to: arg('to', isoDate(inSixMonths)),
  pages: Number(arg('pages', 10)),
  details: Number(arg('details', 100)),
  movies: !process.argv.includes('--no-movies'),
};

try {
  const client = createRawgClient({ key: process.env.RAWG_API_KEY });
  console.log(`가져오는 기간: ${options.from} ~ ${options.to} (최대 ${options.pages}쪽, 상세 ${options.details}개)`);
  const stats = await importGames({ client, upsert: upsertByExternalId, log: console.log, ...options });
  console.log('완료:', stats);
} catch (error) {
  console.error(`가져오기 실패: ${error.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
