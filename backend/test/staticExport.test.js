// 배포용 정적 데이터 내보내기 테스트: 개인정보가 새지 않는지가 핵심이다
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup, sample } from './helpers.js';

let ctx;
let exporter;
let seed;
const api = (...args) => ctx.api(...args);

before(async () => {
  ctx = await setup();
  exporter = await import('../src/services/staticExport.js');
  seed = await import('../src/services/demoSeed.js');
});
after(async () => {
  await ctx.teardown();
});
beforeEach(async () => {
  await ctx.pool.query('DELETE FROM users');
  await ctx.pool.query('TRUNCATE TABLE games');
  await ctx.pool.query('TRUNCATE TABLE news');
});

const NOW = Date.parse('2026-11-20T06:00:00Z');

describe('buildSnapshot', () => {
  test('게임, 대작 id, 뉴스, 포럼, 메타가 들어 있고 게임에서 createdAt/updatedAt은 빠진다', async () => {
    const a = (await api('POST', '/api/games', sample({ title: 'A', featuredOrder: 2 }))).body;
    const b = (await api('POST', '/api/games', sample({ title: 'B', featuredOrder: 1 }))).body;
    const News = await import('../src/models/News.js');
    await News.upsertMany([{ source: 'S', language: 'ko', title: '기사', url: 'https://example.com/n', excerpt: null, imageUrl: null, publishedAt: '2026-11-19 00:00:00' }]);

    const snap = await exporter.buildSnapshot(ctx.pool, { now: new Date(NOW) });
    assert.deepEqual(snap.games.map((g) => g.title).sort(), ['A', 'B']);
    assert.ok(snap.games.every((g) => !('createdAt' in g) && !('updatedAt' in g)));
    assert.deepEqual(snap.featured, [b.id, a.id]); // 순서대로
    assert.equal(snap.news.length, 1);
    assert.deepEqual(snap.meta, { exportedAt: '2026-11-20T06:00:00.000Z', games: 2, news: 1, forumPosts: 0 });
  });

  test('포럼은 샘플 계정의 글만 나온다. 실제 사용자의 글, 댓글, 좋아요는 어디에도 없다', async () => {
    await seed.seedDemo(ctx.pool, { now: NOW });
    const real = await api('POST', '/api/users', { email: 'real.person@example.com', password: 'passw0rd123', displayName: '실제사용자' });
    const h = { Authorization: `Bearer ${real.body.token}` };
    const [[firstDemoPost]] = await ctx.pool.query('SELECT id FROM forum_posts ORDER BY id LIMIT 1');
    await api('POST', '/api/forum/posts', { category: '자유', title: '실제 사용자의 비밀 글', body: '이건 내보내면 안 된다' }, h);
    await api('POST', `/api/forum/posts/${firstDemoPost.id}/comments`, { body: '실제 사용자의 댓글' }, h);
    await api('PUT', `/api/forum/posts/${firstDemoPost.id}/like`, undefined, h);

    const snap = await exporter.buildSnapshot(ctx.pool, { now: new Date(NOW) });
    const text = JSON.stringify(snap);
    assert.ok(!text.includes('실제 사용자의 비밀 글') && !text.includes('실제 사용자의 댓글') && !text.includes('실제사용자'));
    assert.ok(snap.forum.length > 0 && snap.forum.every((p) => p.title !== '실제 사용자의 비밀 글'));

    const original = snap.forum.find((p) => p.id === firstDemoPost.id);
    assert.equal(original.commentCount, original.comments.length); // 실제 사용자의 댓글이 빠진 개수와 맞는다
    const [[{ demoLikes }]] = await ctx.pool.query(
      'SELECT COUNT(*) AS demoLikes FROM forum_likes l JOIN users u ON u.id = l.user_id WHERE u.is_demo = 1 AND l.post_id = ?', [firstDemoPost.id]);
    assert.equal(original.likeCount, demoLikes); // 실제 사용자의 좋아요는 세지 않는다
  });

  test('이메일, 비밀번호, 토큰 같은 개인정보가 스냅샷 어디에도 없다', async () => {
    await seed.seedDemo(ctx.pool, { now: NOW });
    await api('POST', '/api/users', { email: 'secret.mail@example.com', password: 'passw0rd123', displayName: '비밀' });
    const text = JSON.stringify(await exporter.buildSnapshot(ctx.pool, { now: new Date(NOW) }));
    for (const forbidden of ['demo.invalid', 'secret.mail', 'example.com/', 'passwordHash', 'password_hash', 'scrypt$', 'token', 'sessions']) {
      if (forbidden === 'example.com/') continue; // 뉴스/게임 데이터의 외부 주소는 정상
      assert.ok(!text.includes(forbidden), `"${forbidden}"가 들어 있다`);
    }
    for (const post of JSON.parse(text).forum) {
      assert.deepEqual(Object.keys(post.author).sort(), ['avatar', 'displayName', 'id']);
      assert.equal(post.mine, false);
      assert.equal(post.liked, false);
    }
  });

  test('포럼 글에 게임 연결이 유지되고, 댓글은 시간순이다', async () => {
    await api('POST', '/api/games', sample({ title: 'Grand Theft Auto VI' }));
    await seed.seedDemo(ctx.pool, { now: NOW });
    const snap = await exporter.buildSnapshot(ctx.pool, { now: new Date(NOW) });
    assert.ok(snap.forum.some((p) => p.game?.title === 'Grand Theft Auto VI'));
    for (const post of snap.forum) {
      const times = post.comments.map((c) => Date.parse(c.createdAt));
      assert.deepEqual(times, [...times].sort((x, y) => x - y));
    }
    assert.deepEqual(snap.forum.map((p) => Date.parse(p.createdAt)), snap.forum.map((p) => Date.parse(p.createdAt)).sort((x, y) => y - x)); // 최신순
  });
});
