-- ProjectFriday용 Supabase(PostgreSQL) 스키마: 회원 프로필, 관심 게임, 포럼
-- 사용법: Supabase 대시보드 → SQL Editor → New query → 이 파일 전체를 붙여 넣고 Run. (여러 번 실행해도 안전하다)
--
-- 로그인(이메일/비밀번호, 비밀번호 해시, 토큰)은 Supabase Auth(auth.users)가 맡는다. 그래서 MariaDB의 users/sessions 테이블은 없다.
-- 게임/뉴스 데이터는 DB에 두지 않고 화면의 JSON 스냅샷(frontend/public/data)을 쓴다. 그래서 game_id에는 외래키가 없다.
-- 모든 테이블에 RLS(행 수준 보안)를 켠다: 읽기는 누구나, 쓰기/삭제는 로그인한 본인 행만 된다.

-- ---------- 프로필 (auth.users 1명당 1행) ----------
create table if not exists public.profiles (
  id                 uuid primary key,                     -- 로그인 계정의 id. 시연용 샘플 계정은 auth.users에 없어서 로그인할 수 없다
  display_name       text not null check (char_length(display_name) between 1 and 40),
  avatar             text check (avatar is null or avatar ~ '^a(0[1-9]|1[0-9]|20)$'),
  preferred_platform text check (preferred_platform is null or char_length(preferred_platform) <= 50),
  is_demo            boolean not null default false,
  created_at         timestamptz not null default now()
);

-- 가입하면 프로필을 자동으로 만든다 (닉네임은 가입 때 user_metadata.display_name으로 받는다)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)), 40));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- 관심 게임 ----------
create table if not exists public.user_favorites (
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  game_id    integer not null check (game_id > 0),
  created_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

-- ---------- 포럼 ----------
create table if not exists public.forum_posts (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  category   text not null check (category in ('자유', '질문', '추천', '공략')),
  title      text not null check (char_length(btrim(title)) between 1 and 100),
  body       text not null check (char_length(btrim(body)) between 1 and 3000),
  game_id    integer,
  game_title text,
  created_at timestamptz not null default now()
);
create index if not exists idx_posts_created on public.forum_posts (created_at desc);
create index if not exists idx_posts_user on public.forum_posts (user_id);

create table if not exists public.forum_comments (
  id         bigint generated always as identity primary key,
  post_id    bigint not null references public.forum_posts (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists idx_comments_post on public.forum_comments (post_id, created_at);

create table if not exists public.forum_likes (
  post_id    bigint not null references public.forum_posts (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- ---------- 보안 규칙 (RLS) ----------
alter table public.profiles       enable row level security;
alter table public.user_favorites enable row level security;
alter table public.forum_posts    enable row level security;
alter table public.forum_comments enable row level security;
alter table public.forum_likes    enable row level security;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (true);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists favorites_own on public.user_favorites;
create policy favorites_own on public.user_favorites for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists posts_read on public.forum_posts;
create policy posts_read on public.forum_posts for select using (true);
drop policy if exists posts_insert_own on public.forum_posts;
create policy posts_insert_own on public.forum_posts for insert with check (auth.uid() = user_id);
drop policy if exists posts_delete_own on public.forum_posts;
create policy posts_delete_own on public.forum_posts for delete using (auth.uid() = user_id);

drop policy if exists comments_read on public.forum_comments;
create policy comments_read on public.forum_comments for select using (true);
drop policy if exists comments_insert_own on public.forum_comments;
create policy comments_insert_own on public.forum_comments for insert with check (auth.uid() = user_id);
drop policy if exists comments_delete_own on public.forum_comments;
create policy comments_delete_own on public.forum_comments for delete using (auth.uid() = user_id);

drop policy if exists likes_read on public.forum_likes;
create policy likes_read on public.forum_likes for select using (true);
drop policy if exists likes_insert_own on public.forum_likes;
create policy likes_insert_own on public.forum_likes for insert with check (auth.uid() = user_id);
drop policy if exists likes_delete_own on public.forum_likes;
create policy likes_delete_own on public.forum_likes for delete using (auth.uid() = user_id);

-- 프로필은 닉네임/프로필 사진/선호 플랫폼만 본인이 바꿀 수 있다 (is_demo 같은 열은 못 바꾼다). 글/댓글은 수정 없이 삭제만 된다
revoke all on public.profiles, public.user_favorites, public.forum_posts, public.forum_comments, public.forum_likes from anon, authenticated;
grant select on public.profiles, public.forum_posts, public.forum_comments, public.forum_likes to anon, authenticated;
grant update (display_name, avatar, preferred_platform) on public.profiles to authenticated;
grant select, insert, delete on public.user_favorites to authenticated;
grant insert, delete on public.forum_posts, public.forum_comments, public.forum_likes to authenticated;
