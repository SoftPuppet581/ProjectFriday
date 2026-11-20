// 시연용 샘플 계정/포럼 데이터 테스트
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup, sample } from './helpers.js';

let ctx;
let seed;
let data;
const api = (...args) => ctx.api(...args);

before(async () => {
  ctx = await setup();
  seed = await import('../src/services/demoSeed.js');
  data = await import('../db/demoForum.js');
});
after(async () => {
  await ctx.teardown();
});
beforeEach(async () => {
  await ctx.pool.query('DELETE FROM users');
  await ctx.pool.query('TRUNCATE TABLE games');
});

describe('데이터 자체 검사', () => {
  test('계정 20개, 프로필 사진 키가 a01~a20으로 서로 겹치지 않는다', () => {
    assert.equal(data.DEMO_USERS.length, 20);
    const keys = data.DEMO_USERS.map(([, avatar]) => avatar).sort();
    assert.deepEqual(keys, Array.from({ length: 20 }, (_, i) => `a${String(i + 1).padStart(2, '0')}`));
    assert.equal(new Set(data.DEMO_USERS.map(([name]) => name)).size, 20, '닉네임이 겹치면 안 된다');
  });

  test('모든 글, 댓글, 좋아요의 작성자가 실제 샘플 계정이고 길이 제한을 지킨다', () => {
    const names = new Set(data.DEMO_USERS.map(([name]) => name));
    for (const post of data.DEMO_POSTS) {
      assert.ok(names.has(post.by), `작성자 ${post.by}`);
      assert.ok(['자유', '질문', '추천', '공략'].includes(post.category), post.title);
      assert.ok([...post.title].length <= 100 && [...post.body].length <= 3000, post.title);
      for (const c of post.comments ?? []) {
        assert.ok(names.has(c.by), `${post.title}의 댓글 작성자 ${c.by}`);
        assert.ok([...c.body].length >= 1 && [...c.body].length <= 1000);
        assert.ok(c.after > 0 && c.after < post.ago, `${post.title}: 댓글이 글보다 먼저이거나 현재보다 미래면 안 된다`);
      }
      for (const name of post.likes ?? []) assert.ok(names.has(name), `${post.title}의 좋아요 ${name}`);
    }
  });

  test('성인 콘텐츠 필터에 걸리는 내용이 없다', async () => {
    const { isAdultText } = await import('../src/services/contentFilter.js');
    for (const post of data.DEMO_POSTS) {
      assert.equal(isAdultText(`${post.title} ${post.body}`), false, post.title);
      for (const c of post.comments ?? []) assert.equal(isAdultText(c.body), false, c.body);
    }
  });
});

describe('seedDemo / removeDemo', () => {
  const NOW = Date.parse('2026-11-20T06:00:00Z');

  test('계정 20개와 글, 댓글, 좋아요가 들어가고 모두 샘플 표시가 붙는다', async () => {
    const stats = await seed.seedDemo(ctx.pool, { now: NOW });
    assert.equal(stats.users, 20);
    assert.equal(stats.posts, data.DEMO_POSTS.length);
    assert.equal(stats.comments, data.DEMO_POSTS.reduce((n, p) => n + (p.comments?.length ?? 0), 0));

    const [[{ demo, total }]] = await ctx.pool.query('SELECT SUM(is_demo = 1) AS demo, COUNT(*) AS total FROM users');
    assert.equal(Number(demo), 20);
    assert.equal(total, 20);
    const [users] = await ctx.pool.query('SELECT email, avatar FROM users ORDER BY id');
    assert.ok(users.every((u) => u.email.endsWith('@demo.invalid')), '이메일은 존재할 수 없는 .invalid 주소');
    assert.equal(new Set(users.map((u) => u.avatar)).size, 20);
  });

  test('시각이 현재 기준으로 과거에 흩어져 있고 미래가 없다. 댓글은 글보다 늦다', async () => {
    await seed.seedDemo(ctx.pool, { now: NOW });
    const [posts] = await ctx.pool.query('SELECT UNIX_TIMESTAMP(created_at) * 1000 AS t FROM forum_posts');
    const [comments] = await ctx.pool.query(
      'SELECT UNIX_TIMESTAMP(c.created_at) * 1000 AS t, UNIX_TIMESTAMP(p.created_at) * 1000 AS postT FROM forum_comments c JOIN forum_posts p ON p.id = c.post_id',
    );
    assert.ok(posts.every((p) => p.t < NOW));
    assert.ok(comments.every((c) => c.t < NOW && c.t >= c.postT));
    const hours = posts.map((p) => (NOW - p.t) / 3600_000);
    assert.ok(Math.min(...hours) < 12 && Math.max(...hours) > 100, '최근 글과 오래된 글이 섞여 있어야 한다');
  });

  test('다시 실행해도 중복되지 않는다', async () => {
    await seed.seedDemo(ctx.pool, { now: NOW });
    await seed.seedDemo(ctx.pool, { now: NOW });
    const [[{ users }]] = await ctx.pool.query('SELECT COUNT(*) AS users FROM users');
    const [[{ posts }]] = await ctx.pool.query('SELECT COUNT(*) AS posts FROM forum_posts');
    assert.equal(users, 20);
    assert.equal(posts, data.DEMO_POSTS.length);
  });

  test('DB에 있는 게임은 글에 연결되고 없는 게임은 연결하지 않고 알려 준다', async () => {
    await api('POST', '/api/games', sample({ title: 'Grand Theft Auto VI' }));
    const stats = await seed.seedDemo(ctx.pool, { now: NOW });
    const [[linked]] = await ctx.pool.query("SELECT g.title FROM forum_posts p JOIN games g ON g.id = p.game_id WHERE p.title LIKE 'GTA6%'");
    assert.equal(linked.title, 'Grand Theft Auto VI');
    assert.ok(stats.unlinkedGames.length > 0 && !stats.unlinkedGames.includes('Grand Theft Auto VI'));
  });

  test('API로 보면 작성자 닉네임과 프로필 사진이 나오고, 이메일은 나오지 않는다', async () => {
    await seed.seedDemo(ctx.pool, { now: NOW });
    const res = await api('GET', '/api/forum/posts?limit=50');
    assert.equal(res.headers.get('x-total-count'), String(data.DEMO_POSTS.length));
    assert.ok(res.body.every((p) => /^a\d\d$/.test(p.author.avatar) && p.author.displayName));
    assert.ok(!res.text.includes('demo.invalid') && !res.text.includes('@'));
    const detail = (await api('GET', `/api/forum/posts/${res.body[0].id}`)).body;
    assert.ok(detail.comments.every((c) => c.author.displayName));
  });

  test('샘플 계정으로는 로그인할 수 없다 (비밀번호를 아무도 모르고 토큰도 거부된다)', async () => {
    await seed.seedDemo(ctx.pool, { now: NOW });
    for (const password of ['password1234', 'demo1234', 'passw0rd123', '12345678a']) {
      assert.equal((await api('POST', '/api/sessions', { email: 'demo-01@demo.invalid', password })).status, 401);
    }
    // 토큰이 어떻게든 만들어졌다고 해도 샘플 계정이면 거부된다
    const [[user]] = await ctx.pool.query('SELECT id FROM users LIMIT 1');
    const { newToken, hashToken } = await import('../src/services/passwords.js');
    const token = newToken();
    await ctx.pool.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 DAY))', [hashToken(token), user.id]);
    assert.equal((await api('GET', '/api/users/me', undefined, { Authorization: `Bearer ${token}` })).status, 401);
  });

  test('removeDemo는 샘플만 지우고 실제 사용자와 그 글은 그대로 둔다', async () => {
    const real = await api('POST', '/api/users', { email: 'real@example.com', password: 'passw0rd123', displayName: '실제 사용자' });
    await api('POST', '/api/forum/posts', { category: '자유', title: '진짜 글', body: '진짜' }, { Authorization: `Bearer ${real.body.token}` });
    await seed.seedDemo(ctx.pool, { now: NOW });
    assert.equal(await seed.removeDemo(ctx.pool), 20);

    const [[{ users }]] = await ctx.pool.query('SELECT COUNT(*) AS users FROM users');
    assert.equal(users, 1);
    const posts = (await api('GET', '/api/forum/posts')).body;
    assert.deepEqual(posts.map((p) => p.title), ['진짜 글']);
    const [[{ c }]] = await ctx.pool.query('SELECT COUNT(*) AS c FROM forum_comments');
    assert.equal(c, 0);
  });
});
