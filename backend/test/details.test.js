// 상세 정보 채우기 테스트. 실제 RAWG 서버는 부르지 않고 가짜 응답을 쓴다.
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup, sample } from './helpers.js';

let ctx;
let Game;
let details;
const api = (...args) => ctx.api(...args);

before(async () => {
  ctx = await setup();
  Game = await import('../src/models/Game.js');
  details = await import('../src/services/detailsService.js');
});
after(async () => {
  await ctx.teardown();
});
beforeEach(async () => {
  await ctx.pool.query('TRUNCATE TABLE games');
});

const createGame = async (overrides = {}) => (await api('POST', '/api/games', sample(overrides))).body;
const run = async (client, options = {}) =>
  details.fillDetails({ client, games: await Game.findNeedingDetails(), save: Game.updateDetails, remove: (id) => Game.removeMany([id]), ...options });

const detail = (overrides = {}) => ({
  description_raw: '설명 본문',
  website: 'https://example.com/official',
  developers: [{ name: 'Dev A' }],
  publishers: [{ name: 'Pub A' }],
  ...overrides,
});

describe('fillDetails', () => {
  test('설명, 개발사, 배급사, 공식 사이트를 채우고, 확인한 게임은 다시 부르지 않는다', async () => {
    const a = await createGame({ title: 'A', externalId: 1 });
    const asked = [];
    const client = { async getGame(id) { asked.push(id); return detail(); } };

    const stats = await run(client);
    assert.deepEqual(stats, { checked: 1, filled: 1, removedAdult: 0, failed: 0 });
    const saved = (await api('GET', `/api/games/${a.id}`)).body;
    assert.equal(saved.description, '설명 본문');
    assert.equal(saved.officialUrl, 'https://example.com/official');
    assert.deepEqual(saved.developers, ['Dev A']);
    assert.deepEqual(saved.publishers, ['Pub A']);

    assert.equal((await Game.findNeedingDetails()).length, 0);
    await run(client);
    assert.deepEqual(asked, [1]); // 두 번째 실행에서는 호출하지 않음
  });

  test('이미 설명이 있는 게임은 확인한 것으로 표시하고 건너뛴다', async () => {
    await createGame({ title: 'Has', externalId: 1, description: '이미 있음' });
    await createGame({ title: 'None', externalId: 2 });
    await Game.markExistingDetailsChecked();
    const need = await Game.findNeedingDetails();
    assert.deepEqual(need.map((g) => g.title), ['None']);
  });

  test('RAWG가 설명을 안 주면 이미 저장된 설명을 지우지 않는다', async () => {
    const a = await createGame({ title: 'A', externalId: 1, description: '기존 설명', officialUrl: 'https://old.example/' });
    const stats = await run({ async getGame() { return { description_raw: '', developers: [] }; } });
    assert.equal(stats.filled, 0);
    const saved = (await api('GET', `/api/games/${a.id}`)).body;
    assert.equal(saved.description, '기존 설명');
    assert.equal(saved.officialUrl, 'https://old.example/');
  });

  test('http가 아닌 공식 사이트 주소는 저장하지 않는다', async () => {
    const a = await createGame({ title: 'A', externalId: 1 });
    await run({ async getGame() { return detail({ website: 'javascript:alert(1)' }); } });
    assert.equal((await api('GET', `/api/games/${a.id}`)).body.officialUrl, null);
  });

  test('설명을 보니 성인물이면 삭제한다 (설명, 태그, 등급 모두)', async () => {
    await createGame({ title: 'Plain Title', externalId: 1 });
    await createGame({ title: 'Tagged', externalId: 2 });
    await createGame({ title: 'Rated', externalId: 3 });
    await createGame({ title: 'Fine', externalId: 4 });
    await ctx.pool.query("UPDATE games SET tags = ? WHERE title = 'Tagged'", [JSON.stringify(['NSFW'])]);
    await ctx.pool.query("UPDATE games SET esrb_rating = 'Adults Only' WHERE title = 'Rated'");

    const client = { async getGame(id) { return id === 1 ? detail({ description_raw: 'A hentai visual novel' }) : detail(); } };
    const stats = await run(client);
    assert.equal(stats.removedAdult, 3);
    assert.deepEqual((await api('GET', '/api/games')).body.map((g) => g.title), ['Fine']);
  });

  test('한 게임이 실패해도 계속하고, 실패한 게임은 다음에 다시 시도한다', async () => {
    const a = await createGame({ title: 'A', externalId: 1 });
    await createGame({ title: 'B', externalId: 2 });
    const stats = await run({ async getGame(id) { if (id === 1) throw new Error('일시 오류'); return detail(); } });
    assert.deepEqual(stats, { checked: 1, filled: 1, removedAdult: 0, failed: 1 });
    assert.deepEqual((await Game.findNeedingDetails()).map((g) => g.id), [a.id]);
  });

  test('키 오류나 한도 초과(fatal)는 멈춘다', async () => {
    await createGame({ title: 'A', externalId: 1 });
    await assert.rejects(run({ async getGame() { throw Object.assign(new Error('키 거절'), { fatal: true }); } }), /키 거절/);
  });

  test('externalId가 없는 직접 입력 게임은 대상이 아니다', async () => {
    await createGame({ title: 'Manual' });
    assert.equal((await Game.findNeedingDetails()).length, 0);
  });
});
