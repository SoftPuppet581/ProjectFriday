import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStaticApi } from '../src/api/staticApi.js';
import { ApiError } from '../src/api/errors.js';

const game = (id, over = {}) => ({
  id, title: `Game ${id}`, releaseDate: '2026-12-01', platforms: ['PC'], genre: null, genres: [], tags: [], description: null,
  coverImageUrl: `https://img/${id}.jpg`, rating: null, popularity: null, metacritic: null, sourceUrl: null, officialUrl: null, ...over,
});

const GAMES = [
  game(1, { title: 'Alpha Quest', releaseDate: '2026-12-01', platforms: ['PC', 'PS5'], genre: 'RPG', genres: ['RPG', 'Action'], tags: ['Co-op'], rating: 4.5, popularity: 900, description: 'A Fantasy adventure' }),
  game(2, { title: 'beta Racer', releaseDate: '2026-12-01', platforms: ['PC'], genre: 'Racing', genres: ['Racing'], rating: 3.0, popularity: 100 }),
  game(3, { title: 'Gamma Shooter', releaseDate: '2026-12-15', platforms: ['Switch'], genre: 'Action', genres: ['Action'], tags: ['Co-op'], rating: 4.0, popularity: 500, metacritic: 80 }),
  game(4, { title: 'Delta Puzzle', releaseDate: '2026-12-31', platforms: ['PC'], genre: 'Puzzle', genres: [], rating: null, popularity: null }), // genres가 비어 있으면 genre만
  game(5, { title: 'Epsilon', releaseDate: '2027-01-01', platforms: [], genres: [], genre: null, rating: 2.0 }),
  game(6, { title: 'Zeta RPG', releaseDate: '2026-12-01', platforms: ['PC'], genre: 'RPG', genres: ['RPG'], tags: ['Co-op', 'Open World'], rating: 4.5, popularity: 900 }),
];
const NEWS = [
  { id: 1, source: 'IGN', language: 'en', title: 'Big reveal', excerpt: 'trailer', url: 'https://a', imageUrl: null, publishedAt: '2026-11-19T10:00:00Z' },
  { id: 2, source: '인벤', language: 'ko', title: '출시 소식', excerpt: null, url: 'https://b', imageUrl: null, publishedAt: '2026-11-20T01:00:00Z' },
  { id: 3, source: '인벤', language: 'ko', title: '업데이트', excerpt: '출시 이후', url: 'https://c', imageUrl: null, publishedAt: '2026-11-20T01:00:00Z' }, // 같은 시각이면 id가 큰 것이 먼저
  { id: 4, source: 'IGN', language: 'en', title: 'Old news', excerpt: null, url: 'https://d', imageUrl: null, publishedAt: '2026-11-01T00:00:00Z' },
];
const author = (n) => ({ id: n, displayName: `유저${n}`, avatar: `a0${n}` });
const post = (id, over = {}) => ({ id, category: '자유', title: `글 ${id}`, body: `본문 ${id}`, author: author(1), game: null, createdAt: `2026-11-1${id}T00:00:00.000Z`, commentCount: 0, likeCount: 0, liked: false, mine: false, comments: [], ...over });
const FORUM = [
  post(1, { category: '질문', title: '사양 질문', body: '그래픽카드 추천'.padEnd(300, '가'), likeCount: 1 }),
  post(2, { category: '추천', title: '협동 추천', game: { id: 3, title: 'Gamma Shooter' }, likeCount: 5, commentCount: 2, comments: [{ id: 1, body: 'c', author: author(2), createdAt: 'x', mine: false }] }),
  post(3, { title: '잡담' }),
];
const FILES = { games: GAMES, featured: [3, 999, 1], news: NEWS, forum: FORUM };

function make(files = FILES) {
  const calls = [];
  const api = createStaticApi({
    baseUrl: '/data/',
    fetchImpl: async (url) => {
      calls.push(url);
      const name = url.replace('/data/', '').replace('.json', '');
      return name in files ? { ok: true, status: 200, json: async () => structuredClone(files[name]) } : { ok: false, status: 404, json: async () => ({}) };
    },
  });
  return { api, calls };
}
const titles = (res) => (res.items ?? res).map((g) => g.title);

describe('정적 API: 게임 목록', () => {
  test('조건 하나씩: month, from/to(양 끝 포함), platform, genre, ids, minRating', async () => {
    const { api } = make();
    assert.deepEqual(titles(await api.listGames({ month: '2026-12' })), ['Alpha Quest', 'beta Racer', 'Zeta RPG', 'Gamma Shooter', 'Delta Puzzle']);
    assert.deepEqual(titles(await api.listGames({ from: '2026-12-15', to: '2026-12-31' })), ['Gamma Shooter', 'Delta Puzzle']);
    assert.deepEqual(titles(await api.listGames({ platform: 'PS5' })), ['Alpha Quest']);
    assert.deepEqual(titles(await api.listGames({ genre: 'Action' })), ['Alpha Quest', 'Gamma Shooter']); // genres 안에서도 찾는다
    assert.deepEqual(titles(await api.listGames({ genre: 'Puzzle' })), ['Delta Puzzle']); // genres가 비어 있어도 genre로
    assert.deepEqual(titles(await api.listGames({ ids: [3, 5], sort: 'title' })), ['Epsilon', 'Gamma Shooter']);
    assert.deepEqual(titles(await api.listGames({ minRating: 4, sort: '-rating' })), ['Alpha Quest', 'Zeta RPG', 'Gamma Shooter']); // 평점 없는 게임은 제외
  });

  test('검색(q)은 제목과 설명에서 대소문자 무시, 조건은 AND', async () => {
    const { api } = make();
    assert.deepEqual(titles(await api.listGames({ q: 'BETA' })), ['beta Racer']);
    assert.deepEqual(titles(await api.listGames({ q: 'fantasy' })), ['Alpha Quest']);
    assert.deepEqual(titles(await api.listGames({ month: '2026-12', platform: 'PC', genre: 'RPG' })), ['Alpha Quest', 'Zeta RPG']);
    assert.deepEqual(titles(await api.listGames({ q: 'zzz' })), []);
  });

  test('정렬: 기본은 출시일 오름차순(같은 날은 id순), 인기/평점은 값이 없는 게임을 오름차순에서 앞에 내림차순에서 뒤에', async () => {
    const { api } = make();
    assert.deepEqual((await api.listGames()).items.map((g) => g.id), [1, 2, 6, 3, 4, 5]);
    assert.deepEqual((await api.listGames({ sort: '-releaseDate' })).items.map((g) => g.id), [5, 4, 3, 1, 2, 6]);
    assert.deepEqual((await api.listGames({ sort: '-popularity' })).items.map((g) => g.id), [1, 6, 3, 2, 4, 5]); // 900,900,500,100,null,null
    assert.deepEqual((await api.listGames({ sort: 'rating' })).items.map((g) => g.id), [4, 5, 2, 3, 1, 6]); // null,2.0,3.0,4.0,4.5,4.5
    assert.deepEqual(titles(await api.listGames({ sort: 'title' })), ['Alpha Quest', 'beta Racer', 'Delta Puzzle', 'Epsilon', 'Gamma Shooter', 'Zeta RPG']);
  });

  test('limit/offset 페이지와 전체 개수', async () => {
    const { api } = make();
    const res = await api.listGames({ limit: 2, offset: 2 });
    assert.deepEqual(res.items.map((g) => g.id), [6, 3]);
    assert.equal(res.total, 6);
    assert.equal((await api.listGames({ limit: 2, offset: 100 })).items.length, 0);
  });

  test('getGame과 없는 id는 ApiError(404)', async () => {
    const { api } = make();
    assert.equal((await api.getGame('3')).title, 'Gamma Shooter'); // 문자열 id도 된다
    await assert.rejects(api.getGame(999), (e) => e instanceof ApiError && e.status === 404);
    await assert.rejects(api.similarGames(999), (e) => e.status === 404);
  });
});

describe('정적 API: 달력, 비슷한 게임, 대작, 장르/플랫폼', () => {
  test('달력 요약: 날짜별 개수와 인기 상위 top개', async () => {
    const { api } = make();
    const days = await api.calendar({ month: '2026-12', top: 2 });
    assert.deepEqual(days.map((d) => [d.date, d.count]), [['2026-12-01', 3], ['2026-12-15', 1], ['2026-12-31', 1]]);
    assert.deepEqual(days[0].games.map((g) => g.id), [1, 6]); // 인기 900, 900(id순) 다음 100은 잘림
    assert.deepEqual(Object.keys(days[0].games[0]).sort(), ['coverImageUrl', 'id', 'rating', 'title']);
    assert.deepEqual((await api.calendar({ month: '2026-12', platform: 'Switch' })).map((d) => d.date), ['2026-12-15']);
    assert.deepEqual(await api.calendar({ month: '2030-01' }), []);
  });

  test('비슷한 게임: 장르 겹침×3 + 태그 겹침, 자기 자신과 겹침 없는 게임은 제외', async () => {
    const { api } = make();
    // 1번(RPG, Action / Co-op) 기준: 6번 = RPG(1)×3 + Co-op 1 = 4, 3번 = Action(1)×3 + Co-op 1 = 4 → 평점 4.5 > 4.0 이라 6번이 먼저
    assert.deepEqual((await api.similarGames(1, 6)).map((g) => g.id), [6, 3]);
    assert.deepEqual((await api.similarGames(1, 1)).map((g) => g.id), [6]);
  });

  test('대작 목록: 저장된 순서대로, 없는 id는 건너뛴다', async () => {
    const { api } = make();
    assert.deepEqual((await api.featured()).map((g) => g.id), [3, 1]);
  });

  test('장르/플랫폼 개수: 많은 순, 같으면 이름순. genres가 비면 genre를 쓴다', async () => {
    const { api } = make();
    assert.deepEqual(await api.genres(), [
      { name: 'Action', count: 2 }, { name: 'RPG', count: 2 }, { name: 'Puzzle', count: 1 }, { name: 'Racing', count: 1 },
    ]);
    assert.deepEqual(await api.platforms(), [{ name: 'PC', count: 4 }, { name: 'PS5', count: 1 }, { name: 'Switch', count: 1 }]);
  });
});

describe('정적 API: 뉴스와 포럼', () => {
  test('뉴스: 최신순(같은 시각이면 id가 큰 것 먼저), source/lang/q 필터와 페이지', async () => {
    const { api } = make();
    const all = await api.listNews();
    assert.deepEqual(all.items.map((n) => n.id), [3, 2, 1, 4]);
    assert.equal(all.total, 4);
    assert.deepEqual((await api.listNews({ lang: 'en' })).items.map((n) => n.id), [1, 4]);
    assert.deepEqual((await api.listNews({ source: '인벤', limit: 1, page: 2 })).items.map((n) => n.id), [2]);
    assert.deepEqual((await api.listNews({ q: '출시' })).items.map((n) => n.id), [3, 2]); // 제목 또는 요약
  });

  test('뉴스 매체 목록: 많은 순', async () => {
    const { api } = make();
    assert.deepEqual(await api.newsSources(), [{ name: 'IGN', language: 'en', count: 2 }, { name: '인벤', language: 'ko', count: 2 }]);
  });

  test('포럼 목록: 본문 대신 140자 excerpt, 댓글은 빠진다. 최신순', async () => {
    const { api } = make();
    const res = await api.forumPosts();
    assert.deepEqual(res.items.map((p) => p.id), [3, 2, 1]);
    assert.equal(res.total, 3);
    assert.ok(res.items.every((p) => !('body' in p) && !('comments' in p)));
    assert.equal([...res.items[2].excerpt].length, 140);
  });

  test('포럼 필터와 인기순(좋아요×2+댓글), 상세와 404', async () => {
    const { api } = make();
    assert.deepEqual((await api.forumPosts({ category: '질문' })).items.map((p) => p.id), [1]);
    assert.deepEqual((await api.forumPosts({ gameId: 3 })).items.map((p) => p.id), [2]);
    assert.deepEqual((await api.forumPosts({ q: '그래픽' })).items.map((p) => p.id), [1]);
    assert.deepEqual((await api.forumPosts({ sort: 'popular' })).items.map((p) => p.id), [2, 1, 3]); // 12, 2, 0
    assert.deepEqual((await api.forumPosts({ limit: 1, page: 2 })).items.map((p) => p.id), [2]);
    const detail = await api.forumPost(2);
    assert.equal(detail.body, '본문 2');
    assert.equal(detail.comments.length, 1);
    await assert.rejects(api.forumPost(99), (e) => e.status === 404);
  });
});

describe('정적 API: 읽기 전용과 안정성', () => {
  test('로그인, 글쓰기, 좋아요 같은 쓰기 기능은 모두 501로 거절한다', async () => {
    const { api } = make();
    assert.equal(api.readOnly, true);
    for (const name of ['signup', 'login', 'logout', 'me', 'updateMe', 'myFavoriteIds', 'myFavorites', 'addFavorite', 'removeFavorite', 'mergeFavorites',
      'createForumPost', 'deleteForumPost', 'addForumComment', 'deleteForumComment', 'likeForumPost', 'unlikeForumPost', 'createGame', 'replaceGame', 'patchGame', 'deleteGame']) {
      await assert.rejects(api[name]({}), (e) => e instanceof ApiError && e.status === 501 && /데모/.test(e.message), name);
    }
  });

  test('파일은 한 번만 불러온다 (캐시)', async () => {
    const { api, calls } = make();
    await Promise.all([api.listGames(), api.genres(), api.calendar({ month: '2026-12' }), api.getGame(1)]);
    assert.deepEqual(calls, ['/data/games.json']);
  });

  test('불러오기에 실패하면 ApiError이고, 다음에 다시 시도한다', async () => {
    let fail = true;
    const api = createStaticApi({ baseUrl: '/data/', fetchImpl: async () => { if (fail) throw new TypeError('network'); return { ok: true, status: 200, json: async () => GAMES }; } });
    await assert.rejects(api.listGames(), (e) => e instanceof ApiError && e.status === 0);
    fail = false;
    assert.equal((await api.listGames()).total, 6);
    const missing = createStaticApi({ baseUrl: '/data/', fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({}) }) });
    await assert.rejects(missing.listNews(), (e) => e.status === 404);
  });

  test('.ics 주소: 게임을 불러오기 전에는 null, 후에는 연말 경계를 넘는 종일 일정', async () => {
    const { api } = make();
    assert.equal(api.icsUrl(4), null);
    await api.listGames();
    const url = api.icsUrl(4); // 2026-12-31
    assert.ok(url.startsWith('data:text/calendar;charset=utf-8,'));
    const text = decodeURIComponent(url.split(',')[1]);
    assert.ok(text.startsWith('BEGIN:VCALENDAR\r\n'));
    assert.ok(text.includes('DTSTART;VALUE=DATE:20261231'));
    assert.ok(text.includes('DTEND;VALUE=DATE:20270101'));
    assert.ok(text.includes('SUMMARY:Delta Puzzle 출시'));
    assert.equal(api.icsUrl(999), null);
  });
});

describe('커밋된 스냅샷(public/data) 점검', () => {
  const read = (name) => JSON.parse(readFileSync(new URL(`../public/data/${name}.json`, import.meta.url), 'utf8'));

  test('파일이 모두 있고 meta의 개수와 맞는다', () => {
    const [games, news, forum, meta, featured] = ['games', 'news', 'forum', 'meta', 'featured'].map(read);
    assert.equal(meta.games, games.length);
    assert.equal(meta.news, news.length);
    assert.equal(meta.forumPosts, forum.length);
    assert.ok(games.length > 100 && news.length > 10 && forum.length > 5);
    const ids = new Set(games.map((g) => g.id));
    assert.ok(featured.length > 0 && featured.every((id) => ids.has(id)), '대작 id가 모두 게임 목록에 있어야 한다');
    assert.equal(ids.size, games.length, '게임 id가 겹치면 안 된다');
  });

  test('개인정보가 없다: 이메일, 비밀번호, 토큰 필드와 실제 사용자 흔적', () => {
    for (const name of ['games', 'news', 'forum', 'meta', 'featured']) {
      const text = readFileSync(new URL(`../public/data/${name}.json`, import.meta.url), 'utf8');
      for (const key of ['"email"', '"passwordHash"', '"password_hash"', '"token"', '"tokenHash"', 'demo.invalid']) assert.ok(!text.includes(key), `${name}.json에 ${key}`);
    }
    for (const p of read('forum')) {
      assert.deepEqual(Object.keys(p.author).sort(), ['avatar', 'displayName', 'id']);
      assert.ok(p.comments.every((c) => Object.keys(c.author).sort().join() === 'avatar,displayName,id'));
    }
  });

  test('스냅샷만으로 정적 API가 정상 동작한다 (달력, 대작, 포럼)', async () => {
    const files = Object.fromEntries(['games', 'news', 'forum', 'featured'].map((n) => [n, read(n)]));
    const { api } = make(files);
    assert.ok((await api.featured()).length > 0);
    assert.ok((await api.listGames({ limit: 5 })).items.length === 5);
    assert.ok((await api.forumPosts()).total > 0);
    assert.ok((await api.genres()).length > 3);
  });
});
