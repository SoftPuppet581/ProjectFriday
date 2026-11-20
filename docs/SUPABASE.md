# Supabase 연결 (정적 데모의 선택 기능)

Vercel 데모는 기본적으로 읽기 전용입니다. Supabase를 연결하면 **회원가입, 로그인, 프로필, 관심 게임 저장, 포럼 글쓰기/댓글/좋아요**가 실제로 저장됩니다. 게임과 뉴스는 그대로 JSON 스냅샷을 씁니다.

- 환경 변수 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 두 개가 **빌드할 때** 있으면 Supabase 모드, 없으면 기존처럼 읽기 전용 데모입니다. (`VITE_STATIC_DATA=1`은 그대로 필요합니다)
- 로컬 Express + MariaDB 흐름은 바뀌지 않습니다.

## 설정 순서
1. [supabase.com](https://supabase.com)에서 새 프로젝트를 만듭니다. (무료 플랜이면 충분합니다)
2. **Authentication → Sign In / Providers → Email**에서 **Confirm email을 끕니다.** 켜 두면 가입해도 바로 로그인되지 않아서 데모에서 가입이 실패합니다.
3. **SQL Editor → New query**에 `supabase/schema.sql` 전체를 붙여 넣고 Run합니다. (여러 번 실행해도 안전합니다)
4. 시연용 샘플 계정과 글을 넣습니다. 로컬 DB가 켜져 있어야 합니다.
   ```powershell
   cd backend
   npm run export:supabase-seed    # supabase/seed_demo.sql 이 만들어진다
   ```
   `supabase/seed_demo.sql` 내용을 SQL Editor에 붙여 넣고 Run합니다. (다시 실행하면 샘플만 지우고 다시 넣습니다. 실제 방문자의 글은 그대로입니다)
   피드백 기능을 쓰려면 `supabase/feedback.sql`도 같은 방식으로 실행합니다. (별점 1~5, 한마디 200자 이하. 읽기는 누구나, 쓰기는 로그인한 본인 이름으로만, 수정과 삭제는 본인 글만 됩니다. 별명은 서버가 프로필에서 복사하므로 위조할 수 없고, 이메일은 저장하지도 보여 주지도 않습니다)
5. **Project Settings → API**에서 두 값을 복사합니다.
   - Project URL (`https://xxxx.supabase.co`)
   - anon public key
6. Vercel → 프로젝트 → **Settings → Environment Variables**에 두 개를 추가합니다. Environment는 **Production**을 체크합니다.
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
7. 환경 변수는 빌드 때 들어가므로 **Redeploy** 해야 반영됩니다. (Deployments → 최신 배포 → Redeploy)

## 로컬에서 먼저 확인하기
`frontend/.env.static.local` 파일을 만들어 넣습니다. `.gitignore`의 `*.local`에 걸려서 커밋되지 않습니다.
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=여기에_anon_public_key
```
```powershell
cd frontend
npm run build:static
npm run preview -- --port 4173
```
(값은 위처럼 자리표시자입니다. 실제 값을 문서나 코드에 적지 마세요.)

## 키에 대해 꼭 알 것
- **anon key는 공개되어도 되는 키입니다.** 어차피 빌드된 화면 코드에 들어가서 누구나 볼 수 있습니다. 데이터는 아래 RLS 규칙이 지킵니다.
- **`service_role` 키는 절대 쓰지 않고, 어디에도 붙여 넣지 않습니다.** 이 키는 RLS를 건너뛰는 관리자 키라서 노출되면 DB 전체가 뚫립니다. 이 저장소는 공개 저장소입니다.

## 보안 규칙 (RLS) 요약
모든 테이블에 RLS를 켰습니다.
- 프로필, 포럼 글, 댓글, 좋아요: **누구나 읽기**. 쓰기는 로그인한 본인 행만.
- 프로필: 본인이 닉네임, 프로필 사진, 선호 플랫폼만 수정 가능. (`is_demo` 같은 열은 못 바꿉니다)
- 관심 게임: **본인 것만** 읽고 쓰고 지울 수 있습니다.
- 글, 댓글, 좋아요: 본인 것만 작성/삭제. 글과 댓글은 수정 기능이 없습니다.
- 비밀번호와 로그인 토큰은 Supabase Auth가 관리하고, 우리 테이블에는 없습니다.

## 한계
- 포럼 목록은 최신 글 **최대 500개**를 화면(브라우저)에서 받아 검색, 정렬, 쪽 나누기를 합니다. 실습 규모용입니다.
- 무료 플랜은 **일정 기간 쓰지 않으면 프로젝트가 일시 정지**됩니다. 시연 전에 대시보드에서 Restore 하고 동작을 확인하세요.
- 시연용 샘플 계정은 Supabase 로그인 계정이 아니라서 **로그인할 수 없습니다**. 시연하려면 직접 가입하세요.
- 가입 요청이 너무 많으면 Supabase가 잠시 막습니다. (429)
- 가격/뉴스는 여전히 저장본 기준입니다. Supabase는 사용자 데이터만 맡습니다.

## 시연이 끝나면
- Supabase 프로젝트를 지웁니다. (Project Settings → General → Delete project) 가입한 방문자의 이메일이 거기에 들어 있습니다.
- Vercel의 두 환경 변수도 지웁니다. 지우고 다시 배포하면 읽기 전용 데모로 돌아갑니다.
