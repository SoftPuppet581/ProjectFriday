// 정적 데모용 API (화면 코드 없음). 서버와 DB 없이 public/data/*.json 스냅샷으로 api/client.js의 `api`와 같은 모양으로 응답한다.
// 필터, 정렬, 달력 요약, 비슷한 게임 같은 동작은 백엔드와 같은 규칙으로 다시 구현했다 (frontend/test/staticApi.test.js 와 라이브 서버 비교로 확인).
// 읽기 전용이다: 로그인, 글쓰기, 게임 수정은 ApiError(501)로 거절한다.
import { ApiError } from './errors.js';

const READ_ONLY_MESSAGE = '데모 버전에서는 쓸 수 없는 기능이에요. 로컬 서버(start.bat)에서는 사용할 수 있어요.';
const rejectReadOnly = () => Promise.reject(new ApiError(501, READ_ONLY_MESSAGE));

// DB(utf8mb4_unicode_ci)처럼 대소문자를 무시하고 글자 코드 순서로 비교한다. (영문이 한글보다 먼저 온다. JS의 한국어 정렬 규칙과 다르다)
const compareText = (a, b) => {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x < y ? -1 : x > y ? 1 : 0;
};

const byNullsFirst = (a, b) => (a === b ? 0 : a === null || a === undefined ? -1 : b === null || b === undefined ? 1 : a < b ? -1 : 1);

// 백엔드(models/Game.js buildWhere)와 같은 조건
function matchesGame(game, { month, from, to, platform, genre, q, ids, minRating } = {}) {
  if (month && game.releaseDate.slice(0, 7) !== month) return false;
  if (from && game.releaseDate < from) return false;
  if (to && game.releaseDate > to) return false;
  if (platform && !game.platforms.includes(platform)) return false;
  if (genre && game.genre !== genre && !game.genres.includes(genre)) return false;
  if (q) {
    const needle = q.toLowerCase();
    if (!game.title.toLowerCase().includes(needle) && !(game.description ?? '').toLowerCase().includes(needle)) return false;
  }
  if (ids?.length && !ids.includes(game.id)) return false;
  if (minRating !== undefined && !(game.rating !== null && game.rating >= minRating)) return false;
  return true;
}

const SORT_FIELDS = { releaseDate: 'releaseDate', title: 'title', rating: 'rating', popularity: 'popularity', metacritic: 'metacritic', createdAt: 'releaseDate' };

function sortGames(games, sort = 'releaseDate') {
  const desc = sort.startsWith('-');
  const field = SORT_FIELDS[desc ? sort.slice(1) : sort] ?? 'releaseDate';
  const direction = desc ? -1 : 1;
  return [...games].sort((a, b) => {
    const primary = field === 'title' ? compareText(a.title, b.title) : byNullsFirst(a[field], b[field]);
    return primary * direction || a.id - b.id;
  });
}

const page = (items, { limit = 50, offset = 0 } = {}) => items.slice(offset, offset + limit);

function similar(games, target, limit = 6) {
  const targetGenres = new Set(target.genres);
  const targetTags = new Set(target.tags);
  const overlap = (list, set) => list.filter((entry) => set.has(entry)).length;
  const candidates = games.filter((game) => game.id !== target.id).sort((a, b) => byNullsFirst(b.rating, a.rating) || a.id - b.id).slice(0, 500);
  return candidates
    .map((game) => ({ game, score: overlap(game.genres, targetGenres) * 3 + overlap(game.tags, targetTags) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || (b.game.rating ?? 0) - (a.game.rating ?? 0))
    .slice(0, limit)
    .map((entry) => entry.game);
}

function calendar(games, { top = 3, ...filters }) {
  const ordered = games
    .filter((game) => matchesGame(game, filters))
    .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate) || (b.popularity ?? -1) - (a.popularity ?? -1) || (b.rating ?? -1) - (a.rating ?? -1) || a.id - b.id);
  const days = new Map();
  for (const game of ordered) {
    if (!days.has(game.releaseDate)) days.set(game.releaseDate, { date: game.releaseDate, count: 0, games: [] });
    const day = days.get(game.releaseDate);
    day.count += 1;
    if (day.games.length < top) day.games.push({ id: game.id, title: game.title, coverImageUrl: game.coverImageUrl, rating: game.rating });
  }
  return [...days.values()];
}

function countNames(games, namesOf) {
  const counts = new Map();
  for (const game of games) for (const name of new Set(namesOf(game))) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || compareText(a.name, b.name));
}

// 오늘 날짜가 아니라 스냅샷에 저장된 출시일 기준으로 .ics를 만든다 (백엔드 utils/ics.js와 같은 내용)
function buildIcs(game, now = new Date()) {
  const escape = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const compact = (iso) => iso.replaceAll('-', '');
  const next = new Date(`${game.releaseDate}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//GameCalendar//KO', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:game-${game.id}@gamecalendar.local`, `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compact(game.releaseDate)}`, `DTEND;VALUE=DATE:${compact(next.toISOString().slice(0, 10))}`,
    `SUMMARY:${escape(`${game.title} 출시`)}`,
    `DESCRIPTION:${escape([game.platforms?.length ? `플랫폼: ${game.platforms.join(', ')}` : null, '출시일은 변경될 수 있습니다.'].filter(Boolean).join('\n'))}`,
  ];
  if (game.sourceUrl || game.officialUrl) lines.push(`URL:${game.officialUrl ?? game.sourceUrl}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

export function createStaticApi({ baseUrl = '/data/', fetchImpl = (...args) => fetch(...args) } = {}) {
  const cache = new Map();
  let gamesById = null;

  function load(name) {
    if (!cache.has(name)) {
      const promise = Promise.resolve()
        .then(() => fetchImpl(`${baseUrl}${name}.json`))
        .then((response) => {
          if (!response.ok) throw new ApiError(response.status, '데이터를 불러오지 못했습니다.');
          return response.json();
        })
        .catch((error) => {
          cache.delete(name); // 다음에 다시 시도할 수 있게
          throw error instanceof ApiError ? error : new ApiError(0, '데이터를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.');
        });
      cache.set(name, promise);
    }
    return cache.get(name);
  }

  const games = async () => {
    const data = await load('games');
    gamesById ??= new Map(data.map((game) => [game.id, game]));
    return data;
  };
  const notFound = (what, id) => new ApiError(404, `id ${id} ${what}을(를) 찾을 수 없습니다.`);

  return {
    readOnly: true,
    health: async () => ({ status: 'ok' }),

    async listGames(params = {}) {
      const all = (await games()).filter((game) => matchesGame(game, params));
      return { items: page(sortGames(all, params.sort), params), total: all.length };
    },
    async getGame(id) {
      await games();
      const game = gamesById.get(Number(id));
      if (!game) throw notFound('게임', id);
      return game;
    },
    async similarGames(id, limit) {
      const all = await games();
      const target = gamesById.get(Number(id));
      if (!target) throw notFound('게임', id);
      return similar(all, target, limit);
    },
    calendar: async (params = {}) => calendar(await games(), params),
    async featured() {
      const [ids] = await Promise.all([load('featured'), games()]);
      return ids.map((id) => gamesById.get(id)).filter(Boolean);
    },
    genres: async () => countNames(await games(), (game) => (game.genres.length ? game.genres : game.genre ? [game.genre] : [])),
    platforms: async () => countNames(await games(), (game) => game.platforms),

    async listNews({ limit = 20, page: pageNumber = 1, source, lang, q } = {}) {
      const needle = q?.toLowerCase();
      const all = (await load('news'))
        .filter((article) => (!source || article.source === source) && (!lang || article.language === lang)
          && (!needle || article.title.toLowerCase().includes(needle) || (article.excerpt ?? '').toLowerCase().includes(needle)))
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.id - a.id);
      return { items: page(all, { limit, offset: (pageNumber - 1) * limit }), total: all.length };
    },
    async newsSources() {
      const counts = new Map();
      for (const article of await load('news')) {
        const key = `${article.source}|${article.language}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return [...counts].map(([key, count]) => ({ name: key.split('|')[0], language: key.split('|')[1], count })).sort((a, b) => b.count - a.count || compareText(a.name, b.name));
    },

    async forumPosts({ category, q, gameId, sort = 'recent', limit = 20, page: pageNumber = 1 } = {}) {
      const needle = q?.toLowerCase();
      const all = (await load('forum')).filter(
        (post) => (!category || post.category === category) && (!gameId || post.game?.id === gameId)
          && (!needle || post.title.toLowerCase().includes(needle) || post.body.toLowerCase().includes(needle)),
      );
      const ordered = sort === 'popular'
        ? [...all].sort((a, b) => (b.likeCount * 2 + b.commentCount) - (a.likeCount * 2 + a.commentCount) || b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
        : [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
      const items = page(ordered, { limit, offset: (pageNumber - 1) * limit }).map(({ body, comments, ...rest }) => ({ ...rest, excerpt: [...body].slice(0, 140).join('') }));
      return { items, total: all.length };
    },
    async forumPost(id) {
      const post = (await load('forum')).find((entry) => entry.id === Number(id));
      if (!post) throw notFound('글', id);
      return post;
    },

    // 데모에서는 .ics를 파일 주소 대신 data: 주소로 만든다 (게임 데이터를 불러온 뒤에만 동작하고, 아니면 null)
    icsUrl(id) {
      const game = gamesById?.get(Number(id));
      return game ? `data:text/calendar;charset=utf-8,${encodeURIComponent(buildIcs(game))}` : null;
    },

    // ---- 읽기 전용이라 거절하는 기능 ----
    createGame: rejectReadOnly,
    replaceGame: rejectReadOnly,
    patchGame: rejectReadOnly,
    deleteGame: rejectReadOnly,
    signup: rejectReadOnly,
    login: rejectReadOnly,
    logout: rejectReadOnly,
    me: rejectReadOnly,
    updateMe: rejectReadOnly,
    myFavoriteIds: rejectReadOnly,
    myFavorites: rejectReadOnly,
    addFavorite: rejectReadOnly,
    removeFavorite: rejectReadOnly,
    mergeFavorites: rejectReadOnly,
    createForumPost: rejectReadOnly,
    deleteForumPost: rejectReadOnly,
    addForumComment: rejectReadOnly,
    deleteForumComment: rejectReadOnly,
    likeForumPost: rejectReadOnly,
    unlikeForumPost: rejectReadOnly,
  };
}
