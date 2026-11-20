// 테스트 공용 설정: 운영 DB가 아닌 테스트 DB를 쓰고, 실제 서버를 임의 포트에 띄운다.
// db.js가 import되기 전에 DB_NAME을 바꿔야 하므로 app은 setup() 안에서 동적으로 불러온다.
process.env.DB_NAME = 'game_calendar_test';
process.env.NEWS_AUTO_REFRESH = 'false'; // 테스트 중에 실제 RSS 서버를 부르지 않는다

import { readFileSync } from 'node:fs';
import mysql from 'mysql2/promise';

export const sample = (overrides = {}) => ({
  title: '테스트 게임',
  releaseDate: '2027-01-10',
  platforms: ['PC'],
  ...overrides,
});

export async function setup() {
  const { default: dotenv } = await import('dotenv');
  dotenv.config();

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'game_calendar_test',
    multipleStatements: true,
  });
  await conn.query(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  await conn.end();

  const { default: pool } = await import('../src/config/db.js');
  const { default: app } = await import('../src/app.js');
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  async function api(method, path, body) {
    const options = { method, headers: { 'content-type': 'application/json' } };
    if (body !== undefined) options.body = typeof body === 'string' ? body : JSON.stringify(body);
    const res = await fetch(`${base}${path}`, options);
    const text = await res.text();
    const isJson = (res.headers.get('content-type') ?? '').includes('json');
    return { status: res.status, headers: res.headers, text, body: text && isJson ? JSON.parse(text) : null };
  }

  async function teardown() {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }

  return { api, base, pool, teardown };
}
