import pool from '../config/db.js';

// API 필드 이름 -> DB 컬럼 이름
const FIELDS = {
  title: 'title',
  releaseDate: 'release_date',
  platforms: 'platforms',
  genre: 'genre',
  genres: 'genres',
  description: 'description',
  trailerUrl: 'trailer_url',
  coverImageUrl: 'cover_image_url',
  officialUrl: 'official_url',
  tags: 'tags',
  developers: 'developers',
  publishers: 'publishers',
  screenshots: 'screenshots',
  rating: 'rating',
  ratingsCount: 'ratings_count',
  metacritic: 'metacritic',
  esrbRating: 'esrb_rating',
  playtime: 'playtime',
  popularity: 'popularity',
  externalId: 'external_id',
  slug: 'slug',
  sourceUrl: 'source_url',
  source: 'source',
  featuredOrder: 'featured_order',
};

// DB에 JSON 문자열로 저장하는 배열 필드
const ARRAY_FIELDS = new Set(['platforms', 'genres', 'tags', 'developers', 'publishers', 'screenshots']);

const SELECT_COLUMNS = [
  'id',
  ...Object.entries(FIELDS).map(([field, column]) => (field === column ? column : `${column} AS ${field}`)),
  'created_at AS createdAt',
  'updated_at AS updatedAt',
  // 아래는 가져오기/가격 갱신 스크립트만 쓰는 읽기 전용 컬럼이다 (API로 쓰는 필드가 아니라서 FIELDS에 없다. PUT으로 덮어써도 지워지지 않는다)
  'stores',
  'steam_app_id AS steamAppId',
  'price_final AS priceFinal',
  'price_initial AS priceInitial',
  'price_discount_percent AS priceDiscountPercent',
  'price_currency AS priceCurrency',
  'price_formatted AS priceFormatted',
  "DATE_FORMAT(price_updated_at, '%Y-%m-%dT%H:%i:%sZ') AS priceUpdatedAt",
].join(', ');

const SORT_COLUMNS = {
  releaseDate: 'release_date',
  title: 'title',
  createdAt: 'created_at',
  rating: 'rating',
  popularity: 'popularity',
  metacritic: 'metacritic',
};

function toGame(row) {
  if (!row) return null;
  const game = { ...row };
  for (const field of ARRAY_FIELDS) {
    game[field] = row[field] ? JSON.parse(row[field]) : [];
  }
  // 직접 입력한 게임은 genre만 있을 수 있으므로 genres도 채워 준다
  if (game.genres.length === 0 && game.genre) game.genres = [game.genre];
  // RAWG는 영상 데이터를 거의 주지 않아서, 저장된 trailerUrl이 없을 때 쓸 YouTube 검색 링크를 계산해 준다 (DB에는 저장하지 않음)
  game.trailerSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${game.title} official trailer`)}`;

  // 스토어 링크와 가격. 가격은 Steam(원화) 기준이고 Steam에서 팔지 않거나 가격이 없으면 price는 null
  game.stores = row.stores ? JSON.parse(row.stores) : [];
  game.price =
    row.priceFinal === null || row.priceFinal === undefined
      ? null
      : {
          currency: row.priceCurrency,
          final: row.priceFinal,
          initial: row.priceInitial ?? row.priceFinal,
          discountPercent: row.priceDiscountPercent ?? 0,
          formatted: row.priceFormatted,
          onSale: (row.priceDiscountPercent ?? 0) > 0,
          updatedAt: row.priceUpdatedAt,
        };
  for (const flat of ['priceFinal', 'priceInitial', 'priceDiscountPercent', 'priceCurrency', 'priceFormatted', 'priceUpdatedAt']) delete game[flat];

  // 바로 가기 링크 (저장값이 아니라 계산값)
  game.steamStoreUrl = game.steamAppId ? `https://store.steampowered.com/app/${game.steamAppId}/` : null;
  game.steamClientUrl = game.steamAppId ? `steam://store/${game.steamAppId}` : null; // Steam 앱이 설치되어 있으면 앱에서 열린다
  game.steamSearchUrl = `https://store.steampowered.com/search/?term=${encodeURIComponent(game.title)}`;
  game.newsSearchUrl = `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(`${game.title} 게임`)}`;
  return game;
}

// full=true: 모든 필드를 쓴다 (없는 값은 NULL, platforms는 []). false: 보낸 필드만 쓴다
function toDbValues(data, full) {
  const values = {};
  for (const [field, column] of Object.entries(FIELDS)) {
    const present = data[field] !== undefined;
    if (!full && !present) continue;
    let value = present ? data[field] : null;
    if (ARRAY_FIELDS.has(field)) {
      value = value === null ? (field === 'platforms' ? '[]' : null) : JSON.stringify(value);
    }
    values[column] = value;
  }
  return values;
}

function buildWhere({ month, from, to, platform, genre, q, ids, minRating } = {}) {
  const where = [];
  const params = [];

  if (month) {
    where.push('release_date >= ? AND release_date < DATE_ADD(?, INTERVAL 1 MONTH)');
    params.push(`${month}-01`, `${month}-01`);
  }
  if (from) {
    where.push('release_date >= ?');
    params.push(from);
  }
  if (to) {
    where.push('release_date <= ?');
    params.push(to);
  }
  if (platform) {
    where.push('JSON_CONTAINS(platforms, JSON_QUOTE(?))');
    params.push(platform);
  }
  if (genre) {
    where.push('(genre = ? OR JSON_CONTAINS(genres, JSON_QUOTE(?)))');
    params.push(genre, genre);
  }
  if (q) {
    where.push('(title LIKE ? OR description LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (ids?.length) {
    where.push('id IN (?)');
    params.push(ids);
  }
  if (minRating !== undefined) {
    where.push('rating >= ?');
    params.push(minRating);
  }

  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

export async function findAll({ sort = 'releaseDate', limit = 50, offset = 0, ...filters } = {}) {
  const { sql: whereSql, params } = buildWhere(filters);

  const desc = sort.startsWith('-');
  const column = SORT_COLUMNS[desc ? sort.slice(1) : sort] ?? 'release_date';

  const [rows] = await pool.query(
    `SELECT ${SELECT_COLUMNS} FROM games ${whereSql}
     ORDER BY ${column} ${desc ? 'DESC' : 'ASC'}, id ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM games ${whereSql}`, params);

  return { items: rows.map(toGame), total };
}

// 페이지 없이 전부 (정리/검사용 스크립트에서만 쓴다)
export async function findEveryGame() {
  const [rows] = await pool.query(`SELECT ${SELECT_COLUMNS} FROM games ORDER BY id`);
  return rows.map(toGame);
}

export async function removeMany(ids) {
  if (!ids.length) return 0;
  const [result] = await pool.query('DELETE FROM games WHERE id IN (?)', [ids]);
  return result.affectedRows;
}

export async function findById(id) {
  const [rows] = await pool.query(`SELECT ${SELECT_COLUMNS} FROM games WHERE id = ?`, [id]);
  return toGame(rows[0]);
}

export async function create(data) {
  const [result] = await pool.query('INSERT INTO games SET ?', [toDbValues(data, true)]);
  return findById(result.insertId);
}

// PUT: 모든 필드를 덮어쓴다 (보내지 않은 선택 필드는 NULL)
export async function replace(id, data) {
  const [result] = await pool.query('UPDATE games SET ? WHERE id = ?', [toDbValues(data, true), id]);
  if (result.affectedRows === 0) return null;
  return findById(id);
}

// PATCH: 보낸 필드만 바꾼다
export async function patch(id, data) {
  const values = toDbValues(data, false);
  if (Object.keys(values).length === 0) return findById(id);
  const [result] = await pool.query('UPDATE games SET ? WHERE id = ?', [values, id]);
  if (result.affectedRows === 0) return null;
  return findById(id);
}

export async function remove(id) {
  const [result] = await pool.query('DELETE FROM games WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

// 외부 API 가져오기용: externalId가 같으면 갱신하고 없으면 새로 넣는다
// 같은 제목+출시일의 다른 게임이 이미 있으면 INSERT가 ER_DUP_ENTRY로 실패한다 (호출한 쪽에서 건너뜀)
export async function upsertByExternalId(data) {
  const [[existing]] = await pool.query('SELECT id FROM games WHERE external_id = ?', [data.externalId]);

  if (existing) {
    // 이미 있는 게임은 이번에 받은 필드만 갱신한다. 받지 않은 필드(직접 넣은 트레일러, 대작 고정 순서,
    // 이번에 상세 정보를 안 가져온 설명 등)는 그대로 둔다.
    const [result] = await pool.query('UPDATE games SET ? WHERE id = ?', [toDbValues(data, false), existing.id]);
    // changedRows: 값이 실제로 바뀐 행 수 (affectedRows는 변화가 없어도 1로 나온다)
    return { action: result.changedRows > 0 ? 'updated' : 'unchanged' };
  }
  await pool.query('INSERT INTO games SET ?', [toDbValues(data, true)]);
  return { action: 'inserted' };
}

// ---- 스토어 링크와 가격 (scripts/enrichStores.js, scripts/refreshPrices.js 에서만 쓴다) ----

// stores가 NULL = 아직 확인 안 함. '[]' = 확인했는데 스토어가 없음
export async function findNeedingStores(limit = 1000) {
  const [rows] = await pool.query(
    'SELECT id, external_id AS externalId, title FROM games WHERE external_id IS NOT NULL AND stores IS NULL ORDER BY popularity DESC, id ASC LIMIT ?',
    [limit],
  );
  return rows;
}

export async function updateStores(id, stores, steamAppId) {
  await pool.query('UPDATE games SET stores = ?, steam_app_id = ? WHERE id = ?', [JSON.stringify(stores), steamAppId ?? null, id]);
}

export async function findWithSteamApp() {
  const [rows] = await pool.query('SELECT id, steam_app_id AS steamAppId, title FROM games WHERE steam_app_id IS NOT NULL ORDER BY id');
  return rows;
}

// price: { currency, final, initial, discountPercent, formatted } 또는 null (가격 없음). 확인한 시각은 UTC로 남긴다
export async function updatePrice(id, price) {
  await pool.query(
    `UPDATE games SET price_final = ?, price_initial = ?, price_discount_percent = ?, price_currency = ?, price_formatted = ?,
       price_updated_at = UTC_TIMESTAMP() WHERE id = ?`,
    [price?.final ?? null, price?.initial ?? null, price?.discountPercent ?? null, price?.currency ?? null, price?.formatted ?? null, id],
  );
}

// 메인 화면(히어로)에 고정해서 보여 줄 대작들. featuredOrder가 작을수록 먼저
export async function findFeatured() {
  const [rows] = await pool.query(
    `SELECT ${SELECT_COLUMNS} FROM games WHERE featured_order IS NOT NULL ORDER BY featured_order ASC, id ASC`,
  );
  return rows.map(toGame);
}

// 달력용: 날짜별 출시 개수와 인기 상위 게임
export async function calendarSummary({ top = 3, ...filters } = {}) {
  const { sql, params } = buildWhere(filters);
  const [rows] = await pool.query(
    `SELECT id, title, release_date AS releaseDate, cover_image_url AS coverImageUrl, rating, popularity
     FROM games ${sql}
     ORDER BY release_date ASC, popularity DESC, rating DESC, id ASC`,
    params,
  );

  const days = new Map();
  for (const row of rows) {
    if (!days.has(row.releaseDate)) days.set(row.releaseDate, { date: row.releaseDate, count: 0, games: [] });
    const day = days.get(row.releaseDate);
    day.count += 1;
    if (day.games.length < top) {
      day.games.push({ id: row.id, title: row.title, coverImageUrl: row.coverImageUrl, rating: row.rating });
    }
  }
  return [...days.values()];
}

// 비슷한 게임: 장르와 태그가 많이 겹치는 순서
export async function findSimilar(id, limit = 6) {
  const target = await findById(id);
  if (!target) return null;

  const [rows] = await pool.query(
    `SELECT ${SELECT_COLUMNS} FROM games WHERE id <> ? ORDER BY rating DESC, id ASC LIMIT 500`,
    [id],
  );

  const targetGenres = new Set(target.genres);
  const targetTags = new Set(target.tags);
  const overlap = (list, set) => list.filter((x) => set.has(x)).length;

  return rows
    .map(toGame)
    .map((game) => ({ game, score: overlap(game.genres, targetGenres) * 3 + overlap(game.tags, targetTags) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || (b.game.rating ?? 0) - (a.game.rating ?? 0))
    .slice(0, limit)
    .map((x) => x.game);
}

// 필터용: 장르/플랫폼별 게임 수
export async function countByGenre() {
  const [rows] = await pool.query(
    `SELECT jt.name AS name, COUNT(*) AS count
     FROM games, JSON_TABLE(COALESCE(genres, JSON_ARRAY(genre)), '$[*]' COLUMNS (name VARCHAR(100) PATH '$')) jt
     WHERE jt.name IS NOT NULL
     GROUP BY jt.name ORDER BY count DESC, name ASC`,
  );
  return rows;
}

export async function countByPlatform() {
  const [rows] = await pool.query(
    `SELECT jt.name AS name, COUNT(*) AS count
     FROM games, JSON_TABLE(platforms, '$[*]' COLUMNS (name VARCHAR(100) PATH '$')) jt
     WHERE jt.name IS NOT NULL
     GROUP BY jt.name ORDER BY count DESC, name ASC`,
  );
  return rows;
}
