// 회원가입, 로그인, 내 정보, 계정에 저장하는 관심 게임 테스트
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup, sample } from './helpers.js';

let ctx;
let passwords;
let rateLimit;
const api = (...args) => ctx.api(...args);

before(async () => {
  ctx = await setup();
  passwords = await import('../src/services/passwords.js');
  rateLimit = await import('../src/middleware/rateLimit.js');
});
after(async () => {
  await ctx.teardown();
});
beforeEach(async () => {
  await ctx.pool.query('DELETE FROM users'); // sessions와 user_favorites는 연쇄로 지워진다
  await ctx.pool.query('TRUNCATE TABLE games');
  rateLimit.resetRateLimits();
});

const PASSWORD = 'passw0rd123';
const signup = (overrides = {}) => api('POST', '/api/users', { email: 'a@example.com', password: PASSWORD, displayName: '테스터', ...overrides });
const login = (overrides = {}) => api('POST', '/api/sessions', { email: 'a@example.com', password: PASSWORD, ...overrides });
const bearer = (token) => ({ Authorization: `Bearer ${token}` });
const registered = async (overrides) => (await signup(overrides)).body;
const createGame = async (title) => (await api('POST', '/api/games', sample({ title }))).body;

describe('비밀번호와 토큰 도우미', () => {
  test('같은 비밀번호도 매번 다른 해시가 되고, 맞는 비밀번호만 통과한다', async () => {
    const a = await passwords.hashPassword(PASSWORD);
    const b = await passwords.hashPassword(PASSWORD);
    assert.notEqual(a, b);
    assert.ok(a.startsWith('scrypt$'));
    assert.ok(!a.includes(PASSWORD));
    assert.equal(await passwords.verifyPassword(PASSWORD, a), true);
    assert.equal(await passwords.verifyPassword('wrong-password1', a), false);
    assert.equal(await passwords.verifyPassword('', a), false);
  });

  test('깨진 저장값은 에러 없이 실패 처리한다', async () => {
    for (const stored of ['', 'plain', 'bcrypt$1$2', 'scrypt$1$2$3', null, undefined]) {
      assert.equal(await passwords.verifyPassword(PASSWORD, stored), false, String(stored));
    }
  });

  test('토큰은 충분히 길고 매번 다르며, 해시는 64자리 16진수', () => {
    const t1 = passwords.newToken();
    assert.ok(t1.length >= 40);
    assert.notEqual(t1, passwords.newToken());
    assert.match(passwords.hashToken(t1), /^[0-9a-f]{64}$/);
    assert.equal(passwords.hashToken(t1), passwords.hashToken(t1));
  });
});

describe('POST /api/users (회원가입)', () => {
  test('가입하면 201과 토큰, 사용자 정보를 돌려주고 비밀번호는 어디에도 없다', async () => {
    const res = await signup({ email: '  A@Example.COM ', displayName: ' 테스터 ' });
    assert.equal(res.status, 201);
    assert.equal(res.headers.get('location'), '/api/users/me');
    assert.ok(res.body.token.length >= 40);
    assert.match(res.body.expiresAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    assert.deepEqual(Object.keys(res.body.user).sort(), ['avatar', 'createdAt', 'displayName', 'email', 'id', 'preferredPlatform']);
    assert.equal(res.body.user.avatar, null); // 처음에는 기본 사진
    assert.ok(Math.abs(Date.parse(res.body.user.createdAt) - Date.now()) < 15000, '가입 시각이 서버 시간대 때문에 어긋나면 안 된다');
    assert.equal(res.body.user.email, 'a@example.com'); // 소문자로 정리
    assert.equal(res.body.user.displayName, '테스터');
    assert.ok(!res.text.includes(PASSWORD));
    assert.ok(!/passwordHash|password_hash|scrypt/.test(res.text));

    const [[row]] = await ctx.pool.query('SELECT password_hash FROM users');
    assert.ok(row.password_hash.startsWith('scrypt$'));
    assert.ok(!row.password_hash.includes(PASSWORD));
    const [[stored]] = await ctx.pool.query('SELECT token_hash FROM sessions');
    assert.notEqual(stored.token_hash, res.body.token); // DB에는 토큰 원본이 아니라 해시만
  });

  test('같은 이메일(대소문자 무시)로는 409', async () => {
    await signup();
    const res = await signup({ email: 'A@EXAMPLE.com', displayName: '다른 사람' });
    assert.equal(res.status, 409);
    assert.equal(res.body.errors[0].field, 'email');
  });

  test('입력 검증: 이메일, 비밀번호 규칙, 닉네임, 알 수 없는 필드', async () => {
    const bad = [
      [{ email: 'not-an-email' }, 'email'],
      [{ email: '' }, 'email'],
      [{ password: 'short1' }, 'password'],
      [{ password: 'onlyletters' }, 'password'],
      [{ password: '12345678' }, 'password'],
      [{ password: 'a1'.repeat(70) }, 'password'],
      [{ displayName: '' }, 'displayName'],
      [{ displayName: '가'.repeat(41) }, 'displayName'],
      [{ isAdmin: true }, 'isAdmin'],
    ];
    for (const [overrides, field] of bad) {
      const res = await signup(overrides);
      assert.equal(res.status, 400, JSON.stringify(overrides));
      assert.ok(res.body.errors.some((e) => e.field === field), `${JSON.stringify(overrides)} → ${field}`);
    }
    assert.equal((await api('POST', '/api/users', [])).status, 400);
    assert.equal((await api('POST', '/api/users', '{bad json')).status, 400);
    const [[{ n }]] = await ctx.pool.query('SELECT COUNT(*) AS n FROM users');
    assert.equal(n, 0);
  });
});

describe('POST /api/sessions (로그인), DELETE /api/sessions/current (로그아웃)', () => {
  beforeEach(async () => {
    await signup();
  });

  test('로그인하면 토큰이 나오고, 대소문자가 달라도 같은 계정', async () => {
    const res = await login({ email: ' A@EXAMPLE.com ' });
    assert.equal(res.status, 201);
    assert.ok(res.body.token.length >= 40);
    assert.equal(res.body.user.email, 'a@example.com');
    assert.ok(!/passwordHash|scrypt/.test(res.text));
  });

  test('이메일이 없든 비밀번호가 틀리든 똑같은 401 응답 (가입 여부를 알 수 없다)', async () => {
    const wrongPassword = await login({ password: 'wrong-pass1' });
    const unknownEmail = await login({ email: 'nobody@example.com' });
    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    assert.deepEqual(wrongPassword.body, unknownEmail.body);
  });

  test('필수값이 없으면 400', async () => {
    assert.equal((await login({ password: '' })).status, 400);
    assert.equal((await login({ email: '' })).status, 400);
  });

  test('실패가 8번 쌓이면 429, 그동안 맞는 비밀번호도 막히고 다른 이메일은 영향 없다', async () => {
    for (let i = 0; i < 8; i += 1) assert.equal((await login({ password: 'wrong-pass1' })).status, 401);
    const blocked = await login(); // 맞는 비밀번호인데도
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get('retry-after')) > 0);

    await signup({ email: 'b@example.com', displayName: '다른 사람' });
    assert.equal((await login({ email: 'b@example.com' })).status, 201);
  });

  test('로그인에 성공하면 그 전의 실패 횟수가 지워진다', async () => {
    for (let i = 0; i < 5; i += 1) await login({ password: 'wrong-pass1' });
    assert.equal((await login()).status, 201);
    for (let i = 0; i < 7; i += 1) assert.equal((await login({ password: 'wrong-pass1' })).status, 401);
  });

  test('로그아웃하면 그 토큰만 못 쓰게 되고 다른 기기의 로그인은 유지된다', async () => {
    const first = (await login()).body.token;
    const second = (await login()).body.token;
    assert.equal((await api('GET', '/api/users/me', undefined, bearer(first))).status, 200);

    const out = await api('DELETE', '/api/sessions/current', undefined, bearer(first));
    assert.equal(out.status, 204);
    assert.equal((await api('GET', '/api/users/me', undefined, bearer(first))).status, 401);
    assert.equal((await api('GET', '/api/users/me', undefined, bearer(second))).status, 200);
  });

  test('로그인 없이 로그아웃하면 401', async () => {
    assert.equal((await api('DELETE', '/api/sessions/current')).status, 401);
  });
});

describe('GET/PATCH /api/users/me', () => {
  test('토큰이 없거나 이상하거나 만료됐으면 401', async () => {
    const { token } = await registered();
    assert.equal((await api('GET', '/api/users/me')).status, 401);
    for (const header of ['Bearer', 'Bearer short', 'Basic abc', `Bearer ${token}x`, `bearer ${token}`]) {
      assert.equal((await api('GET', '/api/users/me', undefined, { Authorization: header })).status, 401, header);
    }
    assert.equal((await api('GET', '/api/users/me', undefined, bearer(token))).status, 200);

    await ctx.pool.query('UPDATE sessions SET expires_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 MINUTE)');
    assert.equal((await api('GET', '/api/users/me', undefined, bearer(token))).status, 401);
  });

  test('내 정보 조회', async () => {
    const { token, user } = await registered();
    const res = await api('GET', '/api/users/me', undefined, bearer(token));
    assert.deepEqual(res.body, user);
  });

  test('닉네임과 선호 플랫폼을 바꾸고 null로 비울 수 있다', async () => {
    const { token } = await registered();
    const h = bearer(token);
    const changed = await api('PATCH', '/api/users/me', { displayName: '새 닉네임', preferredPlatform: 'PC' }, h);
    assert.equal(changed.status, 200);
    assert.equal(changed.body.displayName, '새 닉네임');
    assert.equal(changed.body.preferredPlatform, 'PC');
    assert.equal((await api('GET', '/api/users/me', undefined, h)).body.preferredPlatform, 'PC');
    assert.equal((await api('PATCH', '/api/users/me', { preferredPlatform: null }, h)).body.preferredPlatform, null);
  });

  test('프로필 사진은 a01~a20 중에서 고르고 null로 기본 사진으로 되돌린다', async () => {
    const { token } = await registered();
    const h = bearer(token);
    for (const avatar of ['a01', 'a07', 'a20']) {
      const res = await api('PATCH', '/api/users/me', { avatar }, h);
      assert.equal(res.status, 200);
      assert.equal(res.body.avatar, avatar);
    }
    assert.equal((await api('GET', '/api/users/me', undefined, h)).body.avatar, 'a20');
    assert.equal((await api('PATCH', '/api/users/me', { avatar: null }, h)).body.avatar, null);
  });

  test('없는 사진 키나 이상한 값은 400 (경로 조작 문자 포함)', async () => {
    const { token } = await registered();
    for (const avatar of ['a00', 'a21', 'a1', '07', 'b05', 'default', '../a01', 'a01.svg', '', 7, ['a01']]) {
      assert.equal((await api('PATCH', '/api/users/me', { avatar }, bearer(token))).status, 400, JSON.stringify(avatar));
    }
  });

  test('시연용 샘플 계정(is_demo)의 토큰은 쓸 수 없다', async () => {
    const { token } = await registered();
    assert.equal((await api('GET', '/api/users/me', undefined, bearer(token))).status, 200);
    await ctx.pool.query('UPDATE users SET is_demo = 1');
    assert.equal((await api('GET', '/api/users/me', undefined, bearer(token))).status, 401);
  });

  test('잘못된 값이나 바꿀 수 없는 필드(이메일, 비밀번호)는 400', async () => {
    const { token } = await registered();
    const h = bearer(token);
    for (const body of [{ displayName: '' }, { preferredPlatform: 5 }, { email: 'x@example.com' }, { password: 'newpass123' }]) {
      assert.equal((await api('PATCH', '/api/users/me', body, h)).status, 400, JSON.stringify(body));
    }
  });
});

describe('내 관심 게임 (/api/users/me/favorites)', () => {
  let token;
  let h;
  beforeEach(async () => {
    token = (await registered()).token;
    h = bearer(token);
  });

  test('로그인 없이는 모두 401', async () => {
    for (const [method, path] of [['GET', '/api/users/me/favorites'], ['GET', '/api/users/me/favorites/ids'], ['PUT', '/api/users/me/favorites/1'], ['DELETE', '/api/users/me/favorites/1'], ['POST', '/api/users/me/favorites']]) {
      assert.equal((await api(method, path, method === 'POST' ? { gameIds: [1] } : undefined)).status, 401, `${method} ${path}`);
    }
  });

  test('추가(PUT)는 204이고 여러 번 해도 같다. 목록과 id 목록에 나온다', async () => {
    const a = await createGame('A');
    const b = await createGame('B');
    assert.equal((await api('PUT', `/api/users/me/favorites/${a.id}`, undefined, h)).status, 204);
    assert.equal((await api('PUT', `/api/users/me/favorites/${a.id}`, undefined, h)).status, 204); // 중복 추가해도 에러 없음
    await api('PUT', `/api/users/me/favorites/${b.id}`, undefined, h);

    const ids = (await api('GET', '/api/users/me/favorites/ids', undefined, h)).body;
    assert.deepEqual([...ids].sort(), [a.id, b.id].sort());
    const games = (await api('GET', '/api/users/me/favorites', undefined, h)).body;
    assert.deepEqual(games.map((g) => g.title).sort(), ['A', 'B']);
    assert.ok('price' in games[0] && 'stores' in games[0]); // 게임 목록과 같은 모양
  });

  test('삭제(DELETE)는 204이고 없는 걸 지워도 204', async () => {
    const a = await createGame('A');
    await api('PUT', `/api/users/me/favorites/${a.id}`, undefined, h);
    assert.equal((await api('DELETE', `/api/users/me/favorites/${a.id}`, undefined, h)).status, 204);
    assert.deepEqual((await api('GET', '/api/users/me/favorites/ids', undefined, h)).body, []);
    assert.equal((await api('DELETE', `/api/users/me/favorites/${a.id}`, undefined, h)).status, 204);
  });

  test('없는 게임은 404, 잘못된 id는 400', async () => {
    assert.equal((await api('PUT', '/api/users/me/favorites/99999', undefined, h)).status, 404);
    for (const id of ['abc', '0', '-1', '1.5']) {
      assert.equal((await api('PUT', `/api/users/me/favorites/${id}`, undefined, h)).status, 400, id);
    }
  });

  test('일괄 추가(POST): 있는 게임만 합치고 중복은 무시, 전체 id를 돌려준다 (로그인 전 목록 합치기)', async () => {
    const a = await createGame('A');
    const b = await createGame('B');
    await api('PUT', `/api/users/me/favorites/${a.id}`, undefined, h);
    const res = await api('POST', '/api/users/me/favorites', { gameIds: [a.id, b.id, 99999, b.id] }, h);
    assert.equal(res.status, 200);
    assert.deepEqual([...res.body].sort(), [a.id, b.id].sort());
  });

  test('일괄 추가 검증: 배열이 아니거나 숫자가 아니거나 너무 많으면 400, 빈 배열은 허용', async () => {
    for (const gameIds of ['1,2', [1, 'a'], [0], [-1], [1.5], Array.from({ length: 501 }, (_, i) => i + 1)]) {
      assert.equal((await api('POST', '/api/users/me/favorites', { gameIds }, h)).status, 400, JSON.stringify(gameIds).slice(0, 30));
    }
    assert.equal((await api('POST', '/api/users/me/favorites', { gameIds: [] }, h)).status, 200);
    assert.equal((await api('POST', '/api/users/me/favorites', {}, h)).status, 400);
  });

  test('사용자마다 따로 저장된다', async () => {
    const a = await createGame('A');
    await api('PUT', `/api/users/me/favorites/${a.id}`, undefined, h);
    const other = (await registered({ email: 'b@example.com', displayName: '다른 사람' })).token;
    assert.deepEqual((await api('GET', '/api/users/me/favorites/ids', undefined, bearer(other))).body, []);
    await api('DELETE', `/api/users/me/favorites/${a.id}`, undefined, bearer(other)); // 남의 것을 지우려 해도 영향 없음
    assert.deepEqual((await api('GET', '/api/users/me/favorites/ids', undefined, h)).body, [a.id]);
  });

  test('게임이 삭제되면 에러 없이 목록에서 빠진다', async () => {
    const a = await createGame('A');
    const b = await createGame('B');
    await api('POST', '/api/users/me/favorites', { gameIds: [a.id, b.id] }, h);
    await api('DELETE', `/api/games/${a.id}`);
    assert.deepEqual((await api('GET', '/api/users/me/favorites/ids', undefined, h)).body, [b.id]);
    assert.deepEqual((await api('GET', '/api/users/me/favorites', undefined, h)).body.map((g) => g.title), ['B']);
  });

  test('로그아웃 후 다시 로그인해도 관심 게임이 남아 있다', async () => {
    const a = await createGame('A');
    await api('PUT', `/api/users/me/favorites/${a.id}`, undefined, h);
    await api('DELETE', '/api/sessions/current', undefined, h);
    const again = (await login()).body.token;
    assert.deepEqual((await api('GET', '/api/users/me/favorites/ids', undefined, bearer(again))).body, [a.id]);
  });
});

describe('CORS (브라우저에서 Authorization 헤더를 쓸 수 있어야 한다)', () => {
  test('사전 요청(OPTIONS)이 허용된 주소에 대해 통과한다', async () => {
    const res = await fetch(`${ctx.base}/api/users/me/favorites/1`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://127.0.0.1:5173', 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'authorization,content-type' },
    });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5173');
    assert.match(res.headers.get('access-control-allow-methods') ?? '', /PUT/);
    assert.match((res.headers.get('access-control-allow-headers') ?? '').toLowerCase(), /authorization/);
  });
});
