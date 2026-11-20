// 배포용(Vercel) 정적 데이터 스냅샷을 만든다. 서버와 DB 없이 화면이 이 JSON만으로 읽기 전용으로 동작한다.
// 개인정보 보호: 사용자 테이블은 내보내지 않는다. 포럼은 **시연용 샘플 계정(is_demo)의 글/댓글만** 내보내고,
// 작성자는 { id, displayName, avatar } 뿐이다 (이메일, 비밀번호 해시, 토큰은 어디에도 없다).
import * as Game from '../models/Game.js';
import * as News from '../models/News.js';

const iso = (ms) => new Date(Number(ms)).toISOString();
const author = (row) => ({ id: row.authorId, displayName: row.authorName, avatar: row.authorAvatar });

async function forumSnapshot(pool) {
  const [posts] = await pool.query(
    `SELECT p.id, p.category, p.title, p.body, p.game_id AS gameId, g.title AS gameTitle,
       UNIX_TIMESTAMP(p.created_at) * 1000 AS createdMs, u.id AS authorId, u.display_name AS authorName, u.avatar AS authorAvatar
     FROM forum_posts p JOIN users u ON u.id = p.user_id LEFT JOIN games g ON g.id = p.game_id
     WHERE u.is_demo = 1 ORDER BY p.created_at DESC, p.id DESC`,
  );
  const [comments] = await pool.query(
    `SELECT c.id, c.post_id AS postId, c.body, UNIX_TIMESTAMP(c.created_at) * 1000 AS createdMs,
       u.id AS authorId, u.display_name AS authorName, u.avatar AS authorAvatar
     FROM forum_comments c JOIN users u ON u.id = c.user_id WHERE u.is_demo = 1 ORDER BY c.created_at ASC, c.id ASC`,
  );
  const [likes] = await pool.query('SELECT l.post_id AS postId, COUNT(*) AS n FROM forum_likes l JOIN users u ON u.id = l.user_id WHERE u.is_demo = 1 GROUP BY l.post_id');
  const likeCount = new Map(likes.map((row) => [row.postId, Number(row.n)]));

  return posts.map((post) => {
    const own = comments.filter((c) => c.postId === post.id).map((c) => ({ id: c.id, body: c.body, author: author(c), createdAt: iso(c.createdMs), mine: false }));
    return {
      id: post.id,
      category: post.category,
      title: post.title,
      body: post.body,
      author: author(post),
      game: post.gameId && post.gameTitle ? { id: post.gameId, title: post.gameTitle } : null,
      createdAt: iso(post.createdMs),
      commentCount: own.length,
      likeCount: likeCount.get(post.id) ?? 0,
      liked: false,
      mine: false,
      comments: own,
    };
  });
}

export async function buildSnapshot(pool, { now = new Date() } = {}) {
  const games = (await Game.findEveryGame()).map(({ createdAt, updatedAt, ...game }) => game);
  const featured = (await Game.findFeatured()).map((game) => game.id);
  const { items: news } = await News.findAll({ limit: 1000 });
  const forum = await forumSnapshot(pool);
  return {
    games,
    featured,
    news,
    forum,
    meta: { exportedAt: now.toISOString(), games: games.length, news: news.length, forumPosts: forum.length },
  };
}
