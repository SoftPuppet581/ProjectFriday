import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadToken, saveToken, clearToken } from '../src/lib/auth.js';
import { createApi, ApiError } from '../src/api/client.js';

const memory = () => {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) };
};
const TOKEN = 'abcdefghijklmnopqrstuvwxyz0123456789_-ABCD';

describe('토큰 저장', () => {
  test('저장, 불러오기, 지우기', () => {
    const s = memory();
    assert.equal(loadToken(s), null);
    saveToken(TOKEN, s);
    assert.equal(loadToken(s), TOKEN);
    clearToken(s);
    assert.equal(loadToken(s), null);
  });

  test('모양이 이상한 값(너무 짧음, 공백, 이상한 글자)은 토큰으로 보지 않는다', () => {
    const s = memory();
    for (const bad of ['', 'short', 'has space in the middle of a long token value', '<script>alert(1)</script>aaaaaaaa', 'a'.repeat(201)]) {
      s.setItem('gamecal.token', bad);
      assert.equal(loadToken(s), null, bad.slice(0, 20));
    }
  });

  test('저장소가 없거나 예외를 던져도 에러가 나지 않는다', () => {
    const broken = { getItem: () => { throw new Error('막힘'); }, setItem: () => { throw new Error('막힘'); }, removeItem: () => { throw new Error('막힘'); } };
    assert.equal(loadToken(broken), null);
    assert.doesNotThrow(() => saveToken(TOKEN, broken));
    assert.doesNotThrow(() => clearToken(broken));
    assert.equal(loadToken(undefined), null);
  });
});

describe('API 클라이언트: 로그인과 개인 기능', () => {
  const res = (status, body) => ({
    status,
    ok: status >= 200 && status < 300,
    headers: { get: () => null },
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  });
  const make = (handler, getToken) => {
    const calls = [];
    const api = createApi({ baseUrl: 'http://test', getToken, fetchImpl: async (url, options) => (calls.push({ url, options }), handler(url, options)) });
    return { api, calls };
  };

  test('토큰이 있으면 모든 요청에 Authorization 헤더를 붙이고, 없으면 붙이지 않는다', async () => {
    const withToken = make(() => res(200, []), () => TOKEN);
    await withToken.api.genres();
    assert.equal(withToken.calls[0].options.headers.Authorization, `Bearer ${TOKEN}`);
    const without = make(() => res(200, []), () => null);
    await without.api.genres();
    assert.equal('Authorization' in without.calls[0].options.headers, false);
  });

  test('토큰은 요청마다 다시 읽는다 (로그인/로그아웃 직후에도 바로 반영)', async () => {
    let token = null;
    const { api, calls } = make(() => res(200, []), () => token);
    await api.genres();
    token = TOKEN;
    await api.genres();
    assert.equal('Authorization' in calls[0].options.headers, false);
    assert.equal(calls[1].options.headers.Authorization, `Bearer ${TOKEN}`);
  });

  test('가입과 로그인은 필요한 필드만 보낸다', async () => {
    const { api, calls } = make(() => res(201, { token: TOKEN, user: {} }));
    await api.signup({ email: 'a@example.com', password: 'passw0rd123', displayName: '닉', isAdmin: true });
    await api.login({ email: 'a@example.com', password: 'passw0rd123', extra: 1 });
    assert.equal(calls[0].url, 'http://test/api/users');
    assert.deepEqual(JSON.parse(calls[0].options.body), { email: 'a@example.com', password: 'passw0rd123', displayName: '닉' });
    assert.equal(calls[1].url, 'http://test/api/sessions');
    assert.deepEqual(JSON.parse(calls[1].options.body), { email: 'a@example.com', password: 'passw0rd123' });
  });

  test('내 정보, 관심 게임 호출의 메서드와 주소', async () => {
    const { api, calls } = make(() => res(200, []));
    await api.me();
    await api.updateMe({ preferredPlatform: 'PC' });
    await api.myFavoriteIds();
    await api.myFavorites();
    await api.mergeFavorites([1, 2]);
    assert.deepEqual(calls.map((c) => `${c.options.method} ${c.url}`), [
      'GET http://test/api/users/me',
      'PATCH http://test/api/users/me',
      'GET http://test/api/users/me/favorites/ids',
      'GET http://test/api/users/me/favorites',
      'POST http://test/api/users/me/favorites',
    ]);
    assert.deepEqual(JSON.parse(calls[4].options.body), { gameIds: [1, 2] });
  });

  test('관심 게임 추가/삭제와 로그아웃은 204를 null로', async () => {
    const { api, calls } = make(() => res(204));
    assert.equal(await api.addFavorite(7), null);
    assert.equal(await api.removeFavorite(7), null);
    assert.equal(await api.logout(), null);
    assert.deepEqual(calls.map((c) => `${c.options.method} ${c.url}`), [
      'PUT http://test/api/users/me/favorites/7',
      'DELETE http://test/api/users/me/favorites/7',
      'DELETE http://test/api/sessions/current',
    ]);
  });

  test('로그인 실패(401)와 입력 오류(400)의 메시지와 필드 오류를 ApiError로 전달', async () => {
    const wrong = make(() => res(401, { message: '이메일 또는 비밀번호가 올바르지 않습니다.', errors: [] }));
    await assert.rejects(wrong.api.login({ email: 'a@b.co', password: 'x' }), (e) => e instanceof ApiError && e.status === 401 && /올바르지/.test(e.message));
    const invalid = make(() => res(400, { message: '입력값이 올바르지 않습니다.', errors: [{ field: 'password', message: '8~128자' }] }));
    await assert.rejects(invalid.api.signup({ email: 'x', password: 'y', displayName: '' }), (e) => e.status === 400 && e.errors[0].field === 'password');
    const dup = make(() => res(409, { message: '이미 가입된 이메일입니다.', errors: [{ field: 'email', message: '이미 가입된 이메일입니다.' }] }));
    await assert.rejects(dup.api.signup({ email: 'a@b.co', password: 'passw0rd1', displayName: 'n' }), (e) => e.status === 409);
  });
});
