// 성인 콘텐츠 필터, 대작 고정(featured), 뉴스 수집/API 테스트. 실제 RSS 서버는 부르지 않고 가짜 응답을 쓴다.
import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup, sample } from './helpers.js';

let ctx;
let News;
let newsService;
let filter;
const api = (...args) => ctx.api(...args);

before(async () => {
  ctx = await setup();
  News = await import('../src/models/News.js');
  newsService = await import('../src/services/newsService.js');
  filter = await import('../src/services/contentFilter.js');
});
after(async () => {
  await ctx.teardown();
});
beforeEach(async () => {
  await ctx.pool.query('TRUNCATE TABLE games');
  await ctx.pool.query('TRUNCATE TABLE news');
});

describe('성인 콘텐츠 필터', () => {
  test('성인물이 아닌 것: GTA 같은 Mature 대작, 단어 일부만 겹치는 제목', () => {
    const gta = { title: 'Grand Theft Auto VI', esrbRating: 'Mature', tags: ['Open World', 'Nudity', 'Violent'], description: '범죄 액션' };
    assert.equal(filter.isAdultGame(gta), false);
    for (const title of ['Sussex Stories', 'Essex Racing', 'Sextant Navigator', 'Adulthood Simulator Free', 'Lustrous Gems']) {
      assert.equal(filter.isAdultGame({ title }), false, title);
    }
    assert.equal(filter.isAdultGame({ title: 'GreedFall', tags: ['Nudity', 'RPG'] }), false);
    assert.equal(filter.isAdultGame({ title: 'x', tags: ['Mature'] }), false);
  });

  test('성인물: 제목, 태그, 등급, 설명', () => {
    assert.equal(filter.adultReason({ title: 'WILD SEX' }), '제목');
    assert.equal(filter.isAdultGame({ title: 'Sexy Girls Quest' }), true);
    assert.equal(filter.isAdultGame({ title: 'Hentai Puzzle' }), true);
    assert.equal(filter.isAdultGame({ title: '성인 퍼즐' }), true);
    assert.equal(filter.adultReason({ title: 'x', esrbRating: 'Adults Only' }), 'ESRB Adults Only');
    assert.equal(filter.isAdultGame({ title: 'x', tags: ['Sexual Content'] }), true);
    assert.equal(filter.isAdultGame({ title: 'x', tags: ['NSFW'] }), true);
    assert.equal(filter.isAdultGame({ title: 'x', tags: ['Сексуальный контент'] }), true);
    assert.equal(filter.isAdultGame({ title: 'x', description: 'A hentai visual novel' }), true);
  });

  test('값이 없어도 에러 없이 false', () => {
    assert.equal(filter.isAdultGame({}), false);
    assert.equal(filter.isAdultGame(null), false);
    assert.equal(filter.isAdultText(undefined), false);
  });
});

describe('대작 고정 (featured)', () => {
  test('featuredOrder가 있는 게임만 순서대로 돌려준다', async () => {
    assert.deepEqual((await api('GET', '/api/featured')).body, []);
    const a = await api('POST', '/api/games', sample({ title: 'A' }));
    const b = await api('POST', '/api/games', sample({ title: 'B' }));
    await api('POST', '/api/games', sample({ title: 'C' }));
    await api('PATCH', `/api/games/${a.body.id}`, { featuredOrder: 2 });
    await api('PATCH', `/api/games/${b.body.id}`, { featuredOrder: 1, trailerUrl: 'https://www.youtube.com/watch?v=abcdefghijk' });

    const res = await api('GET', '/api/featured');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.map((g) => g.title), ['B', 'A']);
    assert.equal(res.body[0].trailerUrl, 'https://www.youtube.com/watch?v=abcdefghijk');

    await api('PATCH', `/api/games/${b.body.id}`, { featuredOrder: null });
    assert.deepEqual((await api('GET', '/api/featured')).body.map((g) => g.title), ['A']);
  });

  test('featuredOrder가 음수이거나 정수가 아니면 400', async () => {
    assert.equal((await api('POST', '/api/games', sample({ featuredOrder: -1 }))).status, 400);
    assert.equal((await api('POST', '/api/games', sample({ featuredOrder: 1.5 }))).status, 400);
  });
});

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel><title>Fixture</title>
<item><title><![CDATA[First &amp; <b>Best</b> Game News]]></title><link>https://example.com/a</link>
  <description><![CDATA[<p>Hello &amp; welcome <img src="https://example.com/inline.jpg"> to the news.</p>]]></description>
  <pubDate>Fri, 20 Nov 2026 03:00:00 GMT</pubDate><media:thumbnail url="https://example.com/thumb.jpg"/></item>
<item><title>Enclosure item</title><link>https://example.com/b</link><description>Short</description>
  <pubDate>Thu, 19 Nov 2026 10:00:00 +0900</pubDate><enclosure url="https://example.com/enc.jpg" type="image/jpeg" length="1"/></item>
<item><title>Inline image only</title><link>https://example.com/c</link>
  <content:encoded><![CDATA[<img src="https://example.com/c.png"/> body text]]></content:encoded></item>
<item><title>WILD SEX hentai pack</title><link>https://example.com/adult</link><description>x</description></item>
<item><title>No link here</title><description>x</description></item>
<item><title>Bad link</title><link>javascript:alert(1)</link></item>
<item><title>Audio enclosure</title><link>https://example.com/d</link><enclosure url="https://example.com/a.mp3" type="audio/mpeg"/></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title>A</title>
<entry><title type="html">Atom entry</title><link rel="alternate" href="https://example.com/atom1"/>
<published>2026-11-18T12:00:00Z</published><summary>Atom summary</summary></entry></feed>`;

const meta = { source: 'Fixture', language: 'en' };

describe('뉴스 RSS 파싱', () => {
  test('RSS: 제목/요약 정리, 이미지 우선순위, 날짜는 UTC, 성인/링크 없는 항목은 제외', () => {
    const items = newsService.parseFeed(RSS, meta);
    assert.deepEqual(items.map((i) => i.url), ['https://example.com/a', 'https://example.com/b', 'https://example.com/c', 'https://example.com/d']);

    const [a, b, c, d] = items;
    assert.equal(a.title, 'First & Best Game News'); // 태그 제거, 엔티티 해석
    assert.equal(a.excerpt, 'Hello & welcome to the news.');
    assert.equal(a.imageUrl, 'https://example.com/thumb.jpg'); // media:thumbnail이 본문 이미지보다 우선
    assert.equal(a.publishedAt, '2026-11-20 03:00:00');
    assert.equal(a.source, 'Fixture');

    assert.equal(b.imageUrl, 'https://example.com/enc.jpg');
    assert.equal(b.publishedAt, '2026-11-19 01:00:00'); // +0900 → UTC

    assert.equal(c.imageUrl, 'https://example.com/c.png'); // 본문 속 이미지
    assert.equal(c.excerpt, 'body text');
    assert.match(c.publishedAt, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/); // 날짜가 없으면 지금 시각

    assert.equal(d.imageUrl, null); // 오디오 첨부는 이미지가 아님
    assert.equal(d.excerpt, null);
  });

  test('Atom도 읽는다', () => {
    const [entry] = newsService.parseFeed(ATOM, meta);
    assert.equal(entry.title, 'Atom entry');
    assert.equal(entry.url, 'https://example.com/atom1');
    assert.equal(entry.excerpt, 'Atom summary');
    assert.equal(entry.publishedAt, '2026-11-18 12:00:00');
  });

  test('항목이 하나뿐이어도, 비어 있어도 에러 없이 처리한다', () => {
    const one = '<rss><channel><item><title>Solo</title><link>https://example.com/solo</link></item></channel></rss>';
    assert.equal(newsService.parseFeed(one, meta).length, 1);
    assert.deepEqual(newsService.parseFeed('<rss><channel></channel></rss>', meta), []);
    assert.deepEqual(newsService.parseFeed('<html>not a feed</html>', meta), []);
  });

  test('긴 요약은 잘라서 …을 붙인다', () => {
    const long = `<rss><channel><item><title>T</title><link>https://example.com/l</link><description>${'가'.repeat(400)}</description></item></channel></rss>`;
    const [item] = newsService.parseFeed(long, meta);
    assert.equal([...item.excerpt].length, 180);
    assert.ok(item.excerpt.endsWith('…'));
  });
});

describe('refreshNews', () => {
  const okResponse = (body) => ({ ok: true, status: 200, text: async () => body });
  const feeds = [
    { source: 'Good', language: 'en', url: 'https://good.example/rss' },
    { source: 'Down', language: 'en', url: 'https://down.example/rss' },
    { source: 'Offline', language: 'ko', url: 'https://offline.example/rss' },
  ];
  const fetchImpl = async (url) => {
    if (url.startsWith('https://good')) return okResponse(RSS);
    if (url.startsWith('https://down')) return { ok: false, status: 500, text: async () => '' };
    throw new TypeError('network down');
  };

  test('한 곳이 실패해도 나머지는 저장하고, 결과에 성공/실패를 알려 준다', async () => {
    const results = await newsService.refreshNews({ feeds, fetchImpl });
    assert.deepEqual(results.map((r) => [r.source, r.ok, r.count]), [['Good', true, 4], ['Down', false, 0], ['Offline', false, 0]]);
    assert.match(results[1].error, /500/);
    const [[{ n }]] = await ctx.pool.query('SELECT COUNT(*) AS n FROM news');
    assert.equal(n, 4);
  });

  test('다시 가져와도 같은 주소는 중복 저장하지 않는다', async () => {
    await newsService.refreshNews({ feeds, fetchImpl });
    await newsService.refreshNews({ feeds, fetchImpl });
    const [[{ n }]] = await ctx.pool.query('SELECT COUNT(*) AS n FROM news');
    assert.equal(n, 4);
  });

  test('prune은 최신 N개만 남긴다', async () => {
    const items = [1, 2, 3, 4, 5].map((i) => ({
      source: 'S', language: 'en', title: `n${i}`, url: `https://example.com/${i}`, excerpt: null, imageUrl: null, publishedAt: `2026-11-1${i} 00:00:00`,
    }));
    await News.upsertMany(items);
    assert.equal(await News.prune(2), 3);
    const { items: left } = await News.findAll({});
    assert.deepEqual(left.map((n) => n.title), ['n5', 'n4']);
  });

  test('테스트 환경에서는 자동 갱신이 꺼져 있다', async () => {
    await newsService.ensureFreshNews();
    const [[{ n }]] = await ctx.pool.query('SELECT COUNT(*) AS n FROM news');
    assert.equal(n, 0);
  });
});

describe('GET /api/news', () => {
  beforeEach(async () => {
    const make = (source, language, title, day) => ({
      source, language, title, url: `https://example.com/${encodeURIComponent(title)}`, excerpt: `${title} 요약`, imageUrl: null, publishedAt: `2026-11-${day} 03:00:00`,
    });
    await News.upsertMany([
      make('게임메카', 'ko', '신작 소식', 20),
      make('인벤', 'ko', '업데이트 안내', 19),
      make('IGN', 'en', 'GTA VI trailer', 18),
      make('IGN', 'en', 'Review roundup', 17),
    ]);
  });

  test('최신순, X-Total-Count, 필드 모양', async () => {
    const res = await api('GET', '/api/news');
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-total-count'), '4');
    assert.deepEqual(res.body.map((n) => n.title), ['신작 소식', '업데이트 안내', 'GTA VI trailer', 'Review roundup']);
    assert.deepEqual(Object.keys(res.body[0]).sort(), ['excerpt', 'id', 'imageUrl', 'language', 'publishedAt', 'source', 'title', 'url']);
    assert.equal(res.body[0].publishedAt, '2026-11-20T03:00:00Z');
    assert.equal(res.body[0].imageUrl, null);
  });

  test('limit/page, source, lang, q 필터', async () => {
    assert.deepEqual((await api('GET', '/api/news?limit=2&page=2')).body.map((n) => n.title), ['GTA VI trailer', 'Review roundup']);
    assert.equal((await api('GET', '/api/news?source=IGN')).body.length, 2);
    assert.equal((await api('GET', '/api/news?lang=ko')).body.length, 2);
    const search = await api('GET', `/api/news?q=${encodeURIComponent('GTA')}`);
    assert.deepEqual(search.body.map((n) => n.title), ['GTA VI trailer']);
    assert.equal(search.headers.get('x-total-count'), '1');
    assert.deepEqual((await api('GET', '/api/news?source=IGN&lang=ko')).body, []);
  });

  test('잘못된 쿼리는 400', async () => {
    for (const query of ['limit=0', 'limit=101', 'page=0', 'lang=fr']) {
      assert.equal((await api('GET', `/api/news?${query}`)).status, 400, query);
    }
  });

  test('GET /api/news/sources: 매체별 기사 수', async () => {
    const res = await api('GET', '/api/news/sources');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body[0], { name: 'IGN', language: 'en', count: 2 });
    assert.equal(res.body.length, 3);
  });
});
