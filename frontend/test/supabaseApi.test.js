import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseApi } from '../src/api/supabaseApi.js';
import { ApiError } from '../src/api/errors.js';

const URL_ROOT = 'https://proj.supabase.test';
const ANON = 'anon-key-test';
const SESSION_KEY = 'gamecal.sb';
const T0 = 1_700_000_000_000;
const UID = '11111111-1111-1111-1111-111111111111';

const res = (status, body) => ({ status, ok: status >= 200 && status < 300, text: async () => (body === undefined || body === null ? '' : typeof body === 'string' ? body : JSON.stringify(body)) });

const memoryStorage = (initial = {}) => {
  const map = new Map(Object.entries(initial));
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k), map };
};

const profileRow = (over = {}) => ({ id: UID, display_name: '닉', avatar: null, preferred_platform: null, created_at: '2026-11-01T00:00:00Z', ...over });
const tokenBody = (over = {}) => ({ access_token: 'AT-new', refresh_token: 'RT-new', expires_in: 3600, user: { id: UID, email: 'a@b.co' }, ...over });
const storedSession = (over = {}) => JSON.stringify({ accessToken: 'AT', refreshToken: 'RT', expiresAt: T0 + 3_600_000, user: { id: UID, email: 'a@b.co' }, ...over });

// handler(url, init, call) => response | undefined (404 기본)
function make({ handler = () => res(200, []), session, clock = { t: T0 } } = {}) {
  const calls = [];
  const storage = memoryStorage(session ? { [SESSION_KEY]: session } : {});
  const listGamesCalls = [];
  const base = { listGames: async (q) => { listGamesCalls.push(q); return { items: q.ids.map((id) => ({ id })), total: q.ids.length }; } };
  const fetchImpl = async (url, init) => {
    const call = { url, path: url.replace(URL_ROOT, ''), method: init.method, headers: init.headers, body: init.body === undefined ? undefined : JSON.parse(init.body) };
    calls.push(call);
    return handler(call.path, init, call) ?? res(404, { message: 'nope' });
  };
  const api = createSupabaseApi({ url: `${URL_ROOT}/`, anonKey: ANON, base, fetchImpl, storage, now: () => clock.t });
  return { api, calls, storage, clock, listGamesCalls };
}

const rejects = (promise, status, extra) => assert.rejects(promise, (e) => {
  assert.ok(e instanceof ApiError, `ApiError expected, got ${e}`);
  assert.equal(e.status, status);
  if (extra) extra(e);
  return true;
});

describe('Supabase API: 회원가입', () => {
  const ok = { email: 'a@b.co', password: 'abcd1234', displayName: '닉' };
  const cases = [
    ['이메일 비어 있음', { email: '' }, 'email'],
    ['이메일 형식 오류', { email: 'nope' }, 'email'],
    ['이메일 너무 김', { email: `${'a'.repeat(190)}@b.co` }, 'email'],
    ['닉네임 공백', { displayName: '   ' }, 'displayName'],
    ['닉네임 41자', { displayName: '가'.repeat(41) }, 'displayName'],
    ['비밀번호 7자', { password: 'abc1234' }, 'password'],
    ['비밀번호 129자', { password: `a1${'x'.repeat(127)}` }, 'password'],
    ['비밀번호 숫자 없음', { password: 'abcdefgh' }, 'password'],
    ['비밀번호 글자 없음', { password: '12345678' }, 'password'],
    ['비밀번호 문자열 아님', { password: 12345678 }, 'password'],
  ];
  for (const [name, over, field] of cases) {
    test(`검증 실패(${name}) -> 400, 네트워크 호출 없음`, async () => {
      const { api, calls } = make();
      await rejects(api.signup({ ...ok, ...over }), 400, (e) => assert.equal(e.errors[0].field, field));
      assert.equal(calls.length, 0);
    });
  }

  test('닉네임 40자(이모지 포함)는 통과', async () => {
    const { api } = make({ handler: (p) => (p.startsWith('/auth/v1/signup') ? res(200, tokenBody()) : res(200, [profileRow()])) });
    const r = await api.signup({ ...ok, displayName: '😀'.repeat(40) });
    assert.equal(r.user.id, UID);
  });

  test('성공: 이메일 소문자/trim, 세션 저장, {token,user} 반환', async () => {
    const { api, calls, storage } = make({
      handler: (p) => (p === '/auth/v1/signup' ? res(200, tokenBody()) : p.startsWith('/rest/v1/profiles') ? res(200, [profileRow({ display_name: '닉' })]) : undefined),
    });
    const r = await api.signup({ email: '  A@B.co ', password: 'abcd1234', displayName: ' 닉 ' });
    assert.equal(r.token, 'AT-new');
    assert.equal(r.user.email, 'a@b.co');
    assert.equal(r.user.displayName, '닉');
    assert.equal(calls[0].path, '/auth/v1/signup');
    assert.deepEqual(calls[0].body, { email: 'a@b.co', password: 'abcd1234', data: { display_name: '닉' } });
    assert.equal(calls[0].headers.apikey, ANON);
    assert.equal(calls[0].headers.Authorization, `Bearer ${ANON}`);
    const saved = JSON.parse(storage.getItem(SESSION_KEY));
    assert.equal(saved.accessToken, 'AT-new');
    assert.equal(saved.refreshToken, 'RT-new');
    assert.deepEqual(saved.user, { id: UID, email: 'a@b.co' });
    // 프로필 조회는 새 토큰으로
    assert.equal(calls[1].headers.Authorization, 'Bearer AT-new');
  });

  test('프로필 조회가 실패해도 가입 결과는 입력한 닉네임으로 돌려준다', async () => {
    const { api } = make({ handler: (p) => (p === '/auth/v1/signup' ? res(200, tokenBody()) : res(500, { message: 'boom' })) });
    const r = await api.signup(ok);
    assert.equal(r.user.displayName, '닉');
    assert.equal(r.user.avatar, null);
  });

  test('access_token이 없으면 500, 세션 저장 안 함', async () => {
    const { api, storage } = make({ handler: () => res(200, { user: { id: UID, email: 'a@b.co' } }) });
    await rejects(api.signup(ok), 500);
    assert.equal(storage.getItem(SESSION_KEY), null);
  });

  test('중복 이메일: user_already_exists 또는 422 -> 409', async () => {
    for (const r of [res(400, { error_code: 'user_already_exists', msg: 'x' }), res(422, { msg: 'registered' })]) {
      const { api } = make({ handler: () => r });
      await rejects(api.signup(ok), 409);
    }
  });

  test('weak_password -> 400 password, 429 -> 429, 그 외는 그대로 전달', async () => {
    await rejects(make({ handler: () => res(400, { error_code: 'weak_password', msg: 'weak' }) }).api.signup(ok), 400, (e) => assert.equal(e.errors[0].field, 'password'));
    await rejects(make({ handler: () => res(429, { msg: 'slow' }) }).api.signup(ok), 429);
    await rejects(make({ handler: () => res(503, { msg: 'down' }) }).api.signup(ok), 503, (e) => assert.equal(e.message, 'down'));
  });

  test('네트워크 오류 -> status 0', async () => {
    const api = createSupabaseApi({ url: URL_ROOT, anonKey: ANON, base: {}, storage: memoryStorage(), fetchImpl: async () => { throw new TypeError('fail'); } });
    await rejects(api.signup(ok), 0);
  });
});

describe('Supabase API: 로그인/로그아웃', () => {
  test('로그인 성공: 세션 저장, token/expiresAt/user 반환', async () => {
    const { api, calls, storage } = make({
      handler: (p) => (p.startsWith('/auth/v1/token') ? res(200, tokenBody()) : res(200, [profileRow({ avatar: 'a05', preferred_platform: 'PC' })])),
    });
    const r = await api.login({ email: 'A@B.co', password: 'pw' });
    assert.equal(calls[0].path, '/auth/v1/token?grant_type=password');
    assert.equal(calls[0].body.email, 'a@b.co');
    assert.equal(r.token, 'AT-new');
    assert.equal(r.expiresAt, new Date(T0 + (3600 - 30) * 1000).toISOString());
    assert.equal(r.user.avatar, 'a05');
    assert.equal(r.user.preferredPlatform, 'PC');
    assert.ok(storage.getItem(SESSION_KEY));
  });

  test('틀린 비밀번호(400/401)는 똑같은 401 메시지', async () => {
    const msgs = [];
    for (const r of [res(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' }), res(401, { msg: 'unauthorized' })]) {
      const { api, storage } = make({ handler: () => r });
      await rejects(api.login({ email: 'a@b.co', password: 'bad' }), 401, (e) => msgs.push(e.message));
      assert.equal(storage.getItem(SESSION_KEY), null);
    }
    assert.equal(msgs[0], msgs[1]);
    assert.ok(!/Invalid login/.test(msgs[0]));
  });

  test('로그인 입력 검증은 네트워크 없이 400, 429는 429', async () => {
    const { api, calls } = make();
    await rejects(api.login({ email: '', password: 'x' }), 400);
    await rejects(api.login({ email: 'a@b.co', password: '' }), 400);
    assert.equal(calls.length, 0);
    await rejects(make({ handler: () => res(429, {}) }).api.login({ email: 'a@b.co', password: 'x' }), 429);
  });

  test('logout: 저장소를 비우고 /auth/v1/logout을 현재 토큰으로 호출, 실패해도 null', async () => {
    const { api, calls, storage } = make({ session: storedSession(), handler: () => res(500, { message: 'x' }) });
    assert.equal(await api.logout(), null);
    assert.equal(storage.getItem(SESSION_KEY), null);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, '/auth/v1/logout');
    assert.equal(calls[0].method, 'POST');
    assert.equal(calls[0].headers.Authorization, 'Bearer AT');
    assert.equal(calls[0].headers.apikey, ANON);
  });

  test('logout: 로그인 안 했으면 호출 없음', async () => {
    const { api, calls } = make();
    assert.equal(await api.logout(), null);
    assert.equal(calls.length, 0);
  });
});

describe('Supabase API: me / 토큰 갱신', () => {
  test('저장된 세션으로 me(): apikey + Bearer 헤더, 프로필 매핑', async () => {
    const { api, calls } = make({ session: storedSession(), handler: () => res(200, [profileRow({ display_name: '홍', avatar: 'a01' })]) });
    const me = await api.me();
    assert.deepEqual(me, { id: UID, email: 'a@b.co', displayName: '홍', avatar: 'a01', preferredPlatform: null, createdAt: '2026-11-01T00:00:00Z' });
    assert.equal(calls[0].path, `/rest/v1/profiles?id=eq.${UID}&select=*`);
    assert.equal(calls[0].headers.apikey, ANON);
    assert.equal(calls[0].headers.Authorization, 'Bearer AT');
  });

  test('로그인 안 했으면 me() 401, 호출 없음', async () => {
    const { api, calls } = make();
    await rejects(api.me(), 401);
    assert.equal(calls.length, 0);
  });

  test('저장소의 깨진 JSON은 무시하고 401', async () => {
    const { api } = make({ session: '{not json' });
    await rejects(api.me(), 401);
  });

  test('만료된 access token: refresh_token 호출 후 새 토큰으로 계속', async () => {
    const { api, calls, storage } = make({
      session: storedSession({ expiresAt: T0 - 1 }),
      handler: (p) => (p.startsWith('/auth/v1/token') ? res(200, tokenBody({ access_token: 'AT2', refresh_token: 'RT2' })) : res(200, [profileRow()])),
    });
    await api.me();
    assert.equal(calls[0].path, '/auth/v1/token?grant_type=refresh_token');
    assert.deepEqual(calls[0].body, { refresh_token: 'RT' });
    assert.equal(calls[1].headers.Authorization, 'Bearer AT2');
    const saved = JSON.parse(storage.getItem(SESSION_KEY));
    assert.equal(saved.accessToken, 'AT2');
    assert.equal(saved.refreshToken, 'RT2');
  });

  test('만료 전에는 갱신하지 않는다', async () => {
    const { api, calls } = make({ session: storedSession(), handler: () => res(200, [profileRow()]) });
    await api.me();
    assert.ok(calls.every((c) => !c.path.includes('/auth/v1/token')));
  });

  test('갱신 실패: 세션 삭제 + 401', async () => {
    const { api, storage } = make({ session: storedSession({ expiresAt: T0 - 1 }), handler: () => res(400, { error_code: 'refresh_token_not_found', msg: 'bad' }) });
    await rejects(api.me(), 401);
    assert.equal(storage.getItem(SESSION_KEY), null);
    await rejects(api.me(), 401); // 이후에도 로그인 안 한 상태
  });

  test('갱신 중 네트워크 오류: 세션 유지, status 0', async () => {
    const storage = memoryStorage({ [SESSION_KEY]: storedSession({ expiresAt: T0 - 1 }) });
    const api = createSupabaseApi({ url: URL_ROOT, anonKey: ANON, base: {}, storage, now: () => T0, fetchImpl: async () => { throw new Error('offline'); } });
    await rejects(api.me(), 0);
    assert.ok(storage.getItem(SESSION_KEY));
  });

  test('프로필 요청이 401이면 세션을 지우고 401', async () => {
    const { api, storage } = make({ session: storedSession(), handler: () => res(401, { message: 'JWT expired' }) });
    await rejects(api.me(), 401);
    assert.equal(storage.getItem(SESSION_KEY), null);
  });
});

describe('Supabase API: updateMe', () => {
  const sess = () => storedSession();
  test('아바타 검증: a01~a20/null만 허용, 네트워크 호출 없음', async () => {
    for (const bad of ['a00', 'a21', 'a1', 'A01', 'a010', '', 5, 'avatar']) {
      const { api, calls } = make({ session: sess() });
      await rejects(api.updateMe({ avatar: bad }), 400, (e) => assert.equal(e.errors[0].field, 'avatar'));
      assert.equal(calls.length, 0, `avatar=${String(bad)}`);
    }
    for (const good of ['a01', 'a09', 'a10', 'a19', 'a20', null]) {
      const { api } = make({ session: sess(), handler: () => res(200, [profileRow({ avatar: good })]) });
      assert.equal((await api.updateMe({ avatar: good })).avatar, good);
    }
  });

  test('닉네임/플랫폼 검증', async () => {
    const { api, calls } = make({ session: sess() });
    await rejects(api.updateMe({ displayName: '  ' }), 400);
    await rejects(api.updateMe({ displayName: 'x'.repeat(41) }), 400);
    await rejects(api.updateMe({ preferredPlatform: '  ' }), 400);
    await rejects(api.updateMe({ preferredPlatform: 'p'.repeat(51) }), 400);
    await rejects(api.updateMe({ preferredPlatform: 3 }), 400);
    assert.equal(calls.length, 0);
  });

  test('PATCH 본문 매핑: display_name, avatar, preferred_platform + Prefer 헤더', async () => {
    const { api, calls } = make({ session: sess(), handler: () => res(200, [profileRow({ display_name: '새', avatar: 'a02', preferred_platform: 'PS5' })]) });
    const me = await api.updateMe({ displayName: ' 새 ', avatar: 'a02', preferredPlatform: ' PS5 ' });
    assert.equal(calls[0].method, 'PATCH');
    assert.equal(calls[0].path, `/rest/v1/profiles?id=eq.${UID}`);
    assert.deepEqual(calls[0].body, { display_name: '새', avatar: 'a02', preferred_platform: 'PS5' });
    assert.equal(calls[0].headers.Prefer, 'return=representation');
    assert.equal(calls[0].headers.Authorization, 'Bearer AT');
    assert.equal(me.displayName, '새');
    assert.equal(me.preferredPlatform, 'PS5');
  });

  test('preferredPlatform: null은 null로 보낸다', async () => {
    const { api, calls } = make({ session: sess(), handler: () => res(200, [profileRow()]) });
    await api.updateMe({ preferredPlatform: null });
    assert.deepEqual(calls[0].body, { preferred_platform: null });
  });

  test('바꿀 게 없으면 PATCH 없이 프로필만 조회', async () => {
    const { api, calls } = make({ session: sess(), handler: () => res(200, [profileRow()]) });
    await api.updateMe({});
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, 'GET');
  });
});

describe('Supabase API: 관심 게임', () => {
  const sess = () => storedSession();
  test('addFavorite: POST + ignore-duplicates, 인증 헤더', async () => {
    const { api, calls } = make({ session: sess(), handler: () => res(201, null) });
    assert.equal(await api.addFavorite('7'), null);
    assert.equal(calls[0].method, 'POST');
    assert.equal(calls[0].path, '/rest/v1/user_favorites');
    assert.deepEqual(calls[0].body, { game_id: 7 });
    assert.equal(calls[0].headers.Prefer, 'resolution=ignore-duplicates,return=minimal');
    assert.equal(calls[0].headers.apikey, ANON);
    assert.equal(calls[0].headers.Authorization, 'Bearer AT');
  });

  test('removeFavorite: DELETE game_id 필터', async () => {
    const { api, calls } = make({ session: sess(), handler: () => res(204, null) });
    await api.removeFavorite(9);
    assert.equal(calls[0].method, 'DELETE');
    assert.equal(calls[0].path, '/rest/v1/user_favorites?game_id=eq.9');
  });

  test('로그인 안 했으면 addFavorite 401', async () => {
    const { api, calls } = make();
    await rejects(api.addFavorite(1), 401);
    assert.equal(calls.length, 0);
  });

  test('myFavoriteIds / myFavorites(base.listGames 사용, 비면 호출 안 함)', async () => {
    const { api, listGamesCalls } = make({ session: sess(), handler: () => res(200, [{ game_id: 3 }, { game_id: 1 }]) });
    assert.deepEqual(await api.myFavoriteIds(), [3, 1]);
    const favs = await api.myFavorites();
    assert.deepEqual(favs.map((g) => g.id), [3, 1]);
    assert.deepEqual(listGamesCalls[0], { ids: [3, 1], limit: 500, sort: 'releaseDate' });

    const empty = make({ session: sess(), handler: () => res(200, []) });
    assert.deepEqual(await empty.api.myFavorites(), []);
    assert.equal(empty.listGamesCalls.length, 0);
  });

  test('mergeFavorites: 중복/비양수/비정수 걸러서 한 번에 POST 후 목록 반환', async () => {
    const { api, calls } = make({ session: sess(), handler: (p, init) => (init.method === 'POST' ? res(201, null) : res(200, [{ game_id: 1 }, { game_id: 2 }])) });
    const ids = await api.mergeFavorites([1, 1, 2, 0, -3, 1.5, '4', NaN, null, 2]);
    assert.deepEqual(calls[0].body, [{ game_id: 1 }, { game_id: 2 }]);
    assert.equal(calls[0].headers.Prefer, 'resolution=ignore-duplicates,return=minimal');
    assert.deepEqual(ids, [1, 2]);
  });

  test('mergeFavorites: 유효한 id가 없으면 POST 없이 목록만 조회', async () => {
    const { api, calls } = make({ session: sess(), handler: () => res(200, [{ game_id: 5 }]) });
    assert.deepEqual(await api.mergeFavorites([0, -1, 2.2]), [5]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, 'GET');
  });

  test('mergeFavorites: 최대 500개까지만 보낸다', async () => {
    const { api, calls } = make({ session: sess(), handler: () => res(200, []) });
    await api.mergeFavorites(Array.from({ length: 700 }, (_, i) => i + 1));
    assert.equal(calls[0].body.length, 500);
  });
});

describe('Supabase API: 포럼 목록', () => {
  const row = (id, over = {}) => ({
    id, category: '자유', title: `제목 ${id}`, body: `본문 ${id}`, game_id: null, game_title: null, created_at: `2026-11-${String(10 + id).padStart(2, '0')}T00:00:00Z`, user_id: 'u-other',
    profiles: { id: 'u-other', display_name: '남', avatar: 'a03' }, forum_comments: [], forum_likes: [], ...over,
  });
  const serve = (rows) => (p) => (p.startsWith('/rest/v1/forum_posts') ? res(200, rows) : undefined);

  test('매핑: excerpt 140자, commentCount, likeCount, author, game', async () => {
    const long = '가'.repeat(200);
    const { api } = make({ handler: serve([row(1, { body: long, game_id: 5, game_title: 'G', forum_comments: [{ id: 1 }, { id: 2 }], forum_likes: [{ user_id: 'x' }] })]) });
    const { items, total } = await api.forumPosts();
    assert.equal(total, 1);
    const p = items[0];
    assert.equal(p.excerpt.length, 140);
    assert.equal(p.body, undefined);
    assert.equal(p.commentCount, 2);
    assert.equal(p.likeCount, 1);
    assert.deepEqual(p.author, { id: 'u-other', displayName: '남', avatar: 'a03' });
    assert.deepEqual(p.game, { id: 5, title: 'G' });
    assert.equal(p.liked, false);
    assert.equal(p.mine, false);
  });

  test('excerpt는 서러게이트 쌍을 자르지 않는다', async () => {
    const { api } = make({ handler: serve([row(1, { body: '😀'.repeat(200) })]) });
    const { items } = await api.forumPosts();
    assert.equal([...items[0].excerpt].length, 140);
  });

  test('작성자가 없으면 탈퇴한 사용자', async () => {
    const { api } = make({ handler: serve([row(1, { profiles: null })]) });
    const { items } = await api.forumPosts();
    assert.equal(items[0].author.displayName, '탈퇴한 사용자');
    assert.equal(items[0].author.id, 'u-other');
  });

  test('로그인 안 했으면 anon 키, liked/mine은 false', async () => {
    const { api, calls } = make({ handler: serve([row(1, { user_id: UID, forum_likes: [{ user_id: UID }] })]) });
    const { items } = await api.forumPosts();
    assert.equal(calls[0].headers.apikey, ANON);
    assert.equal(calls[0].headers.Authorization, `Bearer ${ANON}`);
    assert.equal(items[0].liked, false);
    assert.equal(items[0].mine, false);
  });

  test('로그인하면 사용자 토큰을 쓰고 liked/mine 계산', async () => {
    const rows = [row(1, { user_id: UID, forum_likes: [{ user_id: UID }] }), row(2, { forum_likes: [{ user_id: 'z' }] })];
    const { api, calls } = make({ session: storedSession(), handler: serve(rows) });
    const { items } = await api.forumPosts();
    assert.equal(calls[0].headers.Authorization, 'Bearer AT');
    assert.deepEqual(items.map((p) => [p.liked, p.mine]), [[true, true], [false, false]]);
  });

  test('로그인 정보 갱신이 실패하면 anon 키로 읽는다', async () => {
    const { api, calls } = make({
      session: storedSession({ expiresAt: T0 - 1 }),
      handler: (p) => (p.startsWith('/auth/v1/token') ? res(400, { msg: 'bad' }) : res(200, [])),
    });
    await api.forumPosts();
    assert.equal(calls.at(-1).headers.Authorization, `Bearer ${ANON}`);
  });

  test('카테고리/게임 필터는 쿼리에 들어간다', async () => {
    const { api, calls } = make({ handler: serve([]) });
    await api.forumPosts({ category: '질문', gameId: '12' });
    assert.match(calls[0].path, /&category=eq\.%EC%A7%88%EB%AC%B8/);
    assert.match(calls[0].path, /&game_id=eq\.12/);
    assert.match(calls[0].path, /order=created_at\.desc,id\.desc&limit=500/);
  });

  test('q 검색: 제목/본문, 대소문자 무시', async () => {
    const rows = [row(1, { title: 'Hello World' }), row(2, { body: 'about WORLD' }), row(3, { title: 'zzz' })];
    const { api } = make({ handler: serve(rows) });
    const { items, total } = await api.forumPosts({ q: 'world' });
    assert.deepEqual(items.map((p) => p.id), [1, 2]);
    assert.equal(total, 2);
  });

  test('popular 정렬: 좋아요*2+댓글, 동점이면 최신순', async () => {
    const likes = (n) => Array.from({ length: n }, (_, i) => ({ user_id: `u${i}` }));
    const comments = (n) => Array.from({ length: n }, (_, i) => ({ id: i }));
    const rows = [
      row(1, { forum_likes: likes(1) }), // 2
      row(2, { forum_likes: likes(3) }), // 6
      row(3, { forum_comments: comments(2) }), // 2, 더 최신
      row(4, { forum_comments: comments(6) }), // 6, 더 최신
    ];
    const { api } = make({ handler: serve(rows) });
    const { items } = await api.forumPosts({ sort: 'popular' });
    assert.deepEqual(items.map((p) => p.id), [4, 2, 3, 1]);
  });

  test('recent(기본)는 서버가 준 순서를 유지', async () => {
    const { api } = make({ handler: serve([row(3), row(1), row(2)]) });
    const { items } = await api.forumPosts();
    assert.deepEqual(items.map((p) => p.id), [3, 1, 2]);
  });

  test('쪽 나누기: limit/page, total은 전체 개수', async () => {
    const { api } = make({ handler: serve([1, 2, 3, 4, 5].map((i) => row(i))) });
    const p2 = await api.forumPosts({ limit: 2, page: 2 });
    assert.deepEqual(p2.items.map((p) => p.id), [3, 4]);
    assert.equal(p2.total, 5);
    const p3 = await api.forumPosts({ limit: 2, page: 3 });
    assert.deepEqual(p3.items.map((p) => p.id), [5]);
    assert.equal((await api.forumPosts({ limit: 2, page: 9 })).items.length, 0);
  });
});

describe('Supabase API: 포럼 글 상세 / 작성', () => {
  const detailRow = (over = {}) => ({
    id: 7, category: '질문', title: 'T', body: '본문 전체', game_id: null, game_title: null, created_at: '2026-11-10T00:00:00Z', user_id: UID,
    profiles: { id: UID, display_name: '나', avatar: null },
    forum_likes: [{ user_id: UID }],
    forum_comments: [
      { id: 1, body: '첫', created_at: '2026-11-10T01:00:00Z', user_id: UID, profiles: { id: UID, display_name: '나', avatar: null } },
      { id: 2, body: '둘', created_at: '2026-11-10T02:00:00Z', user_id: 'other', profiles: null },
    ],
    ...over,
  });

  test('상세: body 포함, 댓글 매핑(mine, 탈퇴한 사용자), 쿼리에 댓글 select/order', async () => {
    const { api, calls } = make({ session: storedSession(), handler: () => res(200, [detailRow()]) });
    const post = await api.forumPost(7);
    assert.equal(post.body, '본문 전체');
    assert.equal(post.excerpt, undefined);
    assert.equal(post.mine, true);
    assert.equal(post.liked, true);
    assert.equal(post.commentCount, 2);
    assert.deepEqual(post.comments.map((c) => [c.id, c.mine, c.author.displayName]), [[1, true, '나'], [2, false, '탈퇴한 사용자']]);
    assert.match(calls[0].path, /forum_comments\(id,body,created_at,user_id,profiles!user_id\(id,display_name,avatar\)\)/);
    assert.match(calls[0].path, /forum_comments\.order=created_at\.asc,id\.asc/);
    assert.match(calls[0].path, /id=eq\.7&/);
  });

  test('없는 글 404, 잘못된 id는 네트워크 없이 404', async () => {
    const { api, calls } = make({ handler: () => res(200, []) });
    await rejects(api.forumPost(999), 404);
    const before = calls.length;
    for (const bad of ['abc', 0, -1, '1.5', '1;drop', '']) await rejects(api.forumPost(bad), 404);
    assert.equal(calls.length, before);
  });

  test('createForumPost 검증: 분류/제목/본문, 네트워크 없음', async () => {
    const { api, calls } = make({ session: storedSession() });
    const ok = { category: '자유', title: '제목', body: '내용' };
    await rejects(api.createForumPost({ ...ok, category: '기타' }), 400, (e) => assert.equal(e.errors[0].field, 'category'));
    await rejects(api.createForumPost({ ...ok, category: undefined }), 400);
    await rejects(api.createForumPost({ ...ok, title: '  ' }), 400, (e) => assert.equal(e.errors[0].field, 'title'));
    await rejects(api.createForumPost({ ...ok, title: 'x'.repeat(101) }), 400, (e) => assert.equal(e.errors[0].field, 'title'));
    await rejects(api.createForumPost({ ...ok, body: '' }), 400, (e) => assert.equal(e.errors[0].field, 'body'));
    await rejects(api.createForumPost({ ...ok, body: 'x'.repeat(3001) }), 400, (e) => assert.equal(e.errors[0].field, 'body'));
    assert.equal(calls.length, 0);
  });

  test('createForumPost 성공: POST 후 상세를 다시 읽어 돌려준다 (게임 정보 포함)', async () => {
    const { api, calls } = make({
      session: storedSession(),
      handler: (p, init) => (init.method === 'POST' ? res(201, [{ id: 7 }]) : res(200, [detailRow()])),
    });
    const post = await api.createForumPost({ category: '공략', title: ' 제목 ', body: ' 내용 ', gameId: '3', gameTitle: 'Game' });
    assert.equal(calls[0].method, 'POST');
    assert.equal(calls[0].path, '/rest/v1/forum_posts?select=id');
    assert.deepEqual(calls[0].body, { category: '공략', title: '제목', body: '내용', game_id: 3, game_title: 'Game' });
    assert.equal(calls[0].headers.Prefer, 'return=representation');
    assert.equal(calls[0].headers.Authorization, 'Bearer AT');
    assert.equal(post.id, 7);
  });

  test('createForumPost: 로그인 안 했으면 401', async () => {
    const { api } = make();
    await rejects(api.createForumPost({ category: '자유', title: 't', body: 'b' }), 401);
  });
});

describe('Supabase API: 댓글/좋아요와 공통 동작', () => {
  test('addForumComment 검증 + 매핑, 삭제/좋아요 요청 모양', async () => {
    const { api, calls } = make({
      session: storedSession(),
      handler: (p, init) => (init.method === 'POST' && p.startsWith('/rest/v1/forum_comments')
        ? res(201, [{ id: 9, body: '안녕', created_at: 'T', user_id: UID, profiles: { id: UID, display_name: '나', avatar: 'a01' } }])
        : res(204, null)),
    });
    await rejects(api.addForumComment(1, '  '), 400);
    await rejects(api.addForumComment(1, 'x'.repeat(1001)), 400);
    assert.equal(calls.length, 0);
    const c = await api.addForumComment('1', ' 안녕 ');
    assert.deepEqual(calls[0].body, { post_id: 1, body: '안녕' });
    assert.deepEqual(c, { id: 9, body: '안녕', author: { id: UID, displayName: '나', avatar: 'a01' }, createdAt: 'T', mine: true });

    await api.deleteForumComment(1, 9);
    assert.equal(calls[1].path, '/rest/v1/forum_comments?id=eq.9&post_id=eq.1');
    await api.deleteForumPost(4);
    assert.equal(calls[2].path, '/rest/v1/forum_posts?id=eq.4');
    await api.likeForumPost(4);
    assert.equal(calls[3].headers.Prefer, 'resolution=ignore-duplicates,return=minimal');
    assert.deepEqual(calls[3].body, { post_id: 4 });
    await api.unlikeForumPost(4);
    assert.equal(calls[4].path, '/rest/v1/forum_likes?post_id=eq.4');
    for (const call of calls) {
      assert.equal(call.headers.apikey, ANON);
      assert.equal(call.headers.Authorization, 'Bearer AT');
    }
  });

  test('쓰기 요청이 401이면 세션을 지운다', async () => {
    const { api, storage } = make({ session: storedSession(), handler: () => res(401, { message: 'JWT expired' }) });
    await rejects(api.likeForumPost(1), 401);
    assert.equal(storage.getItem(SESSION_KEY), null);
  });

  test('base의 읽기 API를 그대로 노출하고 readOnly는 false', () => {
    const { api } = make();
    assert.equal(api.readOnly, false);
    assert.equal(typeof api.listGames, 'function');
  });

  test('url 끝의 슬래시는 정리된다', async () => {
    const { api, calls } = make({ session: storedSession(), handler: () => res(200, [profileRow()]) });
    await api.me();
    assert.ok(calls[0].url.startsWith(`${URL_ROOT}/rest/v1/`));
    assert.ok(!calls[0].url.includes('//rest'));
  });

  test('저장소 쓰기가 막혀도 메모리로 로그인 유지', async () => {
    const storage = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => { throw new Error('x'); } };
    const api = createSupabaseApi({
      url: URL_ROOT, anonKey: ANON, base: {}, storage, now: () => T0,
      fetchImpl: async (url) => (url.includes('/auth/v1/token') ? res(200, tokenBody()) : res(200, [profileRow()])),
    });
    await api.login({ email: 'a@b.co', password: 'pw' });
    assert.equal((await api.me()).id, UID);
    await api.logout();
    await rejects(api.me(), 401);
  });
});
