// 스토어 링크, Steam 가격, 바로 가기 링크 테스트. 실제 RAWG/Steam 서버는 부르지 않고 가짜 응답을 쓴다.
// 가짜 응답의 모양은 실제 응답을 직접 확인한 것을 그대로 옮겼다. (예: Steam은 금액을 100배 정수로 준다)
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup, sample } from './helpers.js';

let ctx;
let Game;
let stores;
let steam;
const api = (...args) => ctx.api(...args);

before(async () => {
  ctx = await setup();
  Game = await import('../src/models/Game.js');
  stores = await import('../src/services/storesService.js');
  steam = await import('../src/services/steamPriceService.js');
});
after(async () => {
  await ctx.teardown();
});
beforeEach(async () => {
  await ctx.pool.query('TRUNCATE TABLE games');
});

describe('mapStores / steamAppIdFrom', () => {
  test('Steam을 먼저, 알려진 스토어 이름으로, 중복과 위험한 주소는 제거', () => {
    const result = stores.mapStores([
      { store_id: 3, url: 'https://store.playstation.com/en-ca/product/EP1004' },
      { store_id: 1, url: 'https://store.steampowered.com/app/10/' },
      { store_id: 99, url: 'https://other.example/g' },
      { store_id: 1, url: 'https://store.steampowered.com/app/10/' }, // 중복
      { store_id: 5, url: 'javascript:alert(1)' },
      { store_id: 5, url: 'ftp://x.example/a' },
      { store_id: 11, url: `https://store.epicgames.com/${'a'.repeat(600)}` }, // 너무 긴 주소
    ]);
    assert.deepEqual(result, [
      { name: 'Steam', url: 'https://store.steampowered.com/app/10/' },
      { name: 'PlayStation Store', url: 'https://store.playstation.com/en-ca/product/EP1004' },
      { name: '기타 스토어', url: 'https://other.example/g' },
    ]);
  });

  test('추적용 파라미터를 지운다: Steam은 쿼리 전체, 나머지는 추적 키만', () => {
    assert.equal(stores.cleanStoreUrl('https://store.steampowered.com/app/3768760/007_First_Light/?curator_clanid=4777282'), 'https://store.steampowered.com/app/3768760/007_First_Light/');
    assert.equal(stores.cleanStoreUrl('https://store.steampowered.com/app/1/?l=koreana#reviews'), 'https://store.steampowered.com/app/1/');
    assert.equal(
      stores.cleanStoreUrl('https://store.epicgames.com/p/game?utm_source=x&utm_medium=y&lang=ko&fbclid=abc&ref=home'),
      'https://store.epicgames.com/p/game?lang=ko', // 언어 같은 의미 있는 파라미터는 남긴다
    );
    assert.equal(stores.cleanStoreUrl('https://store.playstation.com/en-ca/product/EP1004_00'), 'https://store.playstation.com/en-ca/product/EP1004_00');
    assert.equal(stores.cleanStoreUrl('not a url'), 'not a url');
  });

  test('mapStores는 정리한 뒤의 주소로 중복을 판단하고 정리된 주소를 돌려준다', () => {
    const result = stores.mapStores([
      { store_id: 1, url: 'https://store.steampowered.com/app/10/Name/?curator_clanid=1' },
      { store_id: 1, url: 'https://store.steampowered.com/app/10/Name/' },
    ]);
    assert.deepEqual(result, [{ name: 'Steam', url: 'https://store.steampowered.com/app/10/Name/' }]);
    assert.equal(stores.steamAppIdFrom(result), 10);
  });

  test('값이 이상해도 에러 없이 빈 배열', () => {
    assert.deepEqual(stores.mapStores(undefined), []);
    assert.deepEqual(stores.mapStores(null), []);
    assert.deepEqual(stores.mapStores([null, {}, { store_id: 1 }]), []);
  });

  test('Steam 앱 번호 추출 (뒤에 이름이 있든 없든), Steam이 아니면 null', () => {
    const app = (url) => stores.steamAppIdFrom([{ name: 'x', url }]);
    assert.equal(app('https://store.steampowered.com/app/3764200/Resident_Evil_Requiem/'), 3764200);
    assert.equal(app('https://store.steampowered.com/app/892970/'), 892970);
    assert.equal(app('https://store.playstation.com/en-ca/product/app/123'), null);
    assert.equal(app('https://store.steampowered.com/bundle/55/'), null);
    assert.equal(stores.steamAppIdFrom([]), null);
  });
});

describe('parsePriceOverview', () => {
  const overview = (o) => ({ currency: 'KRW', initial: 4290000, final: 4290000, discount_percent: 0, initial_formatted: '', final_formatted: '₩ 42,900', ...o });

  test('실제 응답 그대로: 4290000은 ₩42,900', () => {
    assert.deepEqual(steam.parsePriceOverview(overview()), { currency: 'KRW', final: 42900, initial: 42900, discountPercent: 0, formatted: '₩ 42,900' });
  });

  test('할인 중이면 할인율과 원래 가격을 함께', () => {
    const sale = steam.parsePriceOverview(overview({ initial: 5990000, final: 4192000, discount_percent: 30, final_formatted: '₩ 41,920' }));
    assert.deepEqual(sale, { currency: 'KRW', final: 41920, initial: 59900, discountPercent: 30, formatted: '₩ 41,920' });
  });

  test('원화가 아니거나 값이 이상하면 가격을 만들지 않는다', () => {
    assert.equal(steam.parsePriceOverview(overview({ currency: 'USD' })), null);
    assert.equal(steam.parsePriceOverview(overview({ final: 'abc' })), null);
    assert.equal(steam.parsePriceOverview(overview({ final: 4290050 })), null); // 100으로 나누어떨어지지 않음
    assert.equal(steam.parsePriceOverview(overview({ final: 5000000, initial: 4000000 })), null); // 할인가가 원가보다 큼
    assert.equal(steam.parsePriceOverview(null), null);
    assert.equal(steam.parsePriceOverview(undefined), null);
  });

  test('formatted가 비어 있으면 숫자로 만든다', () => {
    assert.equal(steam.parsePriceOverview(overview({ final_formatted: '' })).formatted, '₩ 42,900');
  });
});

describe('fetchSteamPrices', () => {
  const noWait = { delayMs: 0, sleep: async () => {} };
  const priced = (won) => ({ success: true, data: { price_overview: { currency: 'KRW', initial: won * 100, final: won * 100, discount_percent: 0, final_formatted: `₩ ${won}` } } });

  test('앱을 묶음으로 조회하고 요청 주소에 원화/한국어/가격 필터가 들어간다', async () => {
    const urls = [];
    const fetchImpl = async (url) => {
      urls.push(url);
      const ids = url.searchParams.get('appids').split(',');
      return { ok: true, status: 200, json: async () => Object.fromEntries(ids.map((id) => [id, priced(Number(id) * 10)])) };
    };
    const ids = Array.from({ length: 45 }, (_, i) => i + 1);
    const prices = await steam.fetchSteamPrices(ids, { fetchImpl, batchSize: 20, ...noWait });

    assert.equal(urls.length, 3); // 20 + 20 + 5
    assert.equal(urls[0].searchParams.get('cc'), 'kr');
    assert.equal(urls[0].searchParams.get('filters'), 'price_overview');
    assert.equal(urls[0].searchParams.get('l'), 'koreana');
    assert.equal(urls[2].searchParams.get('appids'), '41,42,43,44,45');
    assert.equal(prices.size, 45);
    assert.equal(prices.get(7).final, 70);
  });

  test('가격이 없는 앱은 null, 응답에 아예 없는 앱은 Map에 없다, 중복 번호는 한 번만', async () => {
    const calls = [];
    const fetchImpl = async (url) => {
      calls.push(url.searchParams.get('appids'));
      return {
        ok: true,
        status: 200,
        json: async () => ({ 1: priced(1000), 2: { success: true, data: [] }, 3: { success: false } }), // 4는 응답에 없음
      };
    };
    const prices = await steam.fetchSteamPrices([1, 2, 3, 4, 1], { fetchImpl, ...noWait });
    assert.deepEqual(calls, ['1,2,3,4']);
    assert.equal(prices.get(1).final, 1000);
    assert.equal(prices.get(2), null);
    assert.equal(prices.get(3), null);
    assert.equal(prices.has(4), false);
  });

  test('429와 403은 치명적 에러로 멈춘다', async () => {
    for (const status of [429, 403]) {
      await assert.rejects(
        steam.fetchSteamPrices([1], { fetchImpl: async () => ({ ok: false, status }), ...noWait }),
        (error) => error.fatal === true && /Steam/.test(error.message),
      );
    }
  });

  test('한 묶음이 실패(HTTP 500, 네트워크 오류, 깨진 JSON)해도 나머지는 계속한다', async () => {
    let call = 0;
    const fetchImpl = async (url) => {
      call += 1;
      if (call === 1) return { ok: false, status: 500 };
      if (call === 2) throw new TypeError('network');
      if (call === 3) return { ok: true, status: 200, json: async () => { throw new SyntaxError('bad json'); } };
      const ids = url.searchParams.get('appids').split(',');
      return { ok: true, status: 200, json: async () => Object.fromEntries(ids.map((id) => [id, priced(500)])) };
    };
    const logs = [];
    const prices = await steam.fetchSteamPrices([1, 2, 3, 4], { fetchImpl, batchSize: 1, log: (m) => logs.push(m), ...noWait });
    assert.deepEqual([...prices.keys()], [4]);
    assert.equal(logs.length, 3);
  });
});

describe('fetchSteamIsFree', () => {
  const noWait = { delayMs: 0, sleep: async () => {} };
  const reply = (id, data) => ({ ok: true, status: 200, json: async () => ({ [id]: data }) });

  test('앱을 한 개씩 조회하고 is_free를 Map으로 돌려준다 (filters=basic)', async () => {
    const urls = [];
    const fetchImpl = async (url) => {
      urls.push(url);
      const id = url.searchParams.get('appids');
      if (id === '1') return reply(1, { success: true, data: { is_free: true } });
      if (id === '2') return reply(2, { success: true, data: { is_free: false } });
      return reply(3, { success: false });
    };
    const result = await steam.fetchSteamIsFree([1, 2, 3, 1], { fetchImpl, ...noWait });
    assert.equal(urls.length, 3); // 중복은 한 번만
    assert.equal(urls[0].searchParams.get('filters'), 'basic');
    assert.equal(urls[0].searchParams.get('cc'), 'kr');
    assert.deepEqual([...result], [[1, true], [2, false]]); // success:false인 3은 모르는 것이라 없음
  });

  test('실패한 앱은 건너뛰고, 429는 멈춘다', async () => {
    let call = 0;
    const fetchImpl = async (url) => {
      call += 1;
      if (call === 1) throw new TypeError('network');
      if (call === 2) return { ok: false, status: 500 };
      return reply(Number(url.searchParams.get('appids')), { success: true, data: { is_free: true } });
    };
    const result = await steam.fetchSteamIsFree([1, 2, 3], { fetchImpl, ...noWait });
    assert.deepEqual([...result.keys()], [3]);
    await assert.rejects(steam.fetchSteamIsFree([1], { fetchImpl: async () => ({ ok: false, status: 429 }), ...noWait }), (e) => e.fatal === true);
  });
});

describe('스토어/가격 저장과 API', () => {
  const createGame = async (overrides = {}) => (await api('POST', '/api/games', sample(overrides))).body;

  test('enrichStores: 확인 안 한 게임만 처리하고, 스토어가 없으면 []로 남겨 다시 부르지 않는다', async () => {
    const a = await createGame({ title: 'A', externalId: 101 });
    const b = await createGame({ title: 'B', externalId: 102 });
    const c = await createGame({ title: 'C', externalId: 103 });
    await Game.updateStores(c.id, [{ name: 'GOG', url: 'https://gog.com/c' }], null); // 이미 확인함

    const asked = [];
    const client = {
      async getStores(externalId) {
        asked.push(externalId);
        if (externalId === 101) return { results: [{ store_id: 1, url: 'https://store.steampowered.com/app/555/A/' }, { store_id: 3, url: 'https://store.playstation.com/a' }] };
        return { results: [] };
      },
    };
    const games = await Game.findNeedingStores();
    assert.deepEqual(games.map((g) => g.title).sort(), ['A', 'B']);
    const stats = await stores.enrichStores({ client, games, save: Game.updateStores });
    assert.deepEqual(stats, { checked: 2, withStores: 1, withSteam: 1, failed: 0 });
    assert.deepEqual(asked.sort(), [101, 102]);

    const ga = (await api('GET', `/api/games/${a.id}`)).body;
    assert.deepEqual(ga.stores.map((s) => s.name), ['Steam', 'PlayStation Store']);
    assert.equal(ga.steamAppId, 555);
    assert.equal(ga.steamStoreUrl, 'https://store.steampowered.com/app/555/');
    assert.equal(ga.steamClientUrl, 'steam://store/555');
    const gb = (await api('GET', `/api/games/${b.id}`)).body;
    assert.deepEqual(gb.stores, []);
    assert.equal(gb.steamStoreUrl, null);
    assert.equal(gb.steamClientUrl, null);
    assert.equal((await Game.findNeedingStores()).length, 0); // 다음에는 아무것도 다시 부르지 않는다
  });

  test('enrichStores: 한 게임 실패는 건너뛰고, 치명적 오류는 멈춘다', async () => {
    const a = await createGame({ title: 'A', externalId: 201 });
    const b = await createGame({ title: 'B', externalId: 202 });
    const flaky = { async getStores(id) { if (id === 201) throw new Error('일시 오류'); return { results: [] }; } };
    const stats = await stores.enrichStores({ client: flaky, games: await Game.findNeedingStores(), save: Game.updateStores });
    assert.equal(stats.failed, 1);
    assert.equal(stats.checked, 1);
    assert.equal((await Game.findNeedingStores()).map((g) => g.id)[0], a.id); // 실패한 건 다음에 다시 시도

    const fatal = { async getStores() { throw Object.assign(new Error('키 거절'), { fatal: true }); } };
    await assert.rejects(stores.enrichStores({ client: fatal, games: [{ id: b.id, externalId: 202 }], save: Game.updateStores }), /키 거절/);
  });

  test('refreshPrices: 가격을 저장하고 API에 price 객체로 나온다. 가격이 없으면 null', async () => {
    const a = await createGame({ title: 'A', externalId: 301 });
    const b = await createGame({ title: 'B', externalId: 302 });
    const c = await createGame({ title: 'C', externalId: 303 });
    await Game.updateStores(a.id, [], 1001);
    await Game.updateStores(b.id, [], 1002);
    await Game.updateStores(c.id, [], 1003);

    const fetchPrices = async () =>
      new Map([
        [1001, { currency: 'KRW', final: 41920, initial: 59900, discountPercent: 30, formatted: '₩ 41,920' }],
        [1002, null], // 가격 없음 (출시 전 등)
        // 1003은 응답에 없음 → 건드리지 않는다
      ]);
    const fetchFree = async () => new Map([[1002, false]]); // 무료는 아님
    const stats = await steam.refreshPrices({ games: await Game.findWithSteamApp(), fetchPrices, fetchFree, save: Game.updatePrice });
    assert.deepEqual(stats, { checked: 3, priced: 1, free: 0, noPrice: 1, unknown: 1 });

    const ga = (await api('GET', `/api/games/${a.id}`)).body;
    assert.deepEqual({ ...ga.price, updatedAt: undefined }, { currency: 'KRW', final: 41920, initial: 59900, discountPercent: 30, formatted: '₩ 41,920', onSale: true, updatedAt: undefined });
    assert.match(ga.price.updatedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    for (const flat of ['priceFinal', 'priceInitial', 'priceCurrency', 'priceFormatted', 'priceUpdatedAt', 'priceDiscountPercent']) {
      assert.equal(flat in ga, false, `${flat}는 price 객체 안에만 있어야 함`);
    }
    assert.equal((await api('GET', `/api/games/${b.id}`)).body.price, null);
    assert.equal((await api('GET', `/api/games/${c.id}`)).body.price, null);
  });

  test('refreshPrices: 가격이 없는 앱 중 Steam이 무료라고 하는 것만 "무료"로, 나머지는 null', async () => {
    const free = await createGame({ title: 'Free', externalId: 701 });
    const soon = await createGame({ title: 'Soon', externalId: 702 });
    const unclear = await createGame({ title: 'Unclear', externalId: 703 });
    const paid = await createGame({ title: 'Paid', externalId: 704 });
    await Game.updateStores(free.id, [], 3001);
    await Game.updateStores(soon.id, [], 3002);
    await Game.updateStores(unclear.id, [], 3003);
    await Game.updateStores(paid.id, [], 3004);

    const asked = [];
    const fetchPrices = async () => new Map([[3001, null], [3002, null], [3003, null], [3004, { currency: 'KRW', final: 9000, initial: 9000, discountPercent: 0, formatted: '₩ 9,000' }]]);
    const fetchFree = async (ids) => {
      asked.push(...ids);
      return new Map([[3001, true], [3002, false]]); // 3003은 조회 실패
    };
    const stats = await steam.refreshPrices({ games: await Game.findWithSteamApp(), fetchPrices, fetchFree, save: Game.updatePrice });

    assert.deepEqual(stats, { checked: 4, priced: 1, free: 1, noPrice: 2, unknown: 0 });
    assert.deepEqual(asked.sort(), [3001, 3002, 3003]); // 가격이 있는 앱은 다시 묻지 않는다
    const get = async (g) => (await api('GET', `/api/games/${g.id}`)).body.price;
    const freePrice = await get(free);
    assert.equal(freePrice.final, 0);
    assert.equal(freePrice.formatted, '무료');
    assert.equal(freePrice.onSale, false);
    assert.equal(await get(soon), null);
    assert.equal(await get(unclear), null);
    assert.equal((await get(paid)).final, 9000);
  });

  test('refreshPrices: 가격이 없는 앱이 하나도 없으면 무료 조회를 아예 하지 않는다', async () => {
    const a = await createGame({ title: 'A', externalId: 801 });
    await Game.updateStores(a.id, [], 4001);
    let called = false;
    await steam.refreshPrices({
      games: await Game.findWithSteamApp(),
      fetchPrices: async () => new Map([[4001, { currency: 'KRW', final: 1000, initial: 1000, discountPercent: 0, formatted: '₩ 1,000' }]]),
      fetchFree: async () => { called = true; return new Map(); },
      save: Game.updatePrice,
    });
    assert.equal(called, false);
  });

  test('가격이 사라지면(null) 이전 가격을 지운다', async () => {
    const a = await createGame({ title: 'A', externalId: 401 });
    await Game.updateStores(a.id, [], 2001);
    await Game.updatePrice(a.id, { currency: 'KRW', final: 1000, initial: 1000, discountPercent: 0, formatted: '₩ 1,000' });
    assert.equal((await api('GET', `/api/games/${a.id}`)).body.price.final, 1000);
    await Game.updatePrice(a.id, null);
    assert.equal((await api('GET', `/api/games/${a.id}`)).body.price, null);
  });

  test('할인이 없으면 onSale=false, 무료(0원)도 가격 객체로 나온다', async () => {
    const a = await createGame({ title: 'A', externalId: 501 });
    await Game.updatePrice(a.id, { currency: 'KRW', final: 0, initial: 0, discountPercent: 0, formatted: '무료' });
    const price = (await api('GET', `/api/games/${a.id}`)).body.price;
    assert.equal(price.final, 0);
    assert.equal(price.onSale, false);
  });

  test('PUT/PATCH로 게임을 고쳐도 스토어와 가격은 지워지지 않는다', async () => {
    const a = await createGame({ title: 'A', externalId: 601 });
    await Game.updateStores(a.id, [{ name: 'Steam', url: 'https://store.steampowered.com/app/9/' }], 9);
    await Game.updatePrice(a.id, { currency: 'KRW', final: 5000, initial: 5000, discountPercent: 0, formatted: '₩ 5,000' });

    await api('PUT', `/api/games/${a.id}`, sample({ title: 'A', externalId: 601, genre: 'RPG' }));
    await api('PATCH', `/api/games/${a.id}`, { description: '바뀜' });
    const after = (await api('GET', `/api/games/${a.id}`)).body;
    assert.equal(after.price.final, 5000);
    assert.equal(after.steamAppId, 9);
    assert.equal(after.stores.length, 1);
  });

  test('API로 스토어/가격을 직접 쓰려 하면 400 (읽기 전용)', async () => {
    for (const body of [{ stores: [] }, { price: { final: 1 } }, { steamAppId: 5 }, { priceFinal: 1 }]) {
      const res = await api('POST', '/api/games', sample({ title: 'X', ...body }));
      assert.equal(res.status, 400, JSON.stringify(body));
    }
  });

  test('바로 가기 링크: Steam 검색과 뉴스 검색은 제목으로 만든 주소 (특수문자 인코딩)', async () => {
    const game = await createGame({ title: "Marvel's Wolverine & 친구들" });
    assert.equal(game.steamSearchUrl, `https://store.steampowered.com/search/?term=${encodeURIComponent("Marvel's Wolverine & 친구들")}`);
    assert.equal(game.newsSearchUrl, `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent("Marvel's Wolverine & 친구들 게임")}`);
    assert.equal(game.steamStoreUrl, null);
    assert.deepEqual(game.stores, []);
    assert.equal(game.price, null);
  });

  test('목록, 달력용 상세, 비슷한 게임, 대작 API에도 같은 필드가 들어간다', async () => {
    const a = await createGame({ title: 'A', genres: ['RPG'] });
    await createGame({ title: 'B', genres: ['RPG'] });
    await Game.updateStores(a.id, [{ name: 'Steam', url: 'https://store.steampowered.com/app/7/' }], 7);
    await api('PATCH', `/api/games/${a.id}`, { featuredOrder: 1 });

    const list = (await api('GET', '/api/games')).body;
    assert.ok(list.every((g) => 'price' in g && 'stores' in g && 'steamSearchUrl' in g && 'newsSearchUrl' in g));
    assert.equal((await api('GET', '/api/featured')).body[0].steamStoreUrl, 'https://store.steampowered.com/app/7/');
    const similar = (await api('GET', `/api/games/${list.find((g) => g.title === 'B').id}/similar`)).body;
    assert.equal(similar[0].steamAppId, 7);
  });
});
