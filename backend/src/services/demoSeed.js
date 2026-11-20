// 시연용 샘플 계정과 포럼 활동을 넣고 지운다. (데이터: db/demoForum.js)
// - 샘플 계정은 DB에 is_demo = 1 이 붙고, 비밀번호는 무작위로 만들어 버리므로 아무도 로그인할 수 없다
// - 이메일은 실제로 존재할 수 없는 .invalid 주소다
// - 다시 실행하면 기존 샘플을 지우고 현재 시각 기준으로 다시 넣는다 (실제 사용자의 글은 건드리지 않는다)
import { randomBytes } from 'node:crypto';
import { hashPassword } from './passwords.js';
import { DEMO_USERS, DEMO_POSTS } from '../../db/demoForum.js';

const HOUR = 3600_000;

export async function removeDemo(pool) {
  const [result] = await pool.query('DELETE FROM users WHERE is_demo = 1'); // 글, 댓글, 좋아요, 세션은 연쇄로 지워진다
  return result.affectedRows;
}

export async function seedDemo(pool, { now = Date.now(), log = () => {} } = {}) {
  await removeDemo(pool);

  // 가입 시각은 글보다 이전으로 (최대 20일 전부터 차례로)
  const ids = new Map();
  for (const [index, [name, avatar]] of DEMO_USERS.entries()) {
    const joinedAt = now - (20 - index) * 24 * HOUR - index * 37 * 60_000;
    const passwordHash = await hashPassword(randomBytes(32).toString('hex')); // 아무도 모르는 비밀번호
    const [result] = await pool.query(
      `INSERT INTO users (email, display_name, password_hash, avatar, is_demo, created_at) VALUES (?, ?, ?, ?, 1, FROM_UNIXTIME(?))`,
      [`demo-${String(index + 1).padStart(2, '0')}@demo.invalid`, name, passwordHash, avatar, Math.floor(joinedAt / 1000)],
    );
    ids.set(name, result.insertId);
  }

  const stats = { users: ids.size, posts: 0, comments: 0, likes: 0, unlinkedGames: [] };
  for (const post of DEMO_POSTS) {
    let gameId = null;
    if (post.game) {
      const [[game]] = await pool.query('SELECT id FROM games WHERE title = ? LIMIT 1', [post.game]);
      if (game) gameId = game.id;
      else stats.unlinkedGames.push(post.game);
    }

    const postedAt = now - post.ago * HOUR;
    const [created] = await pool.query(
      'INSERT INTO forum_posts (user_id, category, title, body, game_id, created_at) VALUES (?, ?, ?, ?, ?, FROM_UNIXTIME(?))',
      [ids.get(post.by), post.category, post.title, post.body, gameId, Math.floor(postedAt / 1000)],
    );
    stats.posts += 1;

    for (const comment of post.comments ?? []) {
      const commentedAt = Math.min(now - 60_000, postedAt + comment.after * HOUR); // 미래 시각이 되지 않게
      await pool.query('INSERT INTO forum_comments (post_id, user_id, body, created_at) VALUES (?, ?, ?, FROM_UNIXTIME(?))', [
        created.insertId, ids.get(comment.by), comment.body, Math.floor(commentedAt / 1000),
      ]);
      stats.comments += 1;
    }
    for (const name of post.likes ?? []) {
      if (name === post.by) continue;
      await pool.query('INSERT IGNORE INTO forum_likes (post_id, user_id, created_at) VALUES (?, ?, FROM_UNIXTIME(?))', [
        created.insertId, ids.get(name), Math.floor(Math.min(now - 60_000, postedAt + HOUR) / 1000),
      ]);
      stats.likes += 1;
    }
    log(`  글 #${created.insertId} ${post.title}`);
  }
  return stats;
}
