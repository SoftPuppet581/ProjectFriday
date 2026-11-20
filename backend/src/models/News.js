import pool from '../config/db.js';

const SELECT_COLUMNS = `id, source, language, title, url, excerpt, image_url AS imageUrl,
  DATE_FORMAT(published_at, '%Y-%m-%dT%H:%i:%sZ') AS publishedAt`;

// published_at은 UTC로 저장한다 (쓰는 쪽에서 UTC 문자열을 넣는다)
export async function upsertMany(items) {
  let saved = 0;
  for (const item of items) {
    const [result] = await pool.query(
      `INSERT INTO news (source, language, title, url, excerpt, image_url, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title), excerpt = VALUES(excerpt),
         image_url = COALESCE(VALUES(image_url), image_url), source = VALUES(source)`,
      [item.source, item.language, item.title, item.url, item.excerpt, item.imageUrl, item.publishedAt],
    );
    if (result.affectedRows > 0) saved += 1;
  }
  return saved;
}

function buildWhere({ source, language, q } = {}) {
  const where = [];
  const params = [];
  if (source) {
    where.push('source = ?');
    params.push(source);
  }
  if (language) {
    where.push('language = ?');
    params.push(language);
  }
  if (q) {
    where.push('(title LIKE ? OR excerpt LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

export async function findAll({ limit = 20, offset = 0, ...filters } = {}) {
  const { sql, params } = buildWhere(filters);
  const [rows] = await pool.query(
    `SELECT ${SELECT_COLUMNS} FROM news ${sql} ORDER BY published_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM news ${sql}`, params);
  return { items: rows, total };
}

export async function countBySource() {
  const [rows] = await pool.query(
    'SELECT source AS name, language, COUNT(*) AS count FROM news GROUP BY source, language ORDER BY count DESC, name ASC',
  );
  return rows;
}

// 마지막으로 가져온 시각 (UTC 밀리초). 한 번도 없으면 null
export async function lastFetchedAt() {
  const [[row]] = await pool.query('SELECT UNIX_TIMESTAMP(MAX(fetched_at)) * 1000 AS ms FROM news');
  return row.ms === null ? null : Number(row.ms);
}

// 오래된 기사를 지우고 최신 keep개만 남긴다
export async function prune(keep = 500) {
  const [result] = await pool.query(
    `DELETE FROM news WHERE id NOT IN (SELECT id FROM (SELECT id FROM news ORDER BY published_at DESC, id DESC LIMIT ?) AS newest)`,
    [keep],
  );
  return result.affectedRows;
}
