import pool from '../config/db.js';
import * as Game from './Game.js';

// created_at은 TIMESTAMP(UTC로 저장)라서 DATE_FORMAT 대신 UNIX_TIMESTAMP를 받아 ISO로 바꾼다 (서버 시간대에 영향받지 않게)
const USER_COLUMNS = `id, email, display_name AS displayName, avatar, preferred_platform AS preferredPlatform,
  UNIX_TIMESTAMP(created_at) * 1000 AS createdMs`;

function toUser(row) {
  if (!row) return null;
  const { createdMs, ...user } = row;
  return { ...user, createdAt: new Date(Number(createdMs)).toISOString() };
}

export async function create({ email, displayName, passwordHash }) {
  const [result] = await pool.query('INSERT INTO users (email, display_name, password_hash) VALUES (?, ?, ?)', [email, displayName, passwordHash]);
  return findById(result.insertId);
}

export async function findById(id) {
  const [rows] = await pool.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [id]);
  return toUser(rows[0]);
}

// 로그인 확인용. 비밀번호 해시가 들어 있으니 API 응답에 그대로 쓰면 안 된다
export async function findCredentialsByEmail(email) {
  const [rows] = await pool.query(`SELECT ${USER_COLUMNS}, password_hash AS passwordHash FROM users WHERE email = ?`, [email]);
  return toUser(rows[0]);
}

export async function updateProfile(id, { displayName, preferredPlatform, avatar }) {
  const values = {};
  if (displayName !== undefined) values.display_name = displayName;
  if (preferredPlatform !== undefined) values.preferred_platform = preferredPlatform;
  if (avatar !== undefined) values.avatar = avatar;
  if (Object.keys(values).length) await pool.query('UPDATE users SET ? WHERE id = ?', [values, id]);
  return findById(id);
}

// ---- 로그인 세션 ----

export async function createSession(userId, tokenHash, days = 14) {
  await pool.query('DELETE FROM sessions WHERE expires_at < UTC_TIMESTAMP()'); // 만료된 세션 정리
  await pool.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? DAY))', [tokenHash, userId, days]);
  const [[row]] = await pool.query("SELECT DATE_FORMAT(expires_at, '%Y-%m-%dT%H:%i:%sZ') AS expiresAt FROM sessions WHERE token_hash = ?", [tokenHash]);
  return row.expiresAt;
}

// 만료되지 않은 세션의 사용자. 없으면 null. 시연용 샘플 계정(is_demo)은 로그인할 수 없다
export async function findUserBySession(tokenHash) {
  const [rows] = await pool.query(
    `SELECT u.id, u.email, u.display_name AS displayName, u.avatar, u.preferred_platform AS preferredPlatform,
       UNIX_TIMESTAMP(u.created_at) * 1000 AS createdMs
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP() AND u.is_demo = 0`,
    [tokenHash],
  );
  return toUser(rows[0]);
}

export async function deleteSession(tokenHash) {
  const [result] = await pool.query('DELETE FROM sessions WHERE token_hash = ?', [tokenHash]);
  return result.affectedRows > 0;
}

// ---- 관심 게임 (계정에 저장) ----

export async function favoriteIds(userId) {
  const [rows] = await pool.query(
    'SELECT f.game_id AS id FROM user_favorites f JOIN games g ON g.id = f.game_id WHERE f.user_id = ? ORDER BY f.created_at DESC, f.game_id DESC',
    [userId],
  );
  return rows.map((row) => row.id);
}

export async function favoriteGames(userId) {
  const ids = await favoriteIds(userId);
  if (!ids.length) return [];
  const { items } = await Game.findAll({ ids, limit: 500, sort: 'releaseDate' });
  return items;
}

// 있는 게임만 추가한다 (이미 있어도 에러 없음). 추가된 개수를 돌려준다
export async function addFavorites(userId, gameIds) {
  if (!gameIds.length) return 0;
  const [result] = await pool.query('INSERT IGNORE INTO user_favorites (user_id, game_id) SELECT ?, id FROM games WHERE id IN (?)', [userId, gameIds]);
  return result.affectedRows;
}

export async function gameExists(gameId) {
  const [rows] = await pool.query('SELECT 1 FROM games WHERE id = ?', [gameId]);
  return rows.length > 0;
}

export async function removeFavorite(userId, gameId) {
  await pool.query('DELETE FROM user_favorites WHERE user_id = ? AND game_id = ?', [userId, gameId]);
}
