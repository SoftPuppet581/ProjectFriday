# Vercel 배포 (정적 데모 버전)

Vercel은 화면(정적 파일)만 호스팅합니다. 이 프로젝트의 백엔드(Express)와 DB(MariaDB)는 Vercel에서 돌릴 수 없어서, **배포본은 저장해 둔 데이터(JSON 스냅샷)로 읽기 전용으로 동작하는 "데모 버전"**입니다. 원하면 Supabase를 연결해 회원/포럼도 저장되게 할 수 있습니다(선택, [docs/SUPABASE.md](SUPABASE.md)).

## 배포본에서 되는 것과 안 되는 것
기본(Supabase 없음) 기준입니다. Supabase를 연결하면 오른쪽 열의 회원가입, 로그인, 프로필 사진, 포럼 글쓰기/댓글/좋아요, 관심 게임 계정 저장이 됩니다. 가격/뉴스 자동 갱신은 여전히 안 됩니다.

| 되는 것 | 안 되는 것 (서버가 필요함) |
|---------|---------------------------|
| 출시 달력, 게임 탐색/검색/필터, 상세, 비교, 비슷한 게임 | 회원가입, 로그인, 프로필 사진 설정 |
| 대작 트레일러 캐러셀 (YouTube 퍼가기), 뉴스, 가격/스토어 링크 | 포럼 글쓰기, 댓글, 좋아요 |
| 포럼 읽기 (시연용 샘플 계정의 글 18개) | 관심 게임을 계정에 저장 (이 브라우저에는 저장됨) |
| 관심 게임(이 브라우저에만 저장), 구글 캘린더 추가(.ics) | 가격/뉴스 자동 갱신 (저장본 기준) |

화면에는 헤더의 "데모" 배지와 푸터의 "데모 버전 (○월 ○일 기준 저장본)" 안내가 나옵니다. 저장본의 가격과 뉴스는 시간이 지나면 낡습니다.

## 배포 방법 (GitHub 연결)
1. `main` 브랜치를 GitHub에 push합니다. (Vercel이 push마다 자동으로 빌드/배포합니다)
2. Vercel 프로젝트 설정은 **둘 중 아무거나** 됩니다. 두 곳에 `vercel.json`을 넣어 두었습니다.
   - Root Directory를 **비워 두면**(저장소 루트): 루트의 `vercel.json`이 `cd frontend`로 들어가서 빌드합니다.
   - Root Directory를 **`frontend`로 지정하면**: `frontend/vercel.json`이 쓰입니다.
3. Framework Preset은 **Other**(자동 감지에 맡겨도 `vercel.json`의 `framework: null`이 우선합니다). 환경 변수는 **기본 데모에는 필요 없습니다**. (`VITE_STATIC_DATA=1`은 `frontend/.env.static`에 이미 들어 있고 비밀 값이 아닙니다) Supabase 모드를 쓸 때만 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 Vercel 환경 변수에 추가합니다. → [docs/SUPABASE.md](SUPABASE.md)
4. 빌드 명령은 `npm run build:static`(= `vite build --mode static`), 출력 폴더는 `dist`입니다. Node 20.19 이상이 필요합니다(Vercel 기본값으로 충분).

## 데이터를 새로 반영하려면
로컬에서 DB를 갱신한 뒤 스냅샷을 다시 내보내 커밋하고 push합니다.
```powershell
cd backend
npm run prices:refresh      # 가격 (선택)
npm run news:refresh        # 뉴스 (선택)
npm run export:static       # frontend/public/data/*.json 을 새로 만든다
cd ..
git add frontend/public/data
git commit -m "Refresh static data"
git push
```

## Supabase 연결 (선택)
두 환경 변수를 빌드 때 넣으면 회원/프로필/관심 게임/포럼이 Supabase에 저장되고, 안 넣으면 위의 읽기 전용 데모 그대로입니다. 게임과 뉴스는 어느 쪽이든 JSON 스냅샷입니다. 설정 순서, 보안 규칙, 한계는 [docs/SUPABASE.md](SUPABASE.md)를 보세요.

## 공개 사이트가 되므로 알아 둘 것
- **GitHub 저장소와 배포 주소 모두 누구나 볼 수 있습니다.** 스냅샷에는 사용자 정보가 들어가지 않습니다: 사용자 테이블은 내보내지 않고, 포럼은 **시연용 샘플 계정의 글만** 내보냅니다(작성자는 닉네임과 프로필 사진 번호뿐). 이메일, 비밀번호, 토큰은 어디에도 없고 테스트로 보장합니다(`backend/test/staticExport.test.js`, `frontend/test/staticApi.test.js`).
- **포럼의 샘플 계정과 글은 가상의 시연용 데이터입니다.** 화면 아래에 "포럼의 일부 계정과 글은 시연용 샘플입니다"라고 표시됩니다. 실제 방문자가 쓴 글처럼 소개하지 않도록 주의하세요.
- 게임 정보는 RAWG 데이터이고 화면에 출처("Data from RAWG")를 표시합니다. 가격은 Steam 원화 기준 저장본, 뉴스는 각 언론사의 제목/요약/원문 링크만 보여 줍니다.
- Supabase를 연결했다면 방문자가 가입한 이메일과 쓴 글이 Supabase에 쌓입니다. anon key는 공개돼도 되지만 `service_role` 키는 절대 쓰지 마세요.
- 시연이 끝나면 Vercel 프로젝트와 GitHub 저장소(Supabase를 썼다면 Supabase 프로젝트도)를 지우는 것을 잊지 마세요. (Vercel: 프로젝트 → Settings → Delete Project)

## 로컬에서 배포본과 똑같이 확인하기
```powershell
cd frontend
npm run build:static
npm run preview -- --port 4173    # http://127.0.0.1:4173 (서버를 꺼도 동작한다)
```
Supabase 모드를 로컬에서 보려면 `frontend/.env.static.local`(gitignore됨)에 두 값을 넣고 같은 명령을 실행합니다.
