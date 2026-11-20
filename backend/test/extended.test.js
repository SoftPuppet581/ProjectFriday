import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup, sample } from './helpers.js';

let ctx;
const api = (...args) => ctx.api(...args);

before(async () => {
  ctx = await setup();
});
after(async () => {
  await ctx.teardown();
});
beforeEach(async () => {
  await ctx.pool.query('TRUNCATE TABLE games');
});

const rich = (overrides = {}) =>
  sample({
    genres: ['Action', 'RPG'],
    tags: ['Singleplayer', 'Open World'],
    developers: ['Dev A'],
    publishers: ['Pub A'],
    screenshots: ['https://example.com/s1.jpg'],
    rating: 4.5,
    ratingsCount: 120,
    metacritic: 90,
    esrbRating: 'Mature',
    playtime: 30,
    popularity: 1000,
    externalId: 1,
    slug: 'test-game',
    sourceUrl: 'https://example.com/test-game',
    source: 'test',
    ...overrides,
  });

describe('확장 필드', () => {
  test('실제 게임 정보 필드를 저장하고 그대로 돌려준다', async () => {
    const created = await api('POST', '/api/games', rich());
    assert.equal(created.status, 201);
    const game = (await api('GET', `/api/games/${created.body.id}`)).body;
    assert.deepEqual(game.genres, ['Action', 'RPG']);
    assert.deepEqual(game.tags, ['Singleplayer', 'Open World']);
    assert.deepEqual(game.developers, ['Dev A']);
    assert.deepEqual(game.screenshots, ['https://example.com/s1.jpg']);
    assert.equal(game.rating, 4.5);
    assert.equal(typeof game.rating, 'number');
    assert.equal(game.metacritic, 90);
    assert.equal(game.externalId, 1);
  });

  test('trailerUrl이 없어도 YouTube 검색 링크(trailerSearchUrl)를 계산해 준다', async () => {
    const created = await api('POST', '/api/games', sample({ title: 'A & B: 100% 게임' }));
    assert.equal(
      created.body.trailerSearchUrl,
      `https://www.youtube.com/results?search_query=${encodeURIComponent('A & B: 100% 게임 official trailer')}`,
    );
    assert.equal(created.body.trailerUrl, null);
    // 저장되는 값이 아니라 계산 값이므로 입력으로는 받지 않는다
    const bad = await api('POST', '/api/games', sample({ title: 'x', trailerSearchUrl: 'https://a.com' }));
    assert.equal(bad.status, 400);
  });

  test('직접 입력한 게임은 genre만 넣어도 genres가 채워지고 빈 배열 필드는 []', async () => {
    const created = await api('POST', '/api/games', sample({ genre: 'Puzzle' }));
    assert.deepEqual(created.body.genres, ['Puzzle']);
    assert.deepEqual(created.body.tags, []);
    assert.deepEqual(created.body.screenshots, []);
    assert.equal(created.body.rating, null);
  });

  test('범위를 벗어나거나 형식이 틀린 값은 400', async () => {
    const bad = { rating: 6, metacritic: 101, ratingsCount: -1, genres: 'RPG', screenshots: ['not-a-url'], externalId: 0 };
    const res = await api('POST', '/api/games', sample(bad));
    assert.equal(res.status, 400);
    assert.deepEqual(res.body.errors.map((e) => e.field).sort(), ['externalId', 'genres', 'metacritic', 'ratingsCount', 'rating', 'screenshots'].sort());
  });

  test('PATCH로 확장 필드만 바꿀 수 있다', async () => {
    const created = await api('POST', '/api/games', rich());
    const res = await api('PATCH', `/api/games/${created.body.id}`, { rating: 3.25, tags: ['Co-op'] });
    assert.equal(res.body.rating, 3.25);
    assert.deepEqual(res.body.tags, ['Co-op']);
    assert.deepEqual(res.body.genres, ['Action', 'RPG']);
  });
});

describe('페이지네이션과 목록 필터', () => {
  beforeEach(async () => {
    for (let i = 1; i <= 5; i += 1) {
      await api('POST', '/api/games', sample({
        title: `게임 ${i}`,
        releaseDate: `2026-12-0${i}`,
        rating: i,
        popularity: i * 100,
        genres: i % 2 ? ['Action'] : ['RPG'],
      }));
    }
  });

  const titles = (res) => res.body.map((g) => g.title);

  test('X-Total-Count 헤더와 limit/page', async () => {
    const page1 = await api('GET', '/api/games?limit=2&page=1');
    assert.equal(page1.headers.get('x-total-count'), '5');
    assert.deepEqual(titles(page1), ['게임 1', '게임 2']);
    const page3 = await api('GET', '/api/games?limit=2&page=3');
    assert.deepEqual(titles(page3), ['게임 5']);
    const beyond = await api('GET', '/api/games?limit=2&page=9');
    assert.deepEqual(beyond.body, []);
    assert.equal(beyond.headers.get('x-total-count'), '5');
  });

  test('limit/page가 잘못되면 400', async () => {
    for (const query of ['limit=0', 'limit=201', 'limit=abc', 'page=0', 'page=x']) {
      const res = await api('GET', `/api/games?${query}`);
      assert.equal(res.status, 400, query);
    }
  });

  test('from/to로 기간 조회 (양 끝 포함)', async () => {
    const res = await api('GET', '/api/games?from=2026-12-02&to=2026-12-04');
    assert.deepEqual(titles(res), ['게임 2', '게임 3', '게임 4']);
    assert.equal((await api('GET', '/api/games?from=2026-12-32')).status, 400);
  });

  test('ids로 여러 게임을 한 번에 조회 (즐겨찾기용)', async () => {
    const all = (await api('GET', '/api/games')).body;
    const wanted = [all[0].id, all[3].id];
    const res = await api('GET', `/api/games?ids=${wanted.join(',')}`);
    assert.deepEqual(titles(res), ['게임 1', '게임 4']);
    assert.equal((await api('GET', '/api/games?ids=1,abc')).status, 400);
  });

  test('minRating과 평점/인기 정렬', async () => {
    assert.deepEqual(titles(await api('GET', '/api/games?minRating=4')), ['게임 4', '게임 5']);
    assert.deepEqual(titles(await api('GET', '/api/games?sort=-rating&limit=2')), ['게임 5', '게임 4']);
    assert.deepEqual(titles(await api('GET', '/api/games?sort=-popularity&limit=1')), ['게임 5']);
    assert.equal((await api('GET', '/api/games?minRating=9')).status, 400);
  });

  test('genre 필터는 genres 배열 안에서도 찾는다', async () => {
    assert.deepEqual(titles(await api('GET', '/api/games?genre=RPG')), ['게임 2', '게임 4']);
  });
});

describe('GET /api/calendar', () => {
  beforeEach(async () => {
    await api('POST', '/api/games', sample({ title: 'A', releaseDate: '2026-12-01', popularity: 10, rating: 3 }));
    await api('POST', '/api/games', sample({ title: 'B', releaseDate: '2026-12-01', popularity: 50, rating: 4 }));
    await api('POST', '/api/games', sample({ title: 'C', releaseDate: '2026-12-01', popularity: 30, rating: 4 }));
    await api('POST', '/api/games', sample({ title: 'D', releaseDate: '2026-12-01', popularity: 20, rating: 2 }));
    await api('POST', '/api/games', sample({ title: 'E', releaseDate: '2026-12-15', popularity: 5, platforms: ['Switch'] }));
    await api('POST', '/api/games', sample({ title: 'F', releaseDate: '2027-01-01', popularity: 5 }));
  });

  test('날짜별 개수와 인기 상위 3개 (기본)', async () => {
    const res = await api('GET', '/api/calendar?month=2026-12');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.map((d) => [d.date, d.count]), [['2026-12-01', 4], ['2026-12-15', 1]]);
    assert.deepEqual(res.body[0].games.map((g) => g.title), ['B', 'C', 'D']);
    assert.deepEqual(Object.keys(res.body[0].games[0]).sort(), ['coverImageUrl', 'id', 'rating', 'title']);
  });

  test('top으로 개수 조절, 필터 적용', async () => {
    const top1 = await api('GET', '/api/calendar?month=2026-12&top=1');
    assert.deepEqual(top1.body[0].games.map((g) => g.title), ['B']);
    assert.equal(top1.body[0].count, 4);
    const filtered = await api('GET', '/api/calendar?month=2026-12&platform=Switch');
    assert.deepEqual(filtered.body.map((d) => d.date), ['2026-12-15']);
  });

  test('from/to로도 조회하고, 기간이 없으면 400', async () => {
    const res = await api('GET', '/api/calendar?from=2026-12-14&to=2027-01-02');
    assert.deepEqual(res.body.map((d) => d.date), ['2026-12-15', '2027-01-01']);
    const none = await api('GET', '/api/calendar');
    assert.equal(none.status, 400);
    assert.equal((await api('GET', '/api/calendar?month=2026-12&top=11')).status, 400);
  });

  test('출시작이 없는 달은 빈 배열', async () => {
    assert.deepEqual((await api('GET', '/api/calendar?month=2030-01')).body, []);
  });
});

describe('GET /api/games/:id/similar', () => {
  test('장르와 태그가 겹치는 게임을 점수순으로', async () => {
    const base = await api('POST', '/api/games', sample({ title: '기준', genres: ['RPG', 'Action'], tags: ['Co-op'] }));
    await api('POST', '/api/games', sample({ title: '장르 둘 겹침', genres: ['RPG', 'Action'], rating: 3 }));
    await api('POST', '/api/games', sample({ title: '장르 하나 겹침', genres: ['RPG'], rating: 5 }));
    await api('POST', '/api/games', sample({ title: '태그만 겹침', genres: ['Puzzle'], tags: ['Co-op'], rating: 5 }));
    await api('POST', '/api/games', sample({ title: '관련 없음', genres: ['Sports'], rating: 5 }));

    const res = await api('GET', `/api/games/${base.body.id}/similar`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.map((g) => g.title), ['장르 둘 겹침', '장르 하나 겹침', '태그만 겹침']);
    assert.ok(!res.body.some((g) => g.id === base.body.id));
  });

  test('limit 적용, 없는 id는 404', async () => {
    const base = await api('POST', '/api/games', sample({ title: '기준', genres: ['RPG'] }));
    await api('POST', '/api/games', sample({ title: 'x1', genres: ['RPG'] }));
    await api('POST', '/api/games', sample({ title: 'x2', genres: ['RPG'] }));
    assert.equal((await api('GET', `/api/games/${base.body.id}/similar?limit=1`)).body.length, 1);
    assert.equal((await api('GET', '/api/games/99999/similar')).status, 404);
  });
});

describe('GET /api/games/:id/calendar.ics', () => {
  test('종일 일정 .ics를 내려준다', async () => {
    const created = await api('POST', '/api/games', sample({ title: '긴 제목, 쉼표;세미콜론', releaseDate: '2026-12-31', platforms: ['PC', 'PS5'] }));
    const res = await api('GET', `/api/games/${created.body.id}/calendar.ics`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/calendar/);
    assert.match(res.headers.get('content-disposition'), /attachment; filename="game-\d+\.ics"/);
    assert.ok(res.text.startsWith('BEGIN:VCALENDAR\r\n'));
    assert.ok(res.text.includes('DTSTART;VALUE=DATE:20261231'));
    assert.ok(res.text.includes('DTEND;VALUE=DATE:20270101')); // 연말 경계
    assert.ok(res.text.includes('SUMMARY:긴 제목\\, 쉼표\\;세미콜론 출시'));
    assert.ok(res.text.trimEnd().endsWith('END:VCALENDAR'));
  });

  test('없는 id는 404', async () => {
    assert.equal((await api('GET', '/api/games/99999/calendar.ics')).status, 404);
  });
});

describe('장르/플랫폼 목록', () => {
  test('개수 순으로 돌려준다', async () => {
    await api('POST', '/api/games', sample({ title: '1', genres: ['RPG'], platforms: ['PC', 'PS5'] }));
    await api('POST', '/api/games', sample({ title: '2', genres: ['RPG', 'Action'], platforms: ['PC'] }));
    await api('POST', '/api/games', sample({ title: '3', genre: 'Puzzle', platforms: ['PC'] }));

    const genres = await api('GET', '/api/genres');
    assert.deepEqual(genres.body, [
      { name: 'RPG', count: 2 },
      { name: 'Action', count: 1 },
      { name: 'Puzzle', count: 1 },
    ]);
    const platforms = await api('GET', '/api/platforms');
    assert.deepEqual(platforms.body, [
      { name: 'PC', count: 3 },
      { name: 'PS5', count: 1 },
    ]);
  });

  test('게임이 없으면 빈 배열', async () => {
    assert.deepEqual((await api('GET', '/api/genres')).body, []);
    assert.deepEqual((await api('GET', '/api/platforms')).body, []);
  });
});

describe('CORS', () => {
  test('React 개발 서버 주소를 허용하고 X-Total-Count를 노출한다', async () => {
    const res = await fetch(`${ctx.base}/api/games`, { headers: { Origin: 'http://localhost:5173' } });
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.match(res.headers.get('access-control-expose-headers') ?? '', /X-Total-Count/i);
  });

  test('Vite가 127.0.0.1로 뜨는 경우도 허용한다', async () => {
    const res = await fetch(`${ctx.base}/api/games`, { headers: { Origin: 'http://127.0.0.1:5173' } });
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5173');
  });

  test('허용하지 않은 주소에는 CORS 허용 헤더를 주지 않는다', async () => {
    const res = await fetch(`${ctx.base}/api/games`, { headers: { Origin: 'http://evil.example' } });
    assert.notEqual(res.headers.get('access-control-allow-origin'), 'http://evil.example');
  });
});
