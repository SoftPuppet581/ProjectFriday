import pool from '../config/db.js';

const SELECT_COLUMNS = `
  id, title,
  release_date AS releaseDate,
  platforms, genre, description,
  trailer_url AS trailerUrl,
  cover_image_url AS coverImageUrl,
  official_url AS officialUrl,
  created_at AS createdAt,
  updated_at AS updatedAt`;

const SORT_COLUMNS = {
  releaseDate: 'release_date',
  title: 'title',
  createdAt: 'created_at',
};

function toGame(row) {
  if (!row) return null;
  return { ...row, platforms: JSON.parse(row.platforms) };
}

function toDbValues(data) {
  return {
    title: data.title,
    release_date: data.releaseDate,
    platforms: JSON.stringify(data.platforms ?? []),
    genre: data.genre ?? null,
    description: data.description ?? null,
    trailer_url: data.trailerUrl ?? null,
    cover_image_url: data.coverImageUrl ?? null,
    official_url: data.officialUrl ?? null,
  };
}

const FIELD_TO_COLUMN = {
  title: 'title',
  releaseDate: 'release_date',
  platforms: 'platforms',
  genre: 'genre',
  description: 'description',
  trailerUrl: 'trailer_url',
  coverImageUrl: 'cover_image_url',
  officialUrl: 'official_url',
};

export async function findAll({ month, platform, genre, q, sort = 'releaseDate' } = {}) {
  const where = [];
  const params = [];

  if (month) {
    where.push("release_date >= ? AND release_date < DATE_ADD(?, INTERVAL 1 MONTH)");
    params.push(`${month}-01`, `${month}-01`);
  }
  if (platform) {
    where.push('JSON_CONTAINS(platforms, JSON_QUOTE(?))');
    params.push(platform);
  }
  if (genre) {
    where.push('genre = ?');
    params.push(genre);
  }
  if (q) {
    where.push('(title LIKE ? OR description LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }

  const desc = sort.startsWith('-');
  const column = SORT_COLUMNS[desc ? sort.slice(1) : sort] ?? 'release_date';
  const sql = `SELECT ${SELECT_COLUMNS} FROM games
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY ${column} ${desc ? 'DESC' : 'ASC'}, id ASC`;

  const [rows] = await pool.query(sql, params);
  return rows.map(toGame);
}

export async function findById(id) {
  const [rows] = await pool.query(`SELECT ${SELECT_COLUMNS} FROM games WHERE id = ?`, [id]);
  return toGame(rows[0]);
}

export async function create(data) {
  const [result] = await pool.query('INSERT INTO games SET ?', [toDbValues(data)]);
  return findById(result.insertId);
}

// PUT: 모든 필드를 덮어쓴다 (없는 선택 필드는 NULL)
export async function replace(id, data) {
  const [result] = await pool.query('UPDATE games SET ? WHERE id = ?', [toDbValues(data), id]);
  if (result.affectedRows === 0) return null;
  return findById(id);
}

// PATCH: 보낸 필드만 바꾼다
export async function patch(id, data) {
  const values = {};
  for (const [field, column] of Object.entries(FIELD_TO_COLUMN)) {
    if (field in data) {
      values[column] = field === 'platforms' ? JSON.stringify(data[field]) : data[field];
    }
  }
  if (Object.keys(values).length === 0) return findById(id);
  const [result] = await pool.query('UPDATE games SET ? WHERE id = ?', [values, id]);
  if (result.affectedRows === 0) return null;
  return findById(id);
}

export async function remove(id) {
  const [result] = await pool.query('DELETE FROM games WHERE id = ?', [id]);
  return result.affectedRows > 0;
}
