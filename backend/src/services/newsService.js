import { XMLParser } from 'fast-xml-parser';
import { isAdultText } from './contentFilter.js';
import * as News from '../models/News.js';

// 가져올 RSS 목록. 한국 매체 3곳과 해외 3곳. (모두 공개 RSS이고, 제목/링크/짧은 요약/썸네일만 쓴다)
export const FEEDS = [
  { source: '게임메카', language: 'ko', url: 'https://www.gamemeca.com/rss.php' },
  { source: '인벤', language: 'ko', url: 'https://www.inven.co.kr/webzine/news/rss.php' },
  { source: '루리웹', language: 'ko', url: 'https://bbs.ruliweb.com/news/rss' },
  { source: 'IGN', language: 'en', url: 'https://feeds.feedburner.com/ign/games-all' },
  { source: 'GameSpot', language: 'en', url: 'https://www.gamespot.com/feeds/news/' },
  { source: 'PC Gamer', language: 'en', url: 'https://www.pcgamer.com/rss/' },
];

const EXCERPT_LENGTH = 180;
const STALE_AFTER_MS = 30 * 60 * 1000;

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text', processEntities: true, trimValues: true });

const asArray = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);

// fast-xml-parser는 속성이 있는 태그를 객체로 돌려주므로 글자만 꺼낸다
function text(node) {
  if (node === undefined || node === null) return '';
  if (typeof node === 'object') return text(node['#text'] ?? '');
  return String(node);
}

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ' };

export function cleanText(html) {
  return text(html)
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/g, (m) => ENTITIES[m])
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncate(value, max) {
  const chars = [...value];
  return chars.length <= max ? value : `${chars.slice(0, max - 1).join('').trimEnd()}…`;
}

const isHttp = (v) => typeof v === 'string' && /^https?:\/\//i.test(v) && v.length <= 500;

function findImage(item) {
  for (const node of [...asArray(item['media:content']), ...asArray(item['media:thumbnail'])]) {
    const url = node?.['@_url'];
    const type = node?.['@_type'] ?? '';
    if (isHttp(url) && (!type || type.startsWith('image'))) return url;
  }
  for (const node of asArray(item.enclosure)) {
    if (isHttp(node?.['@_url']) && String(node['@_type'] ?? '').startsWith('image')) return node['@_url'];
  }
  const html = `${text(item['content:encoded'])} ${text(item.description)}`;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match && isHttp(match[1]) ? match[1] : null;
}

function findLink(item) {
  if (typeof item.link === 'string') return item.link.trim();
  // Atom: <link href="..."/>
  const link = asArray(item.link).find((l) => l?.['@_rel'] !== 'self') ?? asArray(item.link)[0];
  return link?.['@_href'] ?? text(link).trim();
}

function toUtcDateTime(value) {
  const date = new Date(text(value));
  return (Number.isNaN(date.getTime()) ? new Date() : date).toISOString().slice(0, 19).replace('T', ' ');
}

// RSS(2.0)와 Atom을 모두 읽는다. 성인 기사는 버린다.
export function parseFeed(xml, { source, language }) {
  const doc = parser.parse(xml);
  const items = asArray(doc?.rss?.channel?.item ?? doc?.feed?.entry);

  const result = [];
  for (const item of items) {
    const title = truncate(cleanText(item.title), 300);
    const url = findLink(item);
    if (!title || !isHttp(url)) continue;

    const excerpt = truncate(cleanText(item.description ?? item.summary ?? item['content:encoded'] ?? ''), EXCERPT_LENGTH);
    if (isAdultText(`${title} ${excerpt}`)) continue;

    result.push({
      source,
      language,
      title,
      url,
      excerpt: excerpt || null,
      imageUrl: findImage(item),
      publishedAt: toUtcDateTime(item.pubDate ?? item['dc:date'] ?? item.published ?? item.updated),
    });
  }
  return result;
}

// 모든 RSS를 가져와 저장한다. 한 곳이 실패해도 나머지는 계속한다.
export async function refreshNews({ feeds = FEEDS, fetchImpl = fetch, keep = 500, timeoutMs = 10000 } = {}) {
  const results = await Promise.all(
    feeds.map(async (feed) => {
      try {
        const response = await fetchImpl(feed.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GameCalendarStudentProject)', Accept: 'application/rss+xml, application/xml, text/xml' },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const items = parseFeed(await response.text(), feed);
        await News.upsertMany(items);
        return { source: feed.source, ok: true, count: items.length };
      } catch (error) {
        return { source: feed.source, ok: false, count: 0, error: error.message };
      }
    }),
  );
  await News.prune(keep);
  return results;
}

// 요청이 올 때, 마지막 수집이 30분보다 오래됐으면 뒤에서 조용히 새로 가져온다 (응답을 기다리게 하지 않는다)
let refreshing = false;
export async function ensureFreshNews() {
  if (refreshing || process.env.NEWS_AUTO_REFRESH === 'false') return;
  const last = await News.lastFetchedAt();
  if (last !== null && Date.now() - last < STALE_AFTER_MS) return;
  refreshing = true;
  refreshNews()
    .catch((error) => console.error('뉴스 갱신 실패:', error.message))
    .finally(() => {
      refreshing = false;
    });
}
