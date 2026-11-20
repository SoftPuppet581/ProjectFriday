import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseApi } from '../src/api/supabaseApi.js';
import { ApiError } from '../src/api/errors.js';

const URL_ROOT = 'https://proj.supabase.test';
const ANON = 'anon-key-test';
const SESSION_KEY = 'gamecal.sb';
const T0 = 1_700_000_000_000;
const UID = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';

const res = (status, body) => ({ status, ok: status >= 200 && status < 300, text: async () => (body === undefined || body === null ? '' : typeof body === 'string' ? body : JSON.stringify(body)) });

const memoryStorage = (initial = {}) => {
  const map = new Map(Object.entries(initial));
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k), map };
};

const storedSession = (over = {}) => JSON.stringify({ accessToken: 'AT', refreshToken: 'RT', expiresAt: T0 + 3_600_000, user: { id: UID, email: 'a@b.co' }, ...over });

const fbRow = (over = {}) => ({
  id: 1, rating: 5, comment: '좋아요', created_at: '2026-11-01T00:00:00Z', user_id: UID, nickname: '저장닉',
  profiles: { id: UID, display_name: '현재닉', avatar: 'a03' }, ...over,
});

function make({ handler = () => res(200, []), session, clock = { t: T0 } } = {}) {
  const calls = [];
  const storage = memoryStorage(session ? { [SESSION_KEY]: session } : {});
  const base = { listGames: async () => ({ items: [], total: 0 }) };
  const fetchImpl = async (url, init) => {
    const call = { url, path: url.replace(URL_ROOT, ''), method: init.method, headers: init.headers, body: init.body === undefined ? undefined : JSON.parse(init.body) };
    calls.push(call);
    return handler(call.path, init, call) ?? res(404, { message: 'nope' });
  };
  const api = createSupabaseApi({ url: `${URL_ROOT}/`, anonKey: ANON, base, fetchImpl, storage, now: () => clock.t });
  return { api, calls, storage, clock };
}

const rejects = (promise, status, extra) => assert.rejects(promise, (e) => {
  assert.ok(e instanceof ApiError, `ApiError expected, got ${e}`);
  assert.equal(e.status, status);
  if (extra) extra(e);
  return true;
});

const query = (call) => new URL(call.url).searchParams;

// 목록 + 요약을 돌려주는 기본 핸들러
const listHandler = (rows, summary) => (p) => (p.startsWith('/rest/v1/rpc/feedback_summary') ? res(200, summary) : p.startsWith('/rest/v1/feedback') ? res(200, rows) : undefined);

describe('피드백 API: listFeedback', () => {
  test('최신순 정렬, page로 limit/offset 계산, 요약은 POST rpc/feedback_summary', async () => {
    const { api, calls } = make({ handler: listHandler([fbRow()], [{ total: 1, average: 5 }]) });
    await api.listFeedback({ limit: 10, page: 3 });
    const list = calls.find((c) => c.path.startsWith('/rest/v1/feedback?'));
    const rpc = calls.find((c) => c.path.startsWith('/rest/v1/rpc/feedback_summary'));
    assert.equal(list.method, 'GET');
    assert.equal(query(list).get('order'), 'created_at.desc,id.desc');
    assert.equal(query(list).get('limit'), '10');
    assert.equal(query(list).get('offset'), '20');
    assert.equal(rpc.method, 'POST');
    assert.equal(rpc.path, '/rest/v1/rpc/feedback_summary');
  });

  test('기본값은 limit 20, offset 0', async () => {
    const { api, calls } = make({ handler: listHandler([], [{ total: 0, average: null }]) });
    await api.listFeedback();
    const list = calls.find((c) => c.path.startsWith('/rest/v1/feedback?'));
    assert.equal(query(list).get('limit'), '20');
    assert.equal(query(list).get('offset'), '0');
  });

  test('항목 모양 {id,rating,comment,author{id,displayName,avatar},createdAt,mine}', async () => {
    const { api } = make({ session: storedSession(), handler: listHandler([fbRow()], [{ total: 7, average: '4.5' }]) });
    const r = await api.listFeedback();
    assert.deepEqual(r.items[0], {
      id: 1, rating: 5, comment: '좋아요', author: { id: UID, displayName: '현재닉', avatar: 'a03' }, createdAt: '2026-11-01T00:00:00Z', mine: true,
    });
    assert.equal(r.total, 7);
    assert.equal(r.average, 4.5);
  });

  test('프로필이 있으면 display_name, 없으면 저장된 nickname', async () => {
    const rows = [fbRow({ id: 1 }), fbRow({ id: 2, user_id: OTHER, profiles: null, nickname: '저장닉' })];
    const { api } = make({ handler: listHandler(rows, [{ total: 2, average: 4 }]) });
    const { items } = await api.listFeedback();
    assert.equal(items[0].author.displayName, '현재닉');
    assert.equal(items[1].author.displayName, '저장닉');
    assert.equal(items[1].author.id, OTHER);
    assert.equal(items[1].author.avatar, null);
  });

  test('이메일은 결과 어디에도 없다', async () => {
    const rows = [fbRow({ email: 'leak@x.co', profiles: { id: UID, display_name: '닉', avatar: null, email: 'leak@x.co' } })];
    const { api } = make({ session: storedSession(), handler: listHandler(rows, [{ total: 1, average: 5 }]) });
    const r = await api.listFeedback();
    assert.ok(!JSON.stringify(r).includes('@'));
  });

  test('글이 없으면 average는 null, total은 0', async () => {
    const { api } = make({ handler: listHandler([], [{ total: 0, average: null }]) });
    const r = await api.listFeedback();
    assert.deepEqual(r, { items: [], total: 0, average: null });
  });

  test('요약 응답이 비어 있어도 average null, total은 목록 길이', async () => {
    const { api } = make({ handler: listHandler([fbRow()], []) });
    const r = await api.listFeedback();
    assert.equal(r.average, null);
    assert.equal(r.total, 1);
  });

  test('mine은 로그인한 본인 id일 때만 true (비로그인이면 모두 false)', async () => {
    const rows = [fbRow({ id: 1, user_id: UID }), fbRow({ id: 2, user_id: OTHER })];
    const summary = [{ total: 2, average: 4 }];
    const loggedIn = make({ session: storedSession(), handler: listHandler(rows, summary) });
    assert.deepEqual((await loggedIn.api.listFeedback()).items.map((i) => i.mine), [true, false]);
    const anon = make({ handler: listHandler(rows, summary) });
    assert.deepEqual((await anon.api.listFeedback()).items.map((i) => i.mine), [false, false]);
  });

  test('비로그인 읽기는 anon 키, 로그인이면 사용자 토큰', async () => {
    const anon = make({ handler: listHandler([], [{ total: 0, average: null }]) });
    await anon.api.listFeedback();
    assert.equal(anon.calls[0].headers.apikey, ANON);
    assert.equal(anon.calls[0].headers.Authorization, `Bearer ${ANON}`);
    const user = make({ session: storedSession(), handler: listHandler([], [{ total: 0, average: null }]) });
    await user.api.listFeedback();
    assert.equal(user.calls[0].headers.Authorization, 'Bearer AT');
  });
});

describe('피드백 API: createFeedback', () => {
  const ok = { rating: 4, comment: '재밌어요' };
  const bad = [
    ['별점 0', { rating: 0 }, 'rating'],
    ['별점 6', { rating: 6 }, 'rating'],
    ['별점 소수', { rating: 3.5 }, 'rating'],
    ['별점 문자열', { rating: '4' }, 'rating'],
    ['별점 없음', { rating: undefined }, 'rating'],
    ['한마디 빈 문자열', { comment: '' }, 'comment'],
    ['한마디 공백만', { comment: '   ' }, 'comment'],
    ['한마디 undefined', { comment: undefined }, 'comment'],
    ['한마디 201자', { comment: 'a'.repeat(201) }, 'comment'],
  ];
  for (const [name, over, field] of bad) {
    test(`검증 실패(${name}) -> 400, 네트워크 호출 없음`, async () => {
      const { api, calls } = make({ session: storedSession() });
      await rejects(api.createFeedback({ ...ok, ...over }), 400, (e) => assert.equal(e.errors[0].field, field));
      assert.equal(calls.length, 0);
    });
  }

  test('경계: 별점 1과 5, 한마디 200자 통과', async () => {
    const { api } = make({ session: storedSession(), handler: () => res(201, [fbRow()]) });
    await api.createFeedback({ rating: 1, comment: 'a'.repeat(200) });
    await api.createFeedback({ rating: 5, comment: 'x' });
  });

  test('이모지는 1자로 센다 (200개 통과, 201개 거절)', async () => {
    const { api, calls } = make({ session: storedSession(), handler: () => res(201, [fbRow()]) });
    await api.createFeedback({ rating: 3, comment: '😀'.repeat(200) });
    assert.equal(calls.length, 1);
    await rejects(api.createFeedback({ rating: 3, comment: '😀'.repeat(201) }), 400);
    assert.equal(calls.length, 1);
  });

  test('앞뒤 공백은 잘라서 보낸다 (길이도 trim 후 기준)', async () => {
    const { api, calls } = make({ session: storedSession(), handler: () => res(201, [fbRow()]) });
    await api.createFeedback({ rating: 5, comment: `  ${'a'.repeat(200)}  ` });
    assert.equal(calls[0].body.comment, 'a'.repeat(200));
  });

  test('성공: POST, body는 {rating,comment}만, Prefer return=representation', async () => {
    const { api, calls } = make({ session: storedSession(), handler: () => res(201, [fbRow({ rating: 4, comment: '재밌어요' })]) });
    const r = await api.createFeedback({ rating: 4, comment: ' 재밌어요 ', user_id: OTHER, nickname: '해커' });
    const c = calls[0];
    assert.equal(c.method, 'POST');
    assert.ok(c.path.startsWith('/rest/v1/feedback'));
    assert.deepEqual(c.body, { rating: 4, comment: '재밌어요' });
    assert.ok(!('user_id' in c.body) && !('nickname' in c.body));
    assert.equal(c.headers.Prefer, 'return=representation');
    assert.equal(c.headers.Authorization, 'Bearer AT');
    assert.equal(r.mine, true);
    assert.equal(r.rating, 4);
  });

  test('로그인 안 했으면 401, 네트워크 호출 없음', async () => {
    const { api, calls } = make();
    await rejects(api.createFeedback(ok), 401);
    assert.equal(calls.length, 0);
  });

  test('서버가 401을 주면 세션을 지운다', async () => {
    const { api, storage } = make({ session: storedSession(), handler: () => res(401, { message: 'JWT expired' }) });
    await rejects(api.createFeedback(ok), 401);
    assert.equal(storage.getItem(SESSION_KEY), null);
  });
});

describe('피드백 API: updateFeedback', () => {
  test('바뀐 필드만 PATCH, id 필터, Prefer return=representation', async () => {
    const { api, calls } = make({ session: storedSession(), handler: () => res(200, [fbRow({ id: 9, rating: 2 })]) });
    const r = await api.updateFeedback(9, { rating: 2 });
    const c = calls[0];
    assert.equal(c.method, 'PATCH');
    assert.equal(query(c).get('id'), 'eq.9');
    assert.deepEqual(c.body, { rating: 2 });
    assert.equal(c.headers.Prefer, 'return=representation');
    assert.equal(r.id, 9);
    assert.equal(r.rating, 2);
  });

  test('comment만 바꾸면 comment만 보내고 trim', async () => {
    const { api, calls } = make({ session: storedSession(), handler: () => res(200, [fbRow()]) });
    await api.updateFeedback(1, { comment: '  새 글  ' });
    assert.deepEqual(calls[0].body, { comment: '새 글' });
  });

  test('둘 다 바꾸면 둘 다 보낸다', async () => {
    const { api, calls } = make({ session: storedSession(), handler: () => res(200, [fbRow()]) });
    await api.updateFeedback(1, { rating: 1, comment: 'c' });
    assert.deepEqual(calls[0].body, { rating: 1, comment: 'c' });
  });

  test('검증 실패는 400, 네트워크 호출 없음', async () => {
    const { api, calls } = make({ session: storedSession() });
    await rejects(api.updateFeedback(1, { rating: 9 }), 400, (e) => assert.equal(e.errors[0].field, 'rating'));
    await rejects(api.updateFeedback(1, { comment: '  ' }), 400, (e) => assert.equal(e.errors[0].field, 'comment'));
    assert.equal(calls.length, 0);
  });

  test('바꿀 필드가 없으면 400, 네트워크 호출 없음', async () => {
    const { api, calls } = make({ session: storedSession() });
    await rejects(api.updateFeedback(1, {}), 400);
    await rejects(api.updateFeedback(1, { rating: undefined }), 400);
    assert.equal(calls.length, 0);
  });

  test('결과가 빈 배열(없거나 남의 글)이면 404', async () => {
    const { api } = make({ session: storedSession(), handler: () => res(200, []) });
    await rejects(api.updateFeedback(5, { rating: 3 }), 404);
  });

  test('로그인 안 했으면 401', async () => {
    const { api, calls } = make();
    await rejects(api.updateFeedback(1, { rating: 3 }), 401);
    assert.equal(calls.length, 0);
  });
});

describe('피드백 API: deleteFeedback', () => {
  test('DELETE, id 필터, 성공하면 null', async () => {
    const { api, calls } = make({ session: storedSession(), handler: () => res(200, [{ id: 4 }]) });
    const r = await api.deleteFeedback(4);
    assert.equal(r, null);
    assert.equal(calls[0].method, 'DELETE');
    assert.equal(query(calls[0]).get('id'), 'eq.4');
    assert.equal(calls[0].headers.Authorization, 'Bearer AT');
  });

  test('결과가 빈 배열이면 404', async () => {
    const { api } = make({ session: storedSession(), handler: () => res(200, []) });
    await rejects(api.deleteFeedback(4), 404);
  });

  test('401이면 세션을 지운다', async () => {
    const { api, storage } = make({ session: storedSession(), handler: () => res(401, { message: 'bad jwt' }) });
    await rejects(api.deleteFeedback(4), 401);
    assert.equal(storage.getItem(SESSION_KEY), null);
  });

  test('로그인 안 했으면 401, 네트워크 호출 없음', async () => {
    const { api, calls } = make();
    await rejects(api.deleteFeedback(4), 401);
    assert.equal(calls.length, 0);
  });
});
