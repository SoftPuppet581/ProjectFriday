import pool from '../config/db.js';

export const CATEGORIES = ['자유', '질문', '추천', '공략'];

const iso = (ms) => new Date(Number(ms)).toISOString();
const author = (row) => ({ id: row.authorId, displayName: row.authorName, avatar: row.authorAvatar });

// 글 목록/상세 공통 SELECT. viewerId는 "내가 좋아요 했는지"를 알려 주는 데 쓴다 (없으면 0)
function postSelect(withBody) {
  return `SELECT p.id, p.category, p.title, ${withBody ? 'p.body' : 'LEFT(p.body, 140) AS excerpt'},
      p.game_id AS gameId, g.title AS gameTitle, UNIX_TIMESTAMP(p.created_at) * 1000 AS createdMs,
      u.id AS authorId, u.display_name AS authorName, u.avatar AS authorAvatar,
      (SELECT COUNT(*) FROM forum_comments c WHERE c.post_id = p.id) AS commentCount,
      (SELECT COUNT(*) FROM forum_likes l WHERE l.post_id = p.id) AS likeCount,
      (SELECT COUNT(*) FROM forum_likes l WHERE l.post_id = p.id AND l.user_id = ?) AS liked
    FROM forum_posts p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN games g ON g.id = p.game_id`;
}

function mapPost(row, viewerId) {
  const post = {
    id: row.id,
    category: row.category,
    title: row.title,
    author: author(row),
    game: row.gameId && row.gameTitle ? { id: row.gameId, title: row.gameTitle } : null,
    createdAt: iso(row.createdMs),
    commentCount: Number(row.commentCount),
    likeCount: Number(row.likeCount),
    liked: Boolean(Number(row.liked)),
    mine: viewerId != null && row.authorId === viewerId,
  };
  if ('body' in row) post.body = row.body;
  else post.excerpt = row.excerpt;
  return post;
}

export async function findAll({ category, q, gameId, sort = 'recent', limit = 20, offset = 0, viewerId = null } = {}) {
  const where = [];
  const params = [];
  if (category) {
    where.push('p.category = ?');
    params.push(category);
  }
  if (gameId) {
    where.push('p.game_id = ?');
    params.push(gameId);
  }
  if (q) {
    where.push('(p.title LIKE ? OR p.body LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const order = sort === 'popular' ? '(likeCount * 2 + commentCount) DESC, p.created_at DESC, p.id DESC' : 'p.created_at DESC, p.id DESC';

  const [rows] = await pool.query(`${postSelect(false)} ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`, [viewerId ?? 0, ...params, limit, offset]);
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM forum_posts p ${whereSql}`, params);
  return { items: rows.map((row) => mapPost(row, viewerId)), total };
}

export async function findById(id, viewerId = null) {
  const [rows] = await pool.query(`${postSelect(true)} WHERE p.id = ?`, [viewerId ?? 0, id]);
  if (!rows[0]) return null;
  const post = mapPost(rows[0], viewerId);

  const [comments] = await pool.query(
    `SELECT c.id, c.body, UNIX_TIMESTAMP(c.created_at) * 1000 AS createdMs,
       u.id AS authorId, u.display_name AS authorName, u.avatar AS authorAvatar
     FROM forum_comments c JOIN users u ON u.id = c.user_id WHERE c.post_id = ? ORDER BY c.created_at ASC, c.id ASC`,
    [id],
  );
  post.comments = comments.map((c) => ({ id: c.id, body: c.body, author: author(c), createdAt: iso(c.createdMs), mine: viewerId != null && c.authorId === viewerId }));
  return post;
}

export async function create({ userId, category, title, body, gameId }) {
  const [result] = await pool.query('INSERT INTO forum_posts (user_id, category, title, body, game_id) VALUES (?, ?, ?, ?, ?)', [userId, category, title, body, gameId ?? null]);
  return findById(result.insertId, userId);
}

// 'ok' | 'notfound' | 'forbidden' (내 글이 아님)
export async function removePost(id, userId) {
  const [[post]] = await pool.query('SELECT user_id AS userId FROM forum_posts WHERE id = ?', [id]);
  if (!post) return 'notfound';
  if (post.userId !== userId) return 'forbidden';
  await pool.query('DELETE FROM forum_posts WHERE id = ?', [id]);
  return 'ok';
}

export async function postExists(id) {
  const [rows] = await pool.query('SELECT 1 FROM forum_posts WHERE id = ?', [id]);
  return rows.length > 0;
}

export async function addComment({ postId, userId, body }) {
  const [result] = await pool.query('INSERT INTO forum_comments (post_id, user_id, body) VALUES (?, ?, ?)', [postId, userId, body]);
  const post = await findById(postId, userId);
  return post.comments.find((comment) => comment.id === result.insertId);
}

// 'ok' | 'notfound' | 'forbidden'
export async function removeComment(postId, commentId, userId) {
  const [[comment]] = await pool.query('SELECT user_id AS userId FROM forum_comments WHERE id = ? AND post_id = ?', [commentId, postId]);
  if (!comment) return 'notfound';
  if (comment.userId !== userId) return 'forbidden';
  await pool.query('DELETE FROM forum_comments WHERE id = ?', [commentId]);
  return 'ok';
}

export async function like(postId, userId) {
  await pool.query('INSERT IGNORE INTO forum_likes (post_id, user_id) VALUES (?, ?)', [postId, userId]);
}

export async function unlike(postId, userId) {
  await pool.query('DELETE FROM forum_likes WHERE post_id = ? AND user_id = ?', [postId, userId]);
}
