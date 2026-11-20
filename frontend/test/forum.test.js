import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { AVATAR_KEYS, avatarPath, isAvatarKey } from '../src/lib/avatars.js';
import { createApi } from '../src/api/client.js';

describe('프로필 사진 키와 주소', () => {
  test('키는 a01~a20 스무 개이고 파일이 실제로 모두 있다 (기본 사진 포함)', () => {
    assert.equal(AVATAR_KEYS.length, 20);
    assert.equal(AVATAR_KEYS[0], 'a01');
    assert.equal(AVATAR_KEYS[19], 'a20');
    const files = readdirSync(new URL('../public/avatars/', import.meta.url));
    for (const key of AVATAR_KEYS) assert.ok(files.includes(`${key}.svg`), `${key}.svg`);
    assert.ok(files.includes('default.svg'));
    assert.equal(files.length, 21);
  });

  test('올바른 키면 그 사진, 아니면 기본 사진 (경로 조작 문자는 절대 주소에 반영되지 않는다)', () => {
    assert.equal(avatarPath('a07'), '/avatars/a07.svg');
    assert.equal(avatarPath(null), '/avatars/default.svg');
    assert.equal(avatarPath(undefined), '/avatars/default.svg');
    for (const bad of ['a21', 'a00', '../a01', 'a01.svg', '', 'default', 5, ['a01'], { a: 1 }]) {
      assert.equal(avatarPath(bad), '/avatars/default.svg', JSON.stringify(bad));
    }
    assert.equal(avatarPath('a03', '/app/'), '/app/avatars/a03.svg');
    assert.equal(isAvatarKey('a20'), true);
    assert.equal(isAvatarKey('a21'), false);
  });
});

describe('API 클라이언트: 포럼', () => {
  const res = (status, body, headers = {}) => ({
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (k) => headers[k] ?? null },
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  });
  const make = (handler = () => res(200, [])) => {
    const calls = [];
    const api = createApi({ baseUrl: 'http://test', getToken: () => 'x'.repeat(30), fetchImpl: async (url, options) => (calls.push({ url, options }), handler(url, options)) });
    return { api, calls };
  };

  test('글 목록: 쿼리 조립과 전체 개수 헤더', async () => {
    const { api, calls } = make(() => res(200, [{ id: 1 }], { 'X-Total-Count': '18' }));
    const out = await api.forumPosts({ category: '질문', sort: 'popular', q: '', limit: 30 });
    assert.deepEqual(out, { items: [{ id: 1 }], total: 18 });
    assert.equal(calls[0].url, 'http://test/api/forum/posts?category=%EC%A7%88%EB%AC%B8&sort=popular&limit=30');
  });

  test('글 읽기/쓰기/삭제와 댓글, 좋아요의 메서드와 주소', async () => {
    const { api, calls } = make(() => res(204));
    await api.forumPost(5);
    await api.createForumPost({ category: '자유', title: '제목', body: '내용', gameId: 3, extra: 'x' });
    await api.deleteForumPost(5);
    await api.addForumComment(5, '댓글');
    await api.deleteForumComment(5, 9);
    await api.likeForumPost(5);
    await api.unlikeForumPost(5);
    assert.deepEqual(calls.map((c) => `${c.options.method} ${c.url}`), [
      'GET http://test/api/forum/posts/5',
      'POST http://test/api/forum/posts',
      'DELETE http://test/api/forum/posts/5',
      'POST http://test/api/forum/posts/5/comments',
      'DELETE http://test/api/forum/posts/5/comments/9',
      'PUT http://test/api/forum/posts/5/like',
      'DELETE http://test/api/forum/posts/5/like',
    ]);
    assert.deepEqual(JSON.parse(calls[1].options.body), { category: '자유', title: '제목', body: '내용', gameId: 3 }); // 필요한 필드만
    assert.deepEqual(JSON.parse(calls[3].options.body), { body: '댓글' });
    assert.ok(calls.every((c) => c.options.headers.Authorization?.startsWith('Bearer ')));
  });
});
