// RAWG 가져오기 로직 테스트. 실제 RAWG 서버는 호출하지 않고 가짜 응답(fixture)을 쓴다.
// fixture의 필드 모양은 RAWG 공개 문서를 기준으로 한 것이므로, 실제 키로 처음 가져올 때 한 번 확인해야 한다.
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup } from './helpers.js';

let ctx;
let mapRawgGame;
let importGames;
let createRawgClient;
let upsertByExternalId;

before(async () => {
  ctx = await setup();
  ({ mapRawgGame } = await import('../src/services/rawgMapper.js'));
  ({ importGames } = await import('../src/services/importService.js'));
  ({ createRawgClient } = await import('../src/services/rawgClient.js'));
  ({ upsertByExternalId } = await import('../src/models/Game.js'));
});
after(async () => {
  await ctx.teardown();
});
beforeEach(async () => {
  await ctx.pool.query('TRUNCATE TABLE games');
});

const listItem = (overrides = {}) => ({
  id: 9001,
  slug: 'fixture-game',
  name: 'Fixture Game',
  released: '2026-12-01',
  background_image: 'https://example.com/bg.jpg',
  rating: 4.25,
  ratings_count: 100,
  metacritic: 88,
  added: 5000,
  playtime: 12,
  platforms: [{ platform: { id: 4, name: 'PC' } }, { platform: { id: 187, name: 'PlayStation 5' } }],
  genres: [{ id: 4, name: 'Action' }, { id: 5, name: 'RPG' }],
  tags: [{ name: 'Singleplayer' }],
  short_screenshots: [{ id: -1, image: 'https://example.com/bg.jpg' }, { id: 1, image: 'https://example.com/s1.jpg' }],
  esrb_rating: { name: 'Mature' },
  ...overrides,
});
const detail = { description_raw: '설명 본문', developers: [{ name: 'Dev A' }], publishers: [{ name: 'Pub A' }], website: 'https://example.com/official' };
const movies = { results: [{ id: 1, name: 'Trailer', data: { 480: 'https://example.com/t480.mp4', max: 'https://example.com/tmax.mp4' } }] };

describe('mapRawgGame', () => {
  test('목록, 상세, 영상 응답을 우리 형태로 합친다', () => {
    const g = mapRawgGame(listItem(), detail, movies);
    assert.equal(g.title, 'Fixture Game');
    assert.equal(g.releaseDate, '2026-12-01');
    assert.deepEqual(g.platforms, ['PC', 'PlayStation 5']);
    assert.equal(g.genre, 'Action');
    assert.deepEqual(g.genres, ['Action', 'RPG']);
    assert.equal(g.description, '설명 본문');
    assert.equal(g.trailerUrl, 'https://example.com/tmax.mp4');
    assert.equal(g.officialUrl, 'https://example.com/official');
    assert.deepEqual(g.developers, ['Dev A']);
    assert.equal(g.rating, 4.25);
    assert.equal(g.popularity, 5000);
    assert.equal(g.externalId, 9001);
    assert.equal(g.sourceUrl, 'https://rawg.io/games/fixture-game');
    assert.equal(g.source, 'rawg');
  });

  test('상세/영상이 없어도 동작한다', () => {
    const g = mapRawgGame(listItem());
    assert.equal(g.description, null);
    assert.equal(g.trailerUrl, null);
    assert.deepEqual(g.developers, []);
  });

  test('영상은 max가 없으면 480을 쓰고, http가 아닌 주소는 버린다', () => {
    const only480 = mapRawgGame(listItem(), null, { results: [{ data: { 480: 'https://example.com/t480.mp4' } }] });
    assert.equal(only480.trailerUrl, 'https://example.com/t480.mp4');
    const bad = mapRawgGame(listItem({ background_image: 'javascript:alert(1)' }), { website: 'ftp://x' }, null);
    assert.equal(bad.coverImageUrl, null);
    assert.equal(bad.officialUrl, null);
  });

  test('출시일이 없거나(TBA) 필수 정보가 없으면 null', () => {
    assert.equal(mapRawgGame(listItem({ released: null })), null);
    assert.equal(mapRawgGame(listItem({ name: '' })), null);
    assert.equal(mapRawgGame(null), null);
  });

  test('평점 0은 null로 둔다 (아직 평가 없음)', () => {
    assert.equal(mapRawgGame(listItem({ rating: 0 })).rating, null);
  });
});

function fakeClient(pages, { failMoviesFor = null } = {}) {
  const calls = { list: 0, game: 0, movies: 0 };
  return {
    calls,
    async listGames({ page }) {
      calls.list += 1;
      const results = pages[page - 1] ?? [];
      return { count: pages.flat().length, next: page < pages.length ? 'next' : null, results };
    },
    async getGame() {
      calls.game += 1;
      return detail;
    },
    async getMovies(id) {
      calls.movies += 1;
      if (id === failMoviesFor) throw Object.assign(new Error('영상 없음'), { fatal: false });
      return movies;
    },
  };
}

describe('importGames', () => {
  const run = (client, options = {}) =>
    importGames({ client, upsert: upsertByExternalId, from: '2026-12-01', to: '2026-12-31', ...options });

  test('목록을 읽어 DB에 저장하고, 다시 실행하면 중복 없이 갱신/유지된다', async () => {
    const pages = [[listItem({ id: 1, name: 'G1' }), listItem({ id: 2, name: 'G2' })], [listItem({ id: 3, name: 'G3' })]];
    const first = await run(fakeClient(pages));
    assert.deepEqual(first, { fetched: 3, inserted: 3, updated: 0, unchanged: 0, skipped: 0 });

    const [[{ n }]] = await ctx.pool.query('SELECT COUNT(*) AS n FROM games');
    assert.equal(n, 3);

    const second = await run(fakeClient(pages));
    assert.equal(second.inserted, 0);
    assert.equal(second.updated + second.unchanged, 3);
    const [[{ n: n2 }]] = await ctx.pool.query('SELECT COUNT(*) AS n FROM games');
    assert.equal(n2, 3);

    const saved = (await ctx.api('GET', '/api/games?sort=title')).body[0];
    assert.equal(saved.title, 'G1');
    assert.equal(saved.trailerUrl, 'https://example.com/tmax.mp4');
    assert.deepEqual(saved.genres, ['Action', 'RPG']);
  });

  test('값이 바뀌면 같은 externalId를 갱신한다', async () => {
    await run(fakeClient([[listItem({ id: 1, rating: 3 })]]));
    const result = await run(fakeClient([[listItem({ id: 1, rating: 4.5 })]]));
    assert.equal(result.updated, 1);
    const games = (await ctx.api('GET', '/api/games')).body;
    assert.equal(games.length, 1);
    assert.equal(games[0].rating, 4.5);
  });

  test('출시일 미정 게임은 건너뛴다', async () => {
    const result = await run(fakeClient([[listItem({ id: 1 }), listItem({ id: 2, name: 'TBA', released: null })]]));
    assert.equal(result.inserted, 1);
    assert.equal(result.skipped, 1);
  });

  test('같은 제목과 출시일의 다른 게임은 건너뛰고 계속한다', async () => {
    const result = await run(fakeClient([[listItem({ id: 1 }), listItem({ id: 2 }), listItem({ id: 3, name: '다른 게임' })]]));
    assert.equal(result.inserted, 2);
    assert.equal(result.skipped, 1);
  });

  test('details 개수만큼만 상세/영상을 호출한다', async () => {
    const client = fakeClient([[listItem({ id: 1 }), listItem({ id: 2, name: 'G2' }), listItem({ id: 3, name: 'G3' })]]);
    await run(client, { details: 2 });
    assert.equal(client.calls.game, 2);
    assert.equal(client.calls.movies, 2);
    const noMovies = fakeClient([[listItem({ id: 1 })]]);
    await run(noMovies, { movies: false });
    assert.equal(noMovies.calls.movies, 0);
  });

  test('pages 개수에서 멈춘다', async () => {
    const client = fakeClient([[listItem({ id: 1 })], [listItem({ id: 2, name: 'G2' })], [listItem({ id: 3, name: 'G3' })]]);
    await run(client, { pages: 2 });
    assert.equal(client.calls.list, 2);
  });

  test('영상 조회가 일부 실패해도(치명적이지 않으면) 그 게임은 저장된다', async () => {
    const result = await run(fakeClient([[listItem({ id: 1 })]], { failMoviesFor: 1 }));
    assert.equal(result.inserted, 1);
    assert.equal((await ctx.api('GET', '/api/games')).body[0].trailerUrl, null);
  });

  test('치명적 오류(키 거절, 한도 초과)는 가져오기를 멈춘다', async () => {
    const client = fakeClient([[listItem({ id: 1 })]]);
    client.getGame = async () => {
      throw Object.assign(new Error('키 거절'), { fatal: true });
    };
    await assert.rejects(run(client), /키 거절/);
  });
});

describe('createRawgClient', () => {
  const noWait = { delayMs: 0, sleep: async () => {} };
  const response = (status, body = {}) => ({ status, ok: status >= 200 && status < 300, json: async () => body });

  test('키가 없으면 바로 에러', () => {
    assert.throws(() => createRawgClient({ key: '' }), /RAWG_API_KEY/);
  });

  test('요청 주소에 키와 조건이 들어간다', async () => {
    let requested;
    const client = createRawgClient({ key: 'SECRET', ...noWait, fetchImpl: async (url) => ((requested = url), response(200, { results: [] })) });
    await client.listGames({ from: '2026-12-01', to: '2026-12-31', page: 2, pageSize: 40 });
    assert.equal(requested.searchParams.get('key'), 'SECRET');
    assert.equal(requested.searchParams.get('dates'), '2026-12-01,2026-12-31');
    assert.equal(requested.searchParams.get('page'), '2');
    assert.equal(requested.searchParams.get('ordering'), '-added');
    assert.equal(requested.pathname, '/api/games');
  });

  test('401/403/429는 치명적 에러이고 메시지에 키가 들어가지 않는다', async () => {
    for (const status of [401, 403, 429]) {
      const client = createRawgClient({ key: 'SECRET', ...noWait, fetchImpl: async () => response(status) });
      await assert.rejects(client.getGame(1), (error) => {
        assert.equal(error.fatal, true);
        assert.ok(!error.message.includes('SECRET'));
        return true;
      });
    }
  });

  test('404 같은 일반 실패는 치명적이지 않다', async () => {
    const client = createRawgClient({ key: 'SECRET', ...noWait, fetchImpl: async () => response(404) });
    await assert.rejects(client.getGame(1), (error) => error.fatal === false);
  });

  test('네트워크 오류는 2번 다시 시도하고 그래도 실패하면 치명적', async () => {
    let attempts = 0;
    const client = createRawgClient({ key: 'SECRET', ...noWait, fetchImpl: async () => { attempts += 1; throw new TypeError('network'); } });
    await assert.rejects(client.getGame(1), (error) => error.fatal === true && !error.message.includes('SECRET'));
    assert.equal(attempts, 3);
  });

  test('한 번 실패 후 성공하면 결과를 돌려준다', async () => {
    let attempts = 0;
    const client = createRawgClient({
      key: 'SECRET',
      ...noWait,
      fetchImpl: async () => {
        attempts += 1;
        if (attempts === 1) throw new TypeError('network');
        return response(200, { id: 1 });
      },
    });
    assert.deepEqual(await client.getGame(1), { id: 1 });
  });
});
