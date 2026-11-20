// 포럼(글, 댓글, 좋아요) 테스트
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup, sample } from './helpers.js';

let ctx;
let rateLimit;
const api = (...args) => ctx.api(...args);

before(async () => {
  ctx = await setup();
  rateLimit = await import('../src/middleware/rateLimit.js');
});
after(async () => {
  await ctx.teardown();
});
beforeEach(async () => {
  await ctx.pool.query('DELETE FROM users'); // 글, 댓글, 좋아요, 세션은 연쇄로 지워진다
  await ctx.pool.query('TRUNCATE TABLE games');
  rateLimit.resetRateLimits();
});

const bearer = (token) => ({ Authorization: `Bearer ${token}` });
const join = async (n, extra = {}) => {
  const res = await api('POST', '/api/users', { email: `u${n}@example.com`, password: 'passw0rd123', displayName: `유저${n}`, ...extra });
  return { token: res.body.token, id: res.body.user.id, h: bearer(res.body.token) };
};
const post = (user, overrides = {}) => api('POST', '/api/forum/posts', { category: '자유', title: '제목', body: '내용입니다', ...overrides }, user.h);

describe('글 쓰기와 읽기', () => {
  test('로그인 없이 쓰면 401, 읽기는 로그인 없이도 된다', async () => {
    assert.equal((await api('POST', '/api/forum/posts', { category: '자유', title: 't', body: 'b' })).status, 401);
    assert.equal((await api('GET', '/api/forum/posts')).status, 200);
  });

  test('글을 쓰면 201과 작성자 정보(닉네임, 프로필 사진)가 같이 온다. 이메일은 나오지 않는다', async () => {
    const user = await join(1);
    await api('PATCH', '/api/users/me', { avatar: 'a07' }, user.h);
    const res = await post(user, { title: '  첫 글  ', body: ' 안녕하세요 ' });
    assert.equal(res.status, 201);
    assert.equal(res.headers.get('location'), `/api/forum/posts/${res.body.id}`);
    assert.equal(res.body.title, '첫 글');
    assert.equal(res.body.body, '안녕하세요');
    assert.deepEqual(res.body.author, { id: user.id, displayName: '유저1', avatar: 'a07' });
    assert.equal(res.body.mine, true);
    assert.equal(res.body.commentCount, 0);
    assert.equal(res.body.likeCount, 0);
    assert.ok(Math.abs(Date.parse(res.body.createdAt) - Date.now()) < 15000);
    assert.ok(!res.text.includes('example.com'));
  });

  test('입력 검증: 분류, 제목, 내용, 알 수 없는 필드, 없는 게임', async () => {
    const user = await join(1);
    const cases = [
      [{ category: '없는분류' }, 'category'],
      [{ title: '' }, 'title'],
      [{ title: '가'.repeat(101) }, 'title'],
      [{ body: '' }, 'body'],
      [{ body: '가'.repeat(3001) }, 'body'],
      [{ gameId: 'a' }, 'gameId'],
      [{ gameId: 99999 }, 'gameId'],
      [{ userId: 1 }, 'userId'],
    ];
    for (const [overrides, field] of cases) {
      const res = await post(user, overrides);
      assert.equal(res.status, 400, JSON.stringify(overrides));
      assert.ok(res.body.errors.some((e) => e.field === field), `${JSON.stringify(overrides)} → ${field}`);
    }
  });

  test('게임을 연결하면 목록과 상세에 게임 정보가 나온다', async () => {
    const user = await join(1);
    const game = (await api('POST', '/api/games', sample({ title: '연결할 게임' }))).body;
    const created = await post(user, { gameId: game.id });
    assert.deepEqual(created.body.game, { id: game.id, title: '연결할 게임' });
    assert.deepEqual((await api('GET', '/api/forum/posts')).body[0].game, { id: game.id, title: '연결할 게임' });
    assert.equal((await post(user)).body.game, null);
  });

  test('목록은 최신순, 본문 대신 140자 이내 요약(excerpt)을 준다', async () => {
    const user = await join(1);
    await post(user, { title: '먼저' });
    await post(user, { title: '나중', body: '가'.repeat(500) });
    const list = (await api('GET', '/api/forum/posts')).body;
    assert.deepEqual(list.map((p) => p.title), ['나중', '먼저']);
    assert.equal([...list[0].excerpt].length, 140);
    assert.equal('body' in list[0], false);
    assert.equal('comments' in list[0], false);
  });

  test('분류, 검색, 게임, 정렬, 페이지 필터와 X-Total-Count', async () => {
    const user = await join(1);
    const game = (await api('POST', '/api/games', sample({ title: 'G' }))).body;
    await post(user, { category: '질문', title: '사양 질문', body: '그래픽카드 추천' });
    await post(user, { category: '추천', title: '협동 게임 추천', gameId: game.id });
    await post(user, { category: '자유', title: '잡담' });

    const byCategory = await api('GET', '/api/forum/posts?category=질문');
    assert.deepEqual(byCategory.body.map((p) => p.title), ['사양 질문']);
    assert.equal(byCategory.headers.get('x-total-count'), '1');
    assert.deepEqual((await api('GET', `/api/forum/posts?q=${encodeURIComponent('그래픽')}`)).body.map((p) => p.title), ['사양 질문']);
    assert.deepEqual((await api('GET', `/api/forum/posts?gameId=${game.id}`)).body.map((p) => p.title), ['협동 게임 추천']);
    const paged = await api('GET', '/api/forum/posts?limit=2&page=2');
    assert.deepEqual(paged.body.map((p) => p.title), ['사양 질문']);
    assert.equal(paged.headers.get('x-total-count'), '3');
  });

  test('인기순은 좋아요와 댓글이 많은 글이 먼저', async () => {
    const [a, b, c] = [await join(1), await join(2), await join(3)];
    const quiet = (await post(a, { title: '조용한 글' })).body;
    const hot = (await post(a, { title: '인기 글' })).body;
    await post(a, { title: '최신 글' });
    await api('PUT', `/api/forum/posts/${hot.id}/like`, undefined, b.h);
    await api('PUT', `/api/forum/posts/${hot.id}/like`, undefined, c.h);
    await api('POST', `/api/forum/posts/${hot.id}/comments`, { body: '댓글' }, b.h);
    await api('PUT', `/api/forum/posts/${quiet.id}/like`, undefined, b.h);
    const popular = (await api('GET', '/api/forum/posts?sort=popular')).body;
    assert.deepEqual(popular.map((p) => p.title), ['인기 글', '조용한 글', '최신 글']);
  });

  test('잘못된 쿼리는 400', async () => {
    for (const query of ['category=x', 'sort=x', 'limit=0', 'limit=51', 'page=0', 'gameId=0']) {
      assert.equal((await api('GET', `/api/forum/posts?${query}`)).status, 400, query);
    }
  });

  test('상세에는 본문과 댓글이 시간순으로 들어 있고, 없는 글은 404, 잘못된 id는 400', async () => {
    const [a, b] = [await join(1), await join(2)];
    const created = (await post(a, { body: '본문 전체' })).body;
    await api('POST', `/api/forum/posts/${created.id}/comments`, { body: '첫 댓글' }, b.h);
    await api('POST', `/api/forum/posts/${created.id}/comments`, { body: '둘째 댓글' }, a.h);
    const detail = (await api('GET', `/api/forum/posts/${created.id}`)).body;
    assert.equal(detail.body, '본문 전체');
    assert.deepEqual(detail.comments.map((c) => c.body), ['첫 댓글', '둘째 댓글']);
    assert.equal(detail.comments[0].author.displayName, '유저2');
    assert.equal(detail.commentCount, 2);
    assert.equal((await api('GET', '/api/forum/posts/99999')).status, 404);
    assert.equal((await api('GET', '/api/forum/posts/abc')).status, 400);
  });
});

describe('댓글', () => {
  test('로그인해야 쓸 수 있고, 없는 글은 404, 검증 오류는 400', async () => {
    const user = await join(1);
    const created = (await post(user)).body;
    assert.equal((await api('POST', `/api/forum/posts/${created.id}/comments`, { body: 'x' })).status, 401);
    assert.equal((await api('POST', '/api/forum/posts/99999/comments', { body: 'x' }, user.h)).status, 404);
    for (const body of ['', '   ', '가'.repeat(1001)]) {
      assert.equal((await api('POST', `/api/forum/posts/${created.id}/comments`, { body }, user.h)).status, 400, body.slice(0, 5));
    }
    const ok = await api('POST', `/api/forum/posts/${created.id}/comments`, { body: ' 좋은 글이네요 ' }, user.h);
    assert.equal(ok.status, 201);
    assert.equal(ok.body.body, '좋은 글이네요');
    assert.equal(ok.body.mine, true);
    assert.equal(ok.body.author.displayName, '유저1');
  });
});

describe('삭제와 권한', () => {
  test('내 글만 지울 수 있다 (남의 글은 403, 없는 글은 404, 로그인 없으면 401)', async () => {
    const [a, b] = [await join(1), await join(2)];
    const created = (await post(a)).body;
    assert.equal((await api('DELETE', `/api/forum/posts/${created.id}`)).status, 401);
    assert.equal((await api('DELETE', `/api/forum/posts/${created.id}`, undefined, b.h)).status, 403);
    assert.equal((await api('GET', `/api/forum/posts/${created.id}`)).status, 200); // 아직 있음
    assert.equal((await api('DELETE', `/api/forum/posts/${created.id}`, undefined, a.h)).status, 204);
    assert.equal((await api('GET', `/api/forum/posts/${created.id}`)).status, 404);
    assert.equal((await api('DELETE', `/api/forum/posts/${created.id}`, undefined, a.h)).status, 404);
  });

  test('글을 지우면 댓글과 좋아요도 같이 지워진다', async () => {
    const [a, b] = [await join(1), await join(2)];
    const created = (await post(a)).body;
    await api('POST', `/api/forum/posts/${created.id}/comments`, { body: '댓글' }, b.h);
    await api('PUT', `/api/forum/posts/${created.id}/like`, undefined, b.h);
    await api('DELETE', `/api/forum/posts/${created.id}`, undefined, a.h);
    const [[{ c }]] = await ctx.pool.query('SELECT COUNT(*) AS c FROM forum_comments');
    const [[{ l }]] = await ctx.pool.query('SELECT COUNT(*) AS l FROM forum_likes');
    assert.deepEqual([c, l], [0, 0]);
  });

  test('내 댓글만 지울 수 있다', async () => {
    const [a, b] = [await join(1), await join(2)];
    const created = (await post(a)).body;
    const comment = (await api('POST', `/api/forum/posts/${created.id}/comments`, { body: '내 댓글' }, b.h)).body;
    assert.equal((await api('DELETE', `/api/forum/posts/${created.id}/comments/${comment.id}`, undefined, a.h)).status, 403); // 글쓴이도 남의 댓글은 못 지운다
    assert.equal((await api('DELETE', `/api/forum/posts/${created.id}/comments/${comment.id}`, undefined, b.h)).status, 204);
    assert.equal((await api('DELETE', `/api/forum/posts/${created.id}/comments/${comment.id}`, undefined, b.h)).status, 404);
    assert.equal((await api('GET', `/api/forum/posts/${created.id}`)).body.comments.length, 0);
  });

  test('댓글 id가 다른 글의 것이면 404 (글 id를 바꿔치기해서 지울 수 없다)', async () => {
    const a = await join(1);
    const first = (await post(a, { title: '1' })).body;
    const second = (await post(a, { title: '2' })).body;
    const comment = (await api('POST', `/api/forum/posts/${first.id}/comments`, { body: 'x' }, a.h)).body;
    assert.equal((await api('DELETE', `/api/forum/posts/${second.id}/comments/${comment.id}`, undefined, a.h)).status, 404);
  });

  test('계정이 삭제되면 그 사람의 글과 댓글도 사라진다', async () => {
    const [a, b] = [await join(1), await join(2)];
    const created = (await post(a)).body;
    await api('POST', `/api/forum/posts/${created.id}/comments`, { body: '댓글' }, b.h);
    await ctx.pool.query('DELETE FROM users WHERE id = ?', [b.id]);
    assert.equal((await api('GET', `/api/forum/posts/${created.id}`)).body.comments.length, 0);
    await ctx.pool.query('DELETE FROM users WHERE id = ?', [a.id]);
    assert.equal((await api('GET', '/api/forum/posts')).body.length, 0);
  });
});

describe('좋아요', () => {
  test('좋아요는 여러 번 눌러도 한 번만, 취소는 없어도 204, 로그인이 필요하다', async () => {
    const [a, b] = [await join(1), await join(2)];
    const created = (await post(a)).body;
    assert.equal((await api('PUT', `/api/forum/posts/${created.id}/like`)).status, 401);
    assert.equal((await api('PUT', `/api/forum/posts/${created.id}/like`, undefined, b.h)).status, 204);
    assert.equal((await api('PUT', `/api/forum/posts/${created.id}/like`, undefined, b.h)).status, 204);
    assert.equal((await api('GET', `/api/forum/posts/${created.id}`)).body.likeCount, 1);
    assert.equal((await api('DELETE', `/api/forum/posts/${created.id}/like`, undefined, b.h)).status, 204);
    assert.equal((await api('DELETE', `/api/forum/posts/${created.id}/like`, undefined, b.h)).status, 204);
    assert.equal((await api('GET', `/api/forum/posts/${created.id}`)).body.likeCount, 0);
    assert.equal((await api('PUT', '/api/forum/posts/99999/like', undefined, b.h)).status, 404);
  });

  test('liked와 mine은 보는 사람 기준이다 (로그인 안 했으면 모두 false)', async () => {
    const [a, b] = [await join(1), await join(2)];
    const created = (await post(a)).body;
    await api('PUT', `/api/forum/posts/${created.id}/like`, undefined, b.h);

    const asB = (await api('GET', '/api/forum/posts', undefined, b.h)).body[0];
    assert.deepEqual([asB.liked, asB.mine], [true, false]);
    const asA = (await api('GET', `/api/forum/posts/${created.id}`, undefined, a.h)).body;
    assert.deepEqual([asA.liked, asA.mine], [false, true]);
    const anonymous = (await api('GET', '/api/forum/posts')).body[0];
    assert.deepEqual([anonymous.liked, anonymous.mine], [false, false]);
    // 잘못된 토큰으로 읽어도 에러가 아니라 비로그인처럼 보인다
    assert.equal((await api('GET', '/api/forum/posts', undefined, bearer('x'.repeat(30)))).status, 200);
  });
});
