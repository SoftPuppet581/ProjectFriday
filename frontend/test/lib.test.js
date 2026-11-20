import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createApi, ApiError } from '../src/api/client.js';
import { toIso, parseIso, addDays, monthRange, shiftMonth, weekRange, dDay, monthKey } from '../src/lib/dates.js';
import { loadFavorites, saveFavorites, toggleFavorite, loadPlatform, savePlatform } from '../src/lib/storage.js';
import { trailerInfo } from '../src/lib/trailer.js';

describe('dates', () => {
  test('toIso/parseIso 왕복', () => {
    assert.equal(toIso(parseIso('2026-12-01')), '2026-12-01');
    assert.equal(toIso(new Date(2027, 0, 5)), '2027-01-05');
  });

  test('addDays는 월말과 연말을 넘는다', () => {
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(addDays('2027-03-01', -1), '2027-02-28');
    assert.equal(addDays('2028-03-01', -1), '2028-02-29'); // 윤년
  });

  test('monthRange는 말일까지', () => {
    assert.deepEqual(monthRange('2026-12'), { from: '2026-12-01', to: '2026-12-31' });
    assert.deepEqual(monthRange('2027-02'), { from: '2027-02-01', to: '2027-02-28' });
    assert.deepEqual(monthRange('2028-02'), { from: '2028-02-01', to: '2028-02-29' });
  });

  test('shiftMonth는 연도를 넘는다', () => {
    assert.equal(shiftMonth('2026-12', 1), '2027-01');
    assert.equal(shiftMonth('2027-01', -1), '2026-12');
    assert.equal(shiftMonth('2026-05', 13), '2027-06');
  });

  test('weekRange: 월요일 시작 (기본)', () => {
    // 2026-11-20은 금요일
    assert.deepEqual(weekRange('2026-11-20'), { from: '2026-11-16', to: '2026-11-22' });
    assert.deepEqual(weekRange('2026-11-16'), { from: '2026-11-16', to: '2026-11-22' }); // 월요일 당일
    assert.deepEqual(weekRange('2026-11-22'), { from: '2026-11-16', to: '2026-11-22' }); // 일요일
  });

  test('weekRange: 일요일 시작, 월 경계', () => {
    assert.deepEqual(weekRange('2026-11-20', 0), { from: '2026-11-15', to: '2026-11-21' });
    assert.deepEqual(weekRange('2026-12-31'), { from: '2026-12-28', to: '2027-01-03' });
  });

  test('dDay', () => {
    const today = new Date(2026, 10, 20, 23, 59); // 늦은 밤이어도 날짜 기준
    assert.deepEqual(dDay('2026-11-20', today), { days: 0, label: '오늘 출시' });
    assert.deepEqual(dDay('2026-12-01', today), { days: 11, label: 'D-11' });
    assert.deepEqual(dDay('2026-11-19', today), { days: -1, label: 'D+1' });
    assert.equal(dDay('2027-01-01', today).days, 42);
  });

  test('dDay는 서머타임 전환 구간에서도 정수 일수', () => {
    assert.equal(Number.isInteger(dDay('2027-03-30', new Date(2027, 2, 20)).days), true);
    assert.equal(dDay('2027-03-30', new Date(2027, 2, 20)).days, 10);
  });

  test('monthKey', () => {
    assert.equal(monthKey('2026-12-01'), '2026-12');
  });
});

describe('storage', () => {
  const memory = () => {
    const data = new Map();
    return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) };
  };

  test('즐겨찾기 저장/불러오기', () => {
    const s = memory();
    assert.deepEqual(loadFavorites(s), []);
    saveFavorites([3, 1], s);
    assert.deepEqual(loadFavorites(s), [3, 1]);
  });

  test('깨진 값이나 잘못된 값은 걸러낸다', () => {
    const s = memory();
    s.setItem('gamecal.favorites', '{깨짐');
    assert.deepEqual(loadFavorites(s), []);
    s.setItem('gamecal.favorites', '[1,"a",-2,2.5,4]');
    assert.deepEqual(loadFavorites(s), [1, 4]);
    s.setItem('gamecal.favorites', '{"a":1}');
    assert.deepEqual(loadFavorites(s), []);
  });

  test('저장소가 없거나 예외를 던져도 에러가 나지 않는다', () => {
    const broken = { getItem: () => { throw new Error('막힘'); }, setItem: () => { throw new Error('막힘'); }, removeItem: () => { throw new Error('막힘'); } };
    assert.deepEqual(loadFavorites(broken), []);
    assert.doesNotThrow(() => saveFavorites([1], broken));
    assert.equal(loadPlatform(broken), null);
    assert.doesNotThrow(() => savePlatform('PC', broken));
    assert.deepEqual(loadFavorites(undefined), []);
  });

  test('toggleFavorite는 원본을 바꾸지 않는다', () => {
    const ids = [1, 2];
    assert.deepEqual(toggleFavorite(ids, 3), [1, 2, 3]);
    assert.deepEqual(toggleFavorite(ids, 1), [2]);
    assert.deepEqual(ids, [1, 2]);
  });

  test('내 플랫폼 저장/해제', () => {
    const s = memory();
    assert.equal(loadPlatform(s), null);
    savePlatform('PC', s);
    assert.equal(loadPlatform(s), 'PC');
    savePlatform(null, s);
    assert.equal(loadPlatform(s), null);
  });
});

describe('trailerInfo', () => {
  test('mp4 파일은 video', () => {
    assert.deepEqual(trailerInfo({ trailerUrl: 'https://x.com/a.mp4?token=1' }), { kind: 'video', src: 'https://x.com/a.mp4?token=1' });
  });

  test('YouTube 주소는 embed 주소로 바꾼다', () => {
    const embed = { kind: 'youtube', src: 'https://www.youtube.com/embed/dQw4w9WgXcQ' };
    assert.deepEqual(trailerInfo({ trailerUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }), embed);
    assert.deepEqual(trailerInfo({ trailerUrl: 'https://www.youtube.com/watch?feature=x&v=dQw4w9WgXcQ' }), embed);
    assert.deepEqual(trailerInfo({ trailerUrl: 'https://youtu.be/dQw4w9WgXcQ' }), embed);
    assert.deepEqual(trailerInfo({ trailerUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' }), embed);
  });

  test('모르는 주소는 link, 영상이 없으면 검색 링크, 둘 다 없으면 none', () => {
    assert.equal(trailerInfo({ trailerUrl: 'https://example.com/page' }).kind, 'link');
    assert.deepEqual(trailerInfo({ trailerUrl: null, trailerSearchUrl: 'https://youtube.com/results?x' }), { kind: 'search', src: 'https://youtube.com/results?x' });
    assert.deepEqual(trailerInfo({ trailerUrl: null }), { kind: 'none', src: null });
    assert.equal(trailerInfo(null).kind, 'none');
  });
});

describe('api client', () => {
  const res = (status, body, headers = {}) => ({
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (k) => headers[k] ?? null },
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  });

  const make = (handler) => {
    const calls = [];
    const api = createApi({ baseUrl: 'http://test', fetchImpl: async (url, options) => (calls.push({ url, options }), handler(url, options)) });
    return { api, calls };
  };

  test('listGames: 쿼리 조립, 빈 값 제외, 배열은 쉼표, 전체 개수 헤더', async () => {
    const { api, calls } = make(() => res(200, [{ id: 1 }], { 'X-Total-Count': '42' }));
    const out = await api.listGames({ month: '2026-12', platform: undefined, genre: '', ids: [1, 2, 3], limit: 10 });
    assert.deepEqual(out, { items: [{ id: 1 }], total: 42 });
    assert.equal(calls[0].url, 'http://test/api/games?month=2026-12&ids=1%2C2%2C3&limit=10');
    assert.equal(calls[0].options.method, 'GET');
  });

  test('헤더가 없으면 배열 길이를 total로 쓴다', async () => {
    const { api } = make(() => res(200, [{ id: 1 }, { id: 2 }]));
    assert.equal((await api.listGames()).total, 2);
  });

  test('calendar, genres, platforms, similarGames, getGame', async () => {
    const { api, calls } = make(() => res(200, []));
    await api.calendar({ month: '2026-12', top: 3 });
    await api.genres();
    await api.platforms();
    await api.similarGames(7, 4);
    await api.getGame(7);
    assert.deepEqual(calls.map((c) => c.url), [
      'http://test/api/calendar?month=2026-12&top=3',
      'http://test/api/genres',
      'http://test/api/platforms',
      'http://test/api/games/7/similar?limit=4',
      'http://test/api/games/7',
    ]);
  });

  test('POST/PUT/PATCH는 JSON 본문을 보낸다', async () => {
    const { api, calls } = make(() => res(201, { id: 5 }));
    await api.createGame({ title: 'x' });
    await api.patchGame(5, { genre: 'RPG' });
    assert.equal(calls[0].options.method, 'POST');
    assert.equal(calls[0].options.headers['Content-Type'], 'application/json');
    assert.equal(calls[0].options.body, '{"title":"x"}');
    assert.equal(calls[1].options.method, 'PATCH');
  });

  test('DELETE 204는 null', async () => {
    const { api } = make(() => res(204));
    assert.equal(await api.deleteGame(1), null);
  });

  test('에러 응답은 ApiError(status, message, errors)로 던진다', async () => {
    const { api } = make(() => res(400, { message: '입력값이 올바르지 않습니다.', errors: [{ field: 'month', message: '형식' }] }));
    await assert.rejects(api.calendar({ month: 'x' }), (e) => {
      assert.ok(e instanceof ApiError);
      assert.equal(e.status, 400);
      assert.equal(e.message, '입력값이 올바르지 않습니다.');
      assert.deepEqual(e.errors, [{ field: 'month', message: '형식' }]);
      return true;
    });
  });

  test('본문이 JSON이 아닌 에러도 ApiError', async () => {
    const { api } = make(() => ({ status: 500, ok: false, headers: { get: () => null }, text: async () => '<html>' }));
    await assert.rejects(api.getGame(1), (e) => e instanceof ApiError && e.status === 500);
  });

  test('서버가 꺼져 있으면 status 0인 ApiError', async () => {
    const api = createApi({ baseUrl: 'http://test', fetchImpl: async () => { throw new TypeError('fetch failed'); } });
    await assert.rejects(api.genres(), (e) => e instanceof ApiError && e.status === 0 && /백엔드/.test(e.message));
  });

  test('icsUrl', () => {
    assert.equal(createApi({ baseUrl: 'http://test' }).icsUrl(9), 'http://test/api/games/9/calendar.ics');
  });
});
