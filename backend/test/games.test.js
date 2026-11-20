// 운영 DB(game_calendar)를 건드리지 않도록 별도 테스트 DB를 쓴다.
// db.js가 import되기 전에 DB_NAME을 바꿔야 하므로 app은 동적으로 불러온다.
process.env.DB_NAME = 'game_calendar_test';

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import mysql from 'mysql2/promise';

let server;
let base;
let pool;

async function api(method, path, body) {
  const options = { method, headers: { 'content-type': 'application/json' } };
  if (body !== undefined) options.body = typeof body === 'string' ? body : JSON.stringify(body);
  const res = await fetch(`${base}${path}`, options);
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
}

const sample = (overrides = {}) => ({
  title: '테스트 게임',
  releaseDate: '2027-01-10',
  platforms: ['PC'],
  ...overrides,
});

before(async () => {
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

  ({ default: pool } = await import('../src/config/db.js'));
  const { default: app } = await import('../src/app.js');
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

beforeEach(async () => {
  await pool.query('TRUNCATE TABLE games');
});

describe('health', () => {
  test('GET /api/health', async () => {
    const res = await api('GET', '/api/health');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { status: 'ok' });
  });
});

describe('POST /api/games', () => {
  test('등록하면 201과 Location 헤더, 생성된 객체를 돌려준다', async () => {
    const res = await api('POST', '/api/games', sample({ genre: 'RPG', trailerUrl: 'https://www.youtube.com/watch?v=abc' }));
    assert.equal(res.status, 201);
    assert.equal(res.headers.get('location'), `/api/games/${res.body.id}`);
    assert.equal(res.body.title, '테스트 게임');
    assert.equal(res.body.releaseDate, '2027-01-10');
    assert.deepEqual(res.body.platforms, ['PC']);
    assert.equal(res.body.genre, 'RPG');
    assert.equal(res.body.description, null);
    assert.equal(res.body.trailerUrl, 'https://www.youtube.com/watch?v=abc');
  });

  test('같은 제목과 출시일이면 409', async () => {
    await api('POST', '/api/games', sample());
    const res = await api('POST', '/api/games', sample());
    assert.equal(res.status, 409);
    assert.ok(res.body.message);
  });

  test('제목이 같아도 출시일이 다르면 등록된다', async () => {
    await api('POST', '/api/games', sample());
    const res = await api('POST', '/api/games', sample({ releaseDate: '2027-02-01' }));
    assert.equal(res.status, 201);
  });

  test('필수값이 틀리면 400이고 errors에 필드별 메시지가 있다', async () => {
    const res = await api('POST', '/api/games', { title: '', releaseDate: '2027-02-30', platforms: [] });
    assert.equal(res.status, 400);
    const fields = res.body.errors.map((e) => e.field).sort();
    assert.deepEqual(fields, ['platforms', 'releaseDate', 'title']);
  });

  test('필수 필드가 아예 없으면 400', async () => {
    const res = await api('POST', '/api/games', {});
    assert.equal(res.status, 400);
    assert.equal(res.body.errors.length, 3);
  });

  test('알 수 없는 필드는 400', async () => {
    const res = await api('POST', '/api/games', sample({ hack: 'x' }));
    assert.equal(res.status, 400);
    assert.equal(res.body.errors[0].field, 'hack');
  });

  test('http/https가 아닌 주소는 400', async () => {
    const res = await api('POST', '/api/games', sample({ trailerUrl: 'javascript:alert(1)' }));
    assert.equal(res.status, 400);
    assert.equal(res.body.errors[0].field, 'trailerUrl');
  });

  test('잘못된 JSON은 400이고 일정한 에러 형식이다', async () => {
    const res = await api('POST', '/api/games', '{bad json');
    assert.equal(res.status, 400);
    assert.deepEqual(Object.keys(res.body).sort(), ['errors', 'message']);
  });

  test('본문이 배열이면 400', async () => {
    const res = await api('POST', '/api/games', [1, 2]);
    assert.equal(res.status, 400);
  });
});

describe('GET /api/games', () => {
  beforeEach(async () => {
    await api('POST', '/api/games', sample({ title: 'B 게임', releaseDate: '2026-12-12', platforms: ['PC', 'Switch'], genre: 'RPG', description: '판타지 모험' }));
    await api('POST', '/api/games', sample({ title: 'A 게임', releaseDate: '2026-12-31', platforms: ['PS5'], genre: 'Action' }));
    await api('POST', '/api/games', sample({ title: 'C 게임', releaseDate: '2027-01-01', platforms: ['PC'], genre: 'Action' }));
  });

  const titles = (res) => res.body.map((g) => g.title);

  test('기본은 출시일 오름차순', async () => {
    const res = await api('GET', '/api/games');
    assert.equal(res.status, 200);
    assert.deepEqual(titles(res), ['B 게임', 'A 게임', 'C 게임']);
  });

  test('sort=-releaseDate는 내림차순', async () => {
    const res = await api('GET', '/api/games?sort=-releaseDate');
    assert.deepEqual(titles(res), ['C 게임', 'A 게임', 'B 게임']);
  });

  test('sort=title은 제목순', async () => {
    const res = await api('GET', '/api/games?sort=title');
    assert.deepEqual(titles(res), ['A 게임', 'B 게임', 'C 게임']);
  });

  test('허용되지 않은 sort 값은 기본 정렬로 처리하고 SQL에 쓰이지 않는다', async () => {
    const res = await api('GET', '/api/games?sort=id;DROP TABLE games');
    assert.equal(res.status, 200);
    assert.deepEqual(titles(res), ['B 게임', 'A 게임', 'C 게임']);
  });

  test('month 필터는 해당 월만 (월말과 다음 달 1일 경계 포함)', async () => {
    const dec = await api('GET', '/api/games?month=2026-12');
    assert.deepEqual(titles(dec), ['B 게임', 'A 게임']);
    const jan = await api('GET', '/api/games?month=2027-01');
    assert.deepEqual(titles(jan), ['C 게임']);
  });

  test('platform 필터는 배열 안에 포함된 게임', async () => {
    const res = await api('GET', '/api/games?platform=PC');
    assert.deepEqual(titles(res), ['B 게임', 'C 게임']);
  });

  test('genre 필터', async () => {
    const res = await api('GET', '/api/games?genre=Action');
    assert.deepEqual(titles(res), ['A 게임', 'C 게임']);
  });

  test('q는 제목과 설명에서 검색', async () => {
    assert.deepEqual(titles(await api('GET', '/api/games?q=A 게임')), ['A 게임']);
    assert.deepEqual(titles(await api('GET', '/api/games?q=판타지')), ['B 게임']);
  });

  test('필터를 같이 쓰면 AND로 동작', async () => {
    const res = await api('GET', '/api/games?month=2026-12&platform=PC&genre=RPG');
    assert.deepEqual(titles(res), ['B 게임']);
  });

  test('결과가 없으면 빈 배열', async () => {
    const res = await api('GET', '/api/games?month=2030-01');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  test('month 형식이 틀리면 400', async () => {
    for (const month of ['2026-13', '2026-1', 'abc']) {
      const res = await api('GET', `/api/games?month=${month}`);
      assert.equal(res.status, 400, month);
      assert.equal(res.body.errors[0].field, 'month');
    }
  });
});

describe('GET /api/games/:id', () => {
  test('단건 조회', async () => {
    const created = await api('POST', '/api/games', sample());
    const res = await api('GET', `/api/games/${created.body.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.id, created.body.id);
  });

  test('없는 id는 404', async () => {
    const res = await api('GET', '/api/games/99999');
    assert.equal(res.status, 404);
  });

  test('숫자가 아닌 id는 400', async () => {
    for (const id of ['abc', '0', '-1', '1.5']) {
      const res = await api('GET', `/api/games/${id}`);
      assert.equal(res.status, 400, id);
    }
  });
});

describe('PUT /api/games/:id', () => {
  test('전체를 덮어쓰고 보내지 않은 선택 필드는 null이 된다', async () => {
    const created = await api('POST', '/api/games', sample({ genre: 'RPG', description: '설명' }));
    const res = await api('PUT', `/api/games/${created.body.id}`, sample({ releaseDate: '2027-01-11', platforms: ['PC', 'PS5'] }));
    assert.equal(res.status, 200);
    assert.equal(res.body.releaseDate, '2027-01-11');
    assert.deepEqual(res.body.platforms, ['PC', 'PS5']);
    assert.equal(res.body.genre, null);
    assert.equal(res.body.description, null);
  });

  test('필수 필드가 빠지면 400', async () => {
    const created = await api('POST', '/api/games', sample());
    const res = await api('PUT', `/api/games/${created.body.id}`, { title: 'x' });
    assert.equal(res.status, 400);
  });

  test('없는 id는 404', async () => {
    const res = await api('PUT', '/api/games/99999', sample());
    assert.equal(res.status, 404);
  });

  test('다른 게임과 같은 제목과 출시일로 바꾸면 409', async () => {
    await api('POST', '/api/games', sample({ title: '다른 게임' }));
    const created = await api('POST', '/api/games', sample());
    const res = await api('PUT', `/api/games/${created.body.id}`, sample({ title: '다른 게임' }));
    assert.equal(res.status, 409);
  });
});

describe('PATCH /api/games/:id', () => {
  test('보낸 필드만 바꾼다', async () => {
    const created = await api('POST', '/api/games', sample({ genre: 'RPG' }));
    const res = await api('PATCH', `/api/games/${created.body.id}`, { genre: 'Action' });
    assert.equal(res.status, 200);
    assert.equal(res.body.genre, 'Action');
    assert.equal(res.body.title, '테스트 게임');
    assert.deepEqual(res.body.platforms, ['PC']);
  });

  test('platforms 배열도 바꿀 수 있다', async () => {
    const created = await api('POST', '/api/games', sample());
    const res = await api('PATCH', `/api/games/${created.body.id}`, { platforms: ['Switch'] });
    assert.deepEqual(res.body.platforms, ['Switch']);
  });

  test('null을 보내면 선택 필드를 비울 수 있다', async () => {
    const created = await api('POST', '/api/games', sample({ genre: 'RPG' }));
    const res = await api('PATCH', `/api/games/${created.body.id}`, { genre: null });
    assert.equal(res.body.genre, null);
  });

  test('잘못된 값은 400', async () => {
    const created = await api('POST', '/api/games', sample());
    const res = await api('PATCH', `/api/games/${created.body.id}`, { releaseDate: '2027-13-01' });
    assert.equal(res.status, 400);
  });

  test('필수 필드를 null로 바꾸려 하면 400', async () => {
    const created = await api('POST', '/api/games', sample());
    const res = await api('PATCH', `/api/games/${created.body.id}`, { title: null });
    assert.equal(res.status, 400);
  });

  test('빈 객체는 변경 없이 200', async () => {
    const created = await api('POST', '/api/games', sample());
    const res = await api('PATCH', `/api/games/${created.body.id}`, {});
    assert.equal(res.status, 200);
    assert.equal(res.body.title, '테스트 게임');
  });

  test('없는 id는 404', async () => {
    const res = await api('PATCH', '/api/games/99999', { genre: 'x' });
    assert.equal(res.status, 404);
  });
});

describe('DELETE /api/games/:id', () => {
  test('삭제하면 204, 다시 조회하면 404, 다시 삭제해도 404', async () => {
    const created = await api('POST', '/api/games', sample());
    const del = await api('DELETE', `/api/games/${created.body.id}`);
    assert.equal(del.status, 204);
    assert.equal(del.body, null);
    assert.equal((await api('GET', `/api/games/${created.body.id}`)).status, 404);
    assert.equal((await api('DELETE', `/api/games/${created.body.id}`)).status, 404);
  });
});

describe('없는 경로', () => {
  test('404와 일정한 에러 형식', async () => {
    const res = await api('GET', '/api/nothing');
    assert.equal(res.status, 404);
    assert.deepEqual(Object.keys(res.body).sort(), ['errors', 'message']);
  });
});
