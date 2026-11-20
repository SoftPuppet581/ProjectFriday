-- ProjectFriday 피드백. supabase/schema.sql을 적용한 프로젝트에서 실행한다.
begin;

create table if not exists public.feedback (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  nickname   text not null check (char_length(nickname) between 1 and 40),
  rating     smallint not null check (rating between 1 and 5),
  comment    text not null check (char_length(btrim(comment)) between 1 and 200),
  created_at timestamptz not null default now()
);

create index if not exists idx_feedback_created on public.feedback (created_at desc, id desc);
create index if not exists idx_feedback_user on public.feedback (user_id);

-- 저장할 별명은 서버가 프로필에서 복사한다.
-- 조회 화면은 현재 프로필을 조인해 표시한다. 별명이나 아바타 변경이 기존 글에도
-- 반영되며, 프로필을 수정할 때 피드백 전체를 다시 쓸 필요가 없다.
create or replace function public.feedback_copy_nickname()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  select p.display_name into new.nickname
  from public.profiles as p
  where p.id = new.user_id;

  if not found then
    raise foreign_key_violation using message = '피드백을 작성하려면 프로필이 필요합니다.';
  end if;

  return new;
end;
$$;

revoke all on function public.feedback_copy_nickname() from public, anon, authenticated;

drop trigger if exists feedback_set_nickname on public.feedback;
create trigger feedback_set_nickname before insert on public.feedback
for each row execute function public.feedback_copy_nickname();

alter table public.feedback enable row level security;

drop policy if exists feedback_read on public.feedback;
create policy feedback_read on public.feedback for select to anon, authenticated using (true);

drop policy if exists feedback_insert_own on public.feedback;
create policy feedback_insert_own on public.feedback for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists feedback_update_own on public.feedback;
create policy feedback_update_own on public.feedback for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists feedback_delete_own on public.feedback;
create policy feedback_delete_own on public.feedback for delete to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.feedback from public, anon, authenticated;
grant select on table public.feedback to anon, authenticated;
grant insert (rating, comment), update (rating, comment) on table public.feedback to authenticated;
grant delete on table public.feedback to authenticated;

-- 페이지 하나가 아닌, 읽을 수 있는 전체 피드백의 개수와 평균을 돌려준다.
create or replace function public.feedback_summary()
returns table (total bigint, average numeric)
language sql stable security invoker set search_path = ''
as $$
  select count(*), round(avg(f.rating), 2)
  from public.feedback as f;
$$;

revoke all on function public.feedback_summary() from public, anon, authenticated;
grant execute on function public.feedback_summary() to anon, authenticated;

notify pgrst, 'reload schema';
commit;
