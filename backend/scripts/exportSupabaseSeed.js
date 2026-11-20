// 시연용 샘플 계정 20개와 포럼 활동을 Supabase에 넣는 SQL(supabase/seed_demo.sql)을 만든다.
// 사용법: npm run export:supabase-seed   → 만들어진 파일을 Supabase 대시보드 SQL Editor에 붙여 넣고 Run
// 게임 연결(game_id, game_title)은 로컬 DB의 games 테이블에서 찾는다. 다시 실행해도 샘플만 지우고 다시 넣는다 (실제 사용자 글은 그대로).
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pool from '../src/config/db.js';
import { DEMO_USERS, DEMO_POSTS } from '../db/demoForum.js';

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../../supabase/seed_demo.sql');
const q = (value) => (value === null || value === undefined ? 'null' : `'${String(value).replaceAll("'", "''")}'`);

// 이름으로 만드는 고정 uuid (다시 만들어도 같은 값)
function uuidFor(name) {
  const hex = createHash('sha1').update(`projectfriday-demo:${name}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

try {
  const ids = new Map(DEMO_USERS.map(([name]) => [name, uuidFor(name)]));
  const lines = [
    '-- 자동 생성 파일 (backend/scripts/exportSupabaseSeed.js). 시연용 가상의 샘플 계정과 글이다. 샘플 계정은 로그인할 수 없다.',
    '-- 먼저 supabase/schema.sql을 실행한 뒤 이 파일을 실행한다.',
    'begin;',
    'delete from public.profiles where is_demo;  -- 글, 댓글, 좋아요는 연쇄로 지워진다',
    '',
  ];

  DEMO_USERS.forEach(([name, avatar], index) => {
    lines.push(
      `insert into public.profiles (id, display_name, avatar, is_demo, created_at) values (${q(ids.get(name))}, ${q(name)}, ${q(avatar)}, true, now() - interval '${(20 - index) * 24 * 60 + index * 37} minutes');`,
    );
  });
  lines.push('');

  let comments = 0;
  let likes = 0;
  const unlinked = [];
  for (const [index, post] of DEMO_POSTS.entries()) {
    let game = null;
    if (post.game) {
      const [[row]] = await pool.query('SELECT id, title FROM games WHERE title = ? LIMIT 1', [post.game]);
      if (row) game = row;
      else unlinked.push(post.game);
    }
    const postId = index + 1;
    const minutesAgo = Math.round(post.ago * 60);
    lines.push(
      `insert into public.forum_posts (id, user_id, category, title, body, game_id, game_title, created_at) overriding system value values (${postId}, ${q(ids.get(post.by))}, ${q(post.category)}, ${q(post.title)}, ${q(post.body)}, ${game ? game.id : 'null'}, ${q(game?.title)}, now() - interval '${minutesAgo} minutes');`,
    );
    for (const comment of post.comments ?? []) {
      const ago = Math.max(1, Math.round(minutesAgo - comment.after * 60)); // 미래 시각이 되지 않게
      lines.push(
        `insert into public.forum_comments (post_id, user_id, body, created_at) values (${postId}, ${q(ids.get(comment.by))}, ${q(comment.body)}, now() - interval '${ago} minutes');`,
      );
      comments += 1;
    }
    for (const name of new Set(post.likes ?? [])) {
      if (name === post.by) continue;
      lines.push(
        `insert into public.forum_likes (post_id, user_id, created_at) values (${postId}, ${q(ids.get(name))}, now() - interval '${Math.max(1, minutesAgo - 60)} minutes');`,
      );
      likes += 1;
    }
  }
  lines.push(
    '',
    "-- 직접 지정한 글 번호 때문에 다음 새 글 번호가 겹치지 않게 맞춘다",
    "select setval(pg_get_serial_sequence('public.forum_posts', 'id'), (select greatest(max(id), 1) from public.forum_posts));",
    'commit;',
    '',
  );

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, lines.join('\n'), 'utf8');
  console.log(`만들었습니다: ${out}\n  계정 ${DEMO_USERS.length}개, 글 ${DEMO_POSTS.length}개, 댓글 ${comments}개, 좋아요 ${likes}개`);
  if (unlinked.length) console.log(`  (DB에 없어서 게임 연결을 못 한 글: ${unlinked.join(', ')})`);
} finally {
  await pool.end();
}
