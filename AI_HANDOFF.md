# AI HandOff

팀장이 Claude Code와 Codex를 번갈아 쓸 때 서로 작업을 넘겨받는 공유 메모입니다. 팀원 보고용 [HandOff.md](HandOff.md)와는 별개입니다.

## 규칙
1. 작업 시작 전에 이 파일을 먼저 읽습니다.
2. 작업을 마치면 "현재 상태", "마지막으로 한 일", "다음 할 일"을 갱신합니다.
3. commit까지만 하고 push는 하지 않습니다. push는 팀장이 직접 합니다.
4. 비밀번호, 토큰, API 키, 개인정보는 적지 않습니다. (공개 레포)

## 프로젝트 (팀장 개인 프로젝트)
- 오늘(2026-11-20) 14~18시 바이브 코딩 실습. **진지한 프로젝트가 아니고 오늘만 넘기면 된다. 목표는 "되는 걸 보여 주는 것"이다.** 끝나면 레포 삭제 예정
- 팀원 4명은 각자 다른 개인 홈페이지를 따로 만든다. 이 문서는 팀장 프로젝트만 다룬다 (팀원은 팀장 관리 범위 밖)
- **무엇을 만드나: "게임 정보 홈페이지"**. 실제 게임 정보를 보는 사이트다
- **달력이 메인 기능**이다. 달력을 중심으로 파생 기능들을 붙인다 (예: 12월 1일 칸을 누르면 그날 출시하는 게임이 열리고, D-day, 상세로 이어진다)
- 데이터는 가짜가 아니라 RAWG API에서 가져와 DB에 저장한 실제 게임 정보다. **양은 충분하다(480개). 더 가져올 필요 없다**
- **성인 게임은 전부 제외한다 (팀장 지시).** DB에서 이미 삭제했고, 앞으로 가져올 때도 걸러진다. 성인 게임을 다시 넣거나 화면에 보여 주지 않는다
- **GTA VI는 이 사이트의 대작이다.** 메인(히어로) 캐러셀의 첫 슬라이드이고, 다른 메이저 게임 5개(Wolverine, RE Requiem, Gears of War: E-Day, Forza Horizon 6, 007 First Light)와 함께 슬라이드마다 트레일러가 메인에서 자동 재생된다
- 게임 뉴스 페이지가 있다 (RSS 6곳에서 가져온 기사 제목, 요약, 썸네일, 원문 링크)
- **회원가입/로그인과 개인 기능이 있다** (팀장 요청). 이메일+비밀번호, 로그인하면 토큰(Bearer, 14일). 관심 게임과 선호 플랫폼이 계정에 저장된다. 로그인 전에 담은 관심 게임은 로그인 때 계정에 합친다. 이메일 인증/비밀번호 재설정은 없다. 자세한 내용은 docs/API.md "회원, 로그인, 개인 기능"
  - 백엔드: `routes/users.js`, `controllers/authController.js`, `models/User.js`, `middleware/{auth,validateAuth,rateLimit}.js`, `services/passwords.js` (테이블 users, sessions, user_favorites)
- **Vercel 정적 데모 배포 (팀장 요청, 2026-11-20)**: Vercel에는 Express/MariaDB를 올릴 수 없어서, `npm run export:static`(backend)이 DB를 `frontend/public/data/*.json`으로 내보내고 `npm run build:static`(frontend)이 서버 없이 읽기 전용으로 동작하는 빌드를 만든다 (`api/staticApi.js`가 같은 규칙으로 응답하며 라이브 서버 응답과 61건 비교해 일치 확인). 포럼은 샘플 계정의 글만 내보내고 사용자 정보는 어디에도 없다. 설정은 루트 `vercel.json`과 `frontend/vercel.json`. 방법과 주의점은 **docs/DEPLOY.md**. push는 팀장이 직접 한다 (push하면 Vercel이 자동 배포)
- **프로필 사진과 서버 포럼 (팀장 요청)**: 기본 사진 + 선택용 20개(`frontend/public/avatars/`), 프로필 창(`ProfileDialog.jsx`)에서 고른다. 포럼은 브라우저 저장에서 **서버 저장**으로 바뀌어 글, 댓글, 좋아요가 계정에 연결된다 (`Forum.jsx`, `routes/forum.js`). **시연용 샘플 계정 20개**와 글 18개, 댓글 43개가 들어 있다 (`npm run seed:demo`, 지우기는 `npm run seed:demo:remove`). 샘플은 DB에 is_demo 표시가 있고 로그인할 수 없으며, 포럼 아래에 "일부 계정과 글은 시연용 샘플입니다" 안내가 있다. 자세한 내용은 docs/API.md "프로필 사진"과 "포럼"
  - 프론트: `AuthDialog.jsx`(로그인/회원가입 창), `lib/auth.js`(토큰 저장), `App.jsx`의 handleAuth/handleLogout/onFavorite, 헤더의 로그인 버튼과 닉네임, 관심 게임 화면의 로그인 안내

## 아키텍처
```
RAWG API ──(npm run import, 이미 실행함)──▶ MariaDB ◀── Express (MVC) ◀──REST/JSON── React (Vite)
```
- 언어: JavaScript 하나. Java는 쓰지 않기로 함
- DB: MariaDB. 시연 중에 외부 API를 부르지 않고, 미리 저장해 둔 데이터를 쓴다
- MVC: Model = models/Game, Controller = controllers/gameController, View = React
- 별도 DTO 계층은 만들지 않는다. 필수값 검증과 일정한 에러 JSON 형식만 한다
- 배포: Express+MariaDB는 Vercel에서 못 돌린다. 오늘은 로컬 실행으로 시연한다. 인터넷 공개는 하지 않는다
- 설치 위치: Node.js는 C:\Program Files\nodejs, MariaDB는 C:\Program Files\MariaDB 11.8 (이미 열려 있던 터미널은 PATH에 없을 수 있으니 새로 열 것)
- MariaDB는 윈도우 서비스로 등록되지 않았다. 실행: "C:\Program Files\MariaDB 11.8\bin\mariadbd.exe" --console --bind-address=127.0.0.1 --port=3306 (내 컴퓨터에서만 접속됨)
- **실행은 `start.bat` 더블클릭 한 번**: MariaDB → 백엔드(3000) → 프론트(5173) 순서로 켜고 브라우저를 연다. 이미 켜진 건 건너뛴다. 끄기는 `stop.bat`. (PowerShell 실행 정책을 건드리지 않도록 .bat이 -ExecutionPolicy Bypass로 scripts/dev-start.ps1을 실행한다)
- 개별 실행: 백엔드 `cd backend; npm run dev` (http://localhost:3000), 프론트 `cd frontend; npm run dev` (http://127.0.0.1:5173). CORS는 localhost와 127.0.0.1 둘 다 허용한다
- 테스트용 옵션: `start.bat -NoBrowser -Hidden` (브라우저 안 열고 서버 창 숨김), `scripts\dev-stop.ps1 -Only frontend,backend` (DB는 두고 일부만 끄기)
- **시연 직전에 `refresh.bat` 더블클릭**(start.bat으로 서버를 켠 뒤): 게임 뉴스와 Steam 가격을 새로 가져온다. 실패해도 이전에 저장된 데이터가 그대로 쓰이고, 어느 단계가 실패했는지 알려 준다
- 데이터 스크립트(backend에서 `npm run ...`): `import`(게임 가져오기), `enrich`(스토어 링크+가격), `details:fill`(설명/개발사), `stores:clean`(스토어 주소 추적 파라미터 정리), `news:refresh`, `prices:refresh`, `db:purge-adult`(성인 게임 삭제), `db:featured`(메인 대작 지정)

## 역할 분담 (파일 소유자를 나눠서 충돌을 막는다)
**Claude Code 소유**
- `backend/` 전부, `docs/API.md`, DB, `start.bat`, `stop.bat`, `scripts/`
- `frontend/src/api/`, `frontend/src/lib/`, `frontend/test/` : 화면과 무관한 모듈(API 호출, 날짜 계산, 즐겨찾기 저장, 트레일러 판별)과 테스트. 이미 완성. **Codex는 수정하지 말고 import해서 쓴다**

**Codex 소유**
- `frontend/src/`의 나머지 전부 (main.jsx, CalendarView.jsx, ReleaseViews.jsx, calendar.js, releases.js, 새 components/ 폴더, 스타일)
- Claude 소유 모듈에 고칠 점이 있으면 코드를 고치지 말고 아래 "Codex 요청"에 적는다

같은 파일을 동시에 고치지 않는다. API가 바뀌면 docs/API.md와 테스트를 같이 갱신한다.

## 남은 약 3시간 일정 (팀장 기준: 길게 잡아 3시간, 오늘 시연)
**UI 목표: "잘 만든 대기업 서비스" 같은 현대적인 느낌.** 구체적인 기준(토큰, 글자 크기, 컴포넌트, 금지 목록, 체크리스트)은 **`docs/DESIGN.md`**에 있다. Codex는 그 문서를 먼저 끝까지 읽는다.

| 구간 | Codex (화면) | Claude (백엔드/데이터) |
|------|--------------|-----------------------|
| 0:00~0:20 | **현재 화면 파일을 먼저 커밋**(지금 전부 추적 안 됨). `tokens.css` 만들고 Pretendard 설치, 중복 `:root` 정리 | ~~상세 설명 채우기, 스토어 링크 추적 파라미터 정리, `refresh.bat`~~ **완료** (설명 85%, 테스트 139개) |
| 0:20~1:20 | 히어로 전폭 + 상단 바 + 달력 칸(인기작 1개 크게) + 게임 카드/상세 모달을 기준서대로 | API 보강(가격/할인 필터와 정렬), 요청 오는 대로 수정 |
| 1:20~2:10 | 홈에 가로 레일("이번 주 출시", "주목할 게임"), 모바일 날짜별 목록, 상태 화면 3종 | 데이터 점검(빈 값, 날짜 이상), README |
| 2:10~2:30 | **기능 동결.** 새 기능 금지, 버그만 | 동결 |
| 2:30~3:00 | 체크리스트 점검, 1920/1440/390 스크린샷 | 시연 리허설(start.bat → refresh.bat), 커밋 정리 |
- **자르는 선**: 1:20 시점에 기준서 1~3번(토큰, 히어로, 달력)이 안 끝났으면 레일과 모바일 목록은 버린다. 있어 보이는 것은 새 기능이 아니라 **기존 화면을 일관되게 다듬는 것**이다.
- 팀장 확인 지점: 0:20(커밋됐는지), 1:20(히어로/달력 스크린샷), 2:10(동결 전 최종)

## 화면 작업 인수인계 (Codex 한도가 끝나 Claude가 화면을 맡았다. 14:40에 Codex 한도가 다시 열리면 아래 "남은 것"부터 이어서)
**Claude가 한 것 (2026-11-20 오후)**
- Codex가 만든 화면 파일을 **먼저 전부 커밋**했다 (그전에는 추적되지 않았음)
- `frontend/src/tokens.css`(디자인 토큰, `docs/DESIGN.md`와 같은 값)와 `theme.css`(마지막에 import되는 테마 레이어)를 추가했다. theme.css가 **기존 변수(--surface 등)를 새 토큰에 연결**해서 색을 한 곳에서 바꿀 수 있고, 아래 컴포넌트를 덮어쓴다: 상단 바(블러 + 알약 메뉴/검색), 버튼/입력/칩(알약), **전폭 히어로**(좌우 끝까지, 그라데이션, 진행 컨트롤), 달력 칸(인기작 1개 16:9로 크게), 게임 카드, 상세 창(모서리 20px, 제목 자간 보정), 가격 블록
- Pretendard 글꼴 적용 (`npm i pretendard`, 오프라인 동작)
- 홈에 **가로 레일 3개** 추가: `HomeRails.jsx` (이번 주 출시, 평점 높은 게임, 최신 게임 뉴스). 순서는 히어로 → 이번 주 출시 → 달력 → 평점 높은 게임 → 뉴스
- 확인: 빌드 통과, 프론트 모듈 테스트 통과, 1280폭에서 레일 3개가 실제 데이터로 나오고 가로 넘침 없음, 새 콘솔 에러 없음. 이 PC의 브라우저 창이 작아서 **캡처 해상도가 낮아 눈으로 세밀하게는 못 봤다.** 측정값(크기, 글꼴, 개수)으로만 확인했다
- 모바일은 팀장 지시로 건드리지 않았다 (Codex가 만든 날짜별 목록은 그대로)
- **로그인/회원가입 구현 완료 (Claude)**: 백엔드 테스트 166개, 프론트 모듈 테스트 49개 통과. 브라우저에서 가입 → 비로그인 때 담은 관심 게임 2개가 계정으로 합쳐짐 → 새로고침해도 로그인 유지 → 관심 해제가 서버에 저장 → 로그아웃(서버에서 토큰 무효) → 틀린 비밀번호 메시지 → 재로그인 시 관심 게임 복원까지 끝까지 확인했다. 확인용 테스트 계정은 삭제했다 (DB의 users/sessions/user_favorites는 비어 있다)

**남은 것 (Codex가 이어서. 진지한 프로젝트가 아니라서 선택 사항)**
- `styles.css`, `cinema.css`, `explore.css`, `news.css`의 흩어진 `#hex` 색을 `var(--...)` 토큰으로 바꾸고, 그 파일들의 `:root` 중복 정의를 지운 뒤 theme.css의 "기존 변수 → 새 토큰 연결" 블록을 없앤다 (지금은 theme.css가 덮어써서 동작은 같다)
- 상세 창을 2단(왼쪽 설명/스크린샷, 오른쪽 가격/스토어 패널 sticky)으로
- 히어로 인디케이터를 12초 채워지는 얇은 진행 바로
- 1440, 1920 폭에서 **큰 화면으로** 눈으로 점검 (이 PC에서는 캡처가 작았다)

## Codex 할 일 (2차, 팀장 요청 5가지. 위에서부터)
팀장이 정한 방향: **① 존나 깔끔하게(미니멀) ② 메인에 트레일러 자동 재생(멋있게) ③ GTA VI는 대작이니까 메인의 주인공 ④ 뉴스 페이지 추가 ⑤ 성인 게임은 전부 제거(백엔드에서 이미 처리함, 화면 작업 없음)**

새로 쓸 수 있는 것 (Claude 소유 모듈. 수정하지 말고 import해서 쓴다):
```js
import { api } from './api/client.js';   // api.featured(), api.listNews({ limit, page, source, lang, q }), api.newsSources()
import { heroEmbedUrl, trailerInfo } from './lib/trailer.js';
import { formatPrice, storeLinks, steamClientLink, newsSearchLink } from './lib/stores.js';   // 가격 표시, 스토어/뉴스 링크
```
1. **메인 히어로 = 대작 트레일러 캐러셀.** `api.featured()`가 돌려주는 대작 6개(GTA VI가 1번째)를 캐러셀 슬라이드로 쓴다. **슬라이드마다 트레일러**가 자동 재생된다 (캐러셀 규칙은 이 항목 끝에 있다). `heroEmbedUrl(game.trailerUrl, { loop: false })`가 null이 아니면 히어로 배경에 `<iframe allow="autoplay; encrypted-media" title="트레일러" />`로 **음소거 자동 재생**한다. 화면 전체 배경처럼 cover로 깔고, 그 위에 어두운 그라데이션, 제목, 출시일, 플랫폼, "게임 정보 보기" 버튼을 얹는다.
   - 영상이 로드되기 전, 실패, 없을 때는 `coverImageUrl` 이미지를 보여 준다 (깜빡이거나 검은 화면이 되면 안 됨)
   - `prefers-reduced-motion`이면 영상 대신 이미지. 모바일(좁은 폭)도 데이터 절약을 위해 이미지로 해도 된다
   - iframe에 `pointer-events: none`을 줘서 영상이 클릭을 가로채지 않게 한다
   - 소리 켜기/끄기 버튼은 선택. 자동 재생은 음소거여야만 브라우저가 허용한다
   - featured가 비어 있거나 영상이 없는 게임이면 이미지 히어로. featured 자체가 없으면 기존 방식(인기작)
   - **캐러셀 규칙**
     - **현재 보이는 슬라이드의 iframe만 마운트한다.** 6개를 동시에 재생하면 느려지고 네트워크를 낭비한다. 넘어가면 이전 iframe은 제거한다
     - 자동 넘김은 약 12초 간격(영상 끝을 감지하려면 YouTube IFrame API가 필요해서 타이머가 단순하다). `heroEmbedUrl(url, { loop: false })`로 반복 재생을 끈다
     - 화살표 버튼, 하단 점(현재 위치), 좌우 방향키, 터치 스와이프. 마우스를 올리거나 키보드 포커스가 있으면 자동 넘김을 멈춘다
     - 탭이 안 보일 때(`document.hidden`)는 자동 넘김과 재생을 멈춘다
     - 슬라이드 전환 시 다음 슬라이드의 `coverImageUrl`을 미리 불러 두고, 영상이 시작될 때까지 이미지를 보여 준다 (검은 화면 금지)
     - 슬라이드마다 제목, 출시일, 플랫폼, "게임 정보 보기"를 보여 준다. 트레일러를 올린 채널 이름은 화면에 쓰지 않아도 된다
     - `prefers-reduced-motion`이면 자동 넘김과 영상을 끄고 이미지 슬라이드만 수동으로 넘긴다
     - 영상이 YouTube 쪽 사정으로 안 나올 수도 있다(삭제, 지역 제한). 이미지로 대체되면 충분하다
2. **뉴스 페이지.** 상단 메뉴에 "뉴스" 추가. `api.listNews`로 카드 목록(썸네일, 제목, 요약, 매체, 시간). 한국어/English 탭(`lang`), 매체 필터(`api.newsSources()`), 검색(`q`), "더 보기"(`page`).
   - 카드 클릭은 원문 링크를 **새 탭**(`target="_blank" rel="noopener noreferrer"`)으로
   - **썸네일이 없는 기사가 있다(루리웹 15건 전부).** 이미지 없는 카드 디자인을 따로 만든다
   - 하단에 "기사 출처는 각 언론사입니다. 제목과 요약만 보여 주며 원문은 해당 사이트에서 확인하세요." 문구
   - 게임 상세 화면에 `api.listNews({ q: game.title, limit: 5 })`로 "관련 뉴스"를 넣는다. 결과가 없으면 영역을 숨긴다
3. **비주얼 디렉션: 깔끔한데 "있어 보이게" (시네마틱 다크).** 팀장 말: UI를 많이 손봐야 하고, 오늘 시연에서 있어 보이기만 하면 된다. 기준은 "게임 스토어 + 영화 개봉 캘린더". 지금 화면은 뼈대는 좋지만 달력 칸이 텍스트 칩 위주라 허전하고 정보가 빽빽하다. 아래를 지킨다.
   - **레이아웃**: 콘텐츠 최대 폭 1200~1320px, 간격은 8px 단위, 섹션 사이 여백을 크게. 한 화면에 요소 수를 줄인다
   - **색**: 배경 #0b0d12 계열, 표면은 두 단계, 포인트는 지금의 주황 하나. CSS 변수(디자인 토큰)로 정의해서 흩어진 색을 없앤다. 글자 대비는 읽기 편하게
   - **타이포**: 제목은 굵고 크게(`clamp()`로 반응형), 본문 15~16px, 숫자는 `tabular-nums`. 글자 크기 단계는 5개 이하
   - **이미지가 주인공**: 포스터/표지 중심 카드, `aspect-ratio` 고정, 이미지가 뜨기 전에 반짝이는 스켈레톤, 이미지가 없는 게임은 그라데이션 + 제목 이니셜 카드
   - **달력 칸**: 텍스트 칩 대신 인기작 표지 썸네일 1~3개 + `+N`. 출시가 몰리는 날은 칸 배경에 은은한 글로우. 빈 날은 조용하게
   - **모션**: 카드 hover 시 살짝 확대와 그림자, 월 전환과 슬라이드 전환은 200~300ms 페이드/슬라이드, 히어로는 크로스페이드. `prefers-reduced-motion`이면 끈다
   - **내비게이션**: 스크롤하면 블러가 들어가는 상단 고정 바(은은하게), 현재 메뉴 강조
   - **글래스/블러/그라데이션은 히어로와 내비게이션에만.** 카드마다 쓰면 지저분해진다. 장식 아이콘, 두꺼운 테두리, 배지 남발은 금지
   - **상세 화면**: 큰 배너(배경 이미지 + 그라데이션), 스크린샷 갤러리(클릭하면 확대되는 라이트박스), 평점 원형 게이지, 메타크리틱 배지, 플랫폼 칩, 가격(4번), 비슷한 게임 가로 슬라이드
   - **상태 화면 3종도 디자인**: 로딩(스켈레톤), 빈 결과, 서버 꺼짐(`ApiError.status === 0`)
   - 완성 기준: 스크린샷을 찍었을 때 "있어 보이는가". 데스크톱 1280, 1920, 모바일 390 폭에서 모두 확인
4. **가격과 바로 가기 링크 (게임 상세 + 카드/목록 + 비교 화면).**
   ```js
   import { formatPrice, storeLinks, steamClientLink, newsSearchLink } from './lib/stores.js';
   ```
   - **가격**: `formatPrice(game.price)` → `{ kind, text, originalText, discountText }`. kind는 `paid`(정가) | `sale`(현재가 + 취소선 원가 + `-30%` 배지) | `free`(무료) | `unknown`(가격 미정). 카드/목록에는 작게, 상세에는 크게. **`unknown`(가격 미정)을 숨기지 말고 회색으로 보여 준다.** 콘솔 전용이거나 출시 전인 게임이 많다
   - 가격 아래 작은 글씨로 "Steam 원화 기준 · 변동될 수 있음"과 기준 시각(`game.price.updatedAt`, UTC)
   - **스토어 버튼**: `storeLinks(game)` → `[{ key, label, url, kind }]`. 전부 새 탭(`target="_blank" rel="noopener noreferrer"`). Steam이 있으면 주 버튼, `kind: 'search'`("Steam에서 검색")는 보조 스타일. PlayStation Store 등 다른 스토어도 같은 줄에
   - **"Steam 앱으로 열기"**: `steamClientLink(game)`이 null이 아니면 보조 링크로 (`steam://` 주소라 Steam 앱이 설치된 PC에서만 열린다)
   - **뉴스 바로 가기**: `newsSearchLink(game)`(네이버 뉴스 검색 결과로 이동) 보조 링크. 사이트 안 뉴스는 `api.listNews({ q: game.title, limit: 5 })`
   - 가격으로 정렬/필터는 아직 API에 없다. 필요하면 "Codex 요청"에 적는다
5. **GTA VI(대작) 표시**는 달력과 목록에서 작은 표시 하나만 (과하지 않게). 메인은 1번에서 처리. 참고: RAWG가 주는 GTA VI 출시일(11월 19일)이 이미 지났으니 "D-N" 대신 날짜만 쓰거나 "출시일 정보는 변경될 수 있음"을 곁들인다
6. **확인**: `npm run build`, 데스크톱과 모바일 폭, 브라우저 콘솔 에러 0개, 영상이 음소거로 자동 재생되는지, 뉴스와 스토어 링크가 새 탭으로 열리는지.

---
## [완료] Codex 1차 할 일 (참고용)
시작 전에 docs/API.md를 읽는다. 아래 모듈을 가져다 쓴다.
```js
import { api } from './api/client.js';      // api.calendar, listGames, getGame, similarGames, genres, platforms, icsUrl
import { dDay, weekRange, monthRange, shiftMonth } from './lib/dates.js';
import { loadFavorites, saveFavorites, toggleFavorite, loadPlatform, savePlatform } from './lib/storage.js';
import { trailerInfo } from './lib/trailer.js';
```
1. **가짜 데이터(releases.js)를 실제 API로 교체**: `api.calendar({ month })`로 달력을 그린다. 처음 여는 달은 데이터가 있는 달이어야 한다 (아래 "데이터 현황" 참고)
2. **날짜 칸 클릭 → 그날 출시작 목록**: `api.listGames({ from: 날짜, to: 날짜, sort: '-popularity', limit: 200 })`
3. **게임 상세**: `api.getGame(id)` + `api.similarGames(id)`. 트레일러는 `trailerInfo(game)`의 kind에 따라 video/iframe/링크로 표시. 출처 링크는 `sourceUrl`
4. **플랫폼/장르 필터**: 선택지는 `api.platforms()`, `api.genres()`, 적용은 `platform`/`genre` 파라미터
5. **푸터에 "Data from RAWG" 링크와 "출시 정보는 변경될 수 있음" 문구** (RAWG 이용 조건)
6. D-day 배지(`dDay`), 표지 썸네일 달력(`calendar`의 `games[].coverImageUrl`, 남은 수는 `count - games.length`), 평점 높은 대작 강조
7. 주간/월간 전환(`weekRange`), "이번 주 출시" 요약 띠
8. 검색 → 달력 점프, 관심 게임 별표(`storage.js`), 내 플랫폼만 보기, 임박 배너
9. 구글 캘린더 추가 링크(`api.icsUrl(id)`), 출시 몰림 히트맵, 두 게임 비교(`ids=1,2`)

## 데이터 현황 (DB에 들어 있는 것: 게임 479개, 뉴스 173건)
- 출처는 전부 RAWG. 가짜 샘플은 삭제했다. 성인 게임 12개도 삭제했다 (ESRB Adults Only, NSFW/Sexual Content 같은 태그, 선정적인 제목). GTA VI 같은 일반 대작은 남겼다
- **뉴스 169건** (오늘 가져옴): PC Gamer 49, GameSpot 30, 게임메카 30, 인벤 25, IGN 20, 루리웹 15. 한국어 70건, 영어 99건. 성인 기사는 걸러진다. 서버가 켜질 때와 요청이 올 때 마지막 수집이 30분보다 오래됐으면 뒤에서 새로 가져온다. 지금 바로 새로 가져오려면 `cd backend; npm run news:refresh`
- 월별: 2026-03/04가 각 60개 이상으로 가장 많고, 2026-11은 67개, 12월 11개. **2027년 이후는 월 10개 미만**으로 거의 없다 (RAWG에 출시 전 게임이 적다). 시연은 2026-03~2026-11 사이 달이 보기 좋다
- 상세 정보는 **479개 중 406개(85%)에 설명이 있다** (오늘 `npm run details:fill`로 채움). 개발사는 309개. 나머지(설명 73개, 개발사 170개)는 RAWG에도 없어서 `description: null`, `developers: []`다. 화면에서 비어 있어도 깨지지 않게 한다. 설명은 RAWG가 주는 **영어**다
- `platforms`가 빈 배열인 게임이 약 50개 있다 (플랫폼 미정). 필터에는 안 잡힌다
- **트레일러(`trailerUrl`)는 메인 대작 6개에만 있다.** RAWG가 영상 데이터를 사실상 주지 않아서(GTA VI도 0개) 팀장 지시로 메이저 게임 6개의 공식 YouTube 트레일러를 직접 골라 지정했다 (`backend/db/featured.json`). 올린 채널을 확인했다: GTA VI(Rockstar Games), Wolverine(PlayStation), Gears of War: E-Day(Gears of War), Forza Horizon 6(Forza)는 제작사/퍼블리셔 공식 채널이고, RE Requiem과 007 First Light는 제작사 채널 영상을 못 찾아서 IGN이 올린 공식 트레일러다. Crimson Desert는 쓸 만한 영상이 없어 뺐다. 지정할 때 YouTube oEmbed로 퍼가기가 되는지 확인했다 (`backend/db/featured.json`, `npm run db:featured`). 나머지 게임은 `trailerUrl`이 null이고, API가 `trailerSearchUrl`(YouTube 검색 링크)을 대신 계산해 주며 `trailerInfo()`가 그걸 `kind: 'search'`로 돌려준다. 영상 플레이어 대신 "트레일러 검색" 버튼으로 표시한다
- 메인 대작 목록은 `GET /api/featured`로 받는다 (지금 6개, 순서: GTA VI, Wolverine, RE Requiem, Gears of War: E-Day, Forza Horizon 6, 007 First Light)
- **스토어 링크와 가격**: 스토어 링크는 340개 게임에 있다 (Steam 225개, 그 외 PlayStation Store, Epic 등). 가격은 Steam 원화 기준 **216개**: 정가 또는 할인 212개(할인 중 25개 포함), 무료 4개. 나머지는 `price: null`("가격 미정")이다. 이유는 콘솔 전용(GTA VI, Wolverine, Forza Horizon 6), 출시 전이라 가격 미공개, Steam 미등록(Path of Exile 2)이다. 가격은 2026-11-20 오전(UTC 04:06) 기준이고 계속 바뀐다. **시연 직전에 `cd backend; npm run prices:refresh`**(약 30초)를 한 번 돌린다. 새 게임을 가져왔다면 `npm run enrich`(스토어 링크 + 가격). 스토어 링크는 RAWG, 가격은 Steam의 공개 조회를 쓰며, 공식 문서가 있는 API가 아니라서 응답이 바뀌면 가격이 비어 보일 수 있다
- 게임마다 계산해서 주는 바로 가기 링크: `steamStoreUrl`(Steam 상품 페이지), `steamClientUrl`(Steam 앱으로 열기), `steamSearchUrl`(Steam 검색), `newsSearchUrl`(네이버 뉴스 검색), `trailerSearchUrl`(YouTube 검색)

## 데이터 규칙
- 데이터 출처는 RAWG(rawg.io). **화면에 "Data from RAWG" 같은 출처 표시와 링크(게임의 sourceUrl)를 넣어야 한다** (RAWG 이용 조건)
- 출시일은 바뀔 수 있으므로 화면에 "출시 정보는 변경될 수 있음"을 표시한다
- AI가 기억에 의존해 게임 정보를 DB에 채우지 않는다. 데이터는 가져오기 스크립트로만 넣는다
- 이미지는 파일을 복사하지 않고 외부 링크로만 연결한다
- RAWG API 키는 backend/.env의 RAWG_API_KEY에만 둔다. 채팅, 문서, 코드, 커밋에 적지 않는다

## 현재 상태
- 백엔드 완성 (Claude): games RESTful CRUD, 확장 필드, 페이지네이션(X-Total-Count), 기간/ids/minRating 필터, 달력 요약, 비슷한 게임, .ics, 장르/플랫폼 목록, trailerSearchUrl. 자동 테스트 128개 통과 (`cd backend; npm test`)
- 팀장 요청 5가지 중 백엔드 몫 완료 (Claude): 성인 게임 필터와 삭제, 대작 고정 API(`/api/featured`)와 GTA VI 트레일러, 뉴스 수집과 API(`/api/news`, `/api/news/sources`), 재가져오기 때 직접 넣은 값이 지워지던 문제 수정
- RAWG 가져오기 실제 실행 완료. 첫 실행에서 응답 매핑이 맞는 것을 확인했다 (평점, 개발사, 스크린샷, 장르, 플랫폼 정상). 키는 backend/.env에 있다
- 프론트 비화면 모듈 완성 (Claude): api 클라이언트(featured, listNews 추가), 날짜 계산, 저장소, 트레일러 판별(heroEmbedUrl 추가). 테스트 40개 통과 (`cd frontend; npm test`)
- 프론트 화면 완성 (Codex): 실제 RAWG 데이터로 월간·주간 출시 달력, 날짜별 목록, 게임 탐색·검색, 플랫폼·장르 필터, 상세·트레일러 검색·비슷한 게임, 관심 게임·임박 표시, 두 게임 비교, .ics 파일을 제공한다
- 프론트 2차 화면 완성 (Codex): GTA VI가 먼저 나오는 공식 트레일러 6개 캐러셀, 뉴스 목록·필터·더 보기·게임 상세 관련 뉴스, 미니멀 테마와 썸네일 달력
- 비주얼·가격 후속 작업 (Codex): 시네마틱 다크, 고정 내비게이션, 표지 스켈레톤, 스크린샷 라이트박스, 상세 평점·비슷한 게임 가로 스크롤, 상세·카드·목록·비교의 Steam 가격과 바로 가기 링크
- 캐러셀은 모바일에서도 현재 영상 iframe 하나를 마운트하고, 재생이 차단되면 표지를 유지한다. 1280px·1920px·390px 스크린샷 및 음소거 자동 재생을 확인했다
- 점검 반영 (Codex): 캐러셀 입력을 시작한 게임의 상세를 열고, 숨김 상태에서 시작해도 포커스 또는 페이지 복귀 시 재생을 재확인한다. 모바일은 날짜별 목록으로 표시한다. 가격 미정 사유를 구분하고 PC 플랫폼이 없는 게임은 Steam 검색 링크를 숨긴다. 렌더링 오류 후 재시도 화면을 추가했다
- 게임 포럼: 글과 댓글은 브라우저 localStorage에 저장한다. 여러 기기나 사용자의 게시물을 공유하려면 별도 API가 필요하다
- 프론트 검증: npm run build 및 npm test 40개 통과. 데스크톱에서 공식 YouTube 영상 6개 재생, iframe 1개 유지, 새 탭 원문 열기와 브라우저 앱 콘솔 오류 0개를 확인했다. 모바일에서 스와이프·정지 모드·화면 폭을 확인했다
- 실행 스크립트 완성 (Claude): `start.bat`으로 처음부터 6초 만에 3개가 모두 켜지는 것을 확인했고, 재실행(이미 켜진 상태)과 `stop.bat`, DB를 껐다 켜도 데이터(492개)가 보존되는 것도 확인했다
- index.html(루트)은 미커밋 임시 확인용 파일 (정리 대기)

## 마지막으로 한 일
| 날짜 | 도구 | 내용 |
|------|------|------|
| 2026-11-20 | Claude Code | 레포 생성, 문서, 백엔드 CRUD, 확장 API, RAWG 가져오기(실행 완료, 약 490개), 테스트, CORS(127.0.0.1) 수정, trailerSearchUrl, 프론트 비화면 모듈 |
| 2026-11-20 | Codex | React 화면을 실제 RAWG 데이터에 연결하고 출시 달력, 탐색, 게임 상세, 비교와 로컬 포럼 구현. 빌드·테스트 및 데스크톱/모바일 브라우저 확인 |
| 2026-11-20 | Claude Code | 성인 게임 12개 삭제와 가져올 때 필터, `/api/featured`와 GTA VI 공식 트레일러 지정, 뉴스 수집/API(RSS 6곳, 169건), heroEmbedUrl, 테스트 101개/29개 |
| 2026-11-20 | Claude Code | 메인 캐러셀용 메이저 게임 5개 트레일러 추가(총 6개, 채널 확인 후 등록, 잘못된 영상 방지 검사), heroEmbedUrl 캐러셀 옵션, 테스트 104개/30개 |
| 2026-11-20 | Claude Code | 스토어 링크(340개)와 Steam 원화 가격(216개, 무료 4개 구분) 수집, Steam/뉴스 검색 바로 가기 링크, `price`/`stores` 필드, lib/stores.js, 테스트 128개/40개 |
| 2026-11-20 | Codex | 대작 트레일러 캐러셀, 뉴스 페이지·관련 뉴스, 미니멀 테마와 달력 썸네일. 데스크톱·모바일 확인 |
| 2026-11-20 | Codex | 시네마틱 UI, 가격과 스토어·뉴스 바로 가기, 모바일 포함 iframe 재생, 1280/1920/390px 스크린샷 |
| 2026-11-20 | Codex | 프론트 화면 추적용 기준 커밋과 점검 후속 커밋, 모바일 날짜별 목록, 가격 사유, 캐러셀 입력·가시성 수정, ErrorBoundary |

## 다음 할 일
- [x] (Codex) 출시 달력과 게임 탐색·상세·비교, 포럼 UI를 로컬에서 빌드하고 확인
- [x] (Codex) 2차 화면: 트레일러 캐러셀, 뉴스 페이지, 미니멀 디자인과 GTA VI 표시, 브라우저 확인
- [x] (Codex) 비주얼 디렉션과 게임 가격·바로 가기 반영, 데스크톱·모바일 스크린샷 확인
- [x] (Codex) 점검 후속 개선 2~6번, 데스크톱 1280/1920px·모바일 390px 확인
- [ ] 원본 저장소의 Git 잠금 파일 쓰기가 거부됨. 별도 사본의 기준·후속 커밋은 codex/frontend-review 번들로 보존
- [ ] (Claude) Codex 요청이 올라오면 백엔드 수정
- [ ] (팀장) 시연 전에 `start.bat`으로 서비스를 켜고 http://127.0.0.1:5173 에서 확인한 뒤, 필요할 때 직접 push
- [ ] 임시 index.html 정리 (삭제 여부 팀장 확인)

## Codex 요청 (Codex가 백엔드/Claude 소유 모듈에 바라는 점을 여기에 적는다)
- (아직 없음)

## 2026-11-20 Supabase 선택 모드 (정적 데모)
- 목적: Vercel 정적 데모에서 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`가 빌드 때 있으면 회원/프로필/관심 게임/포럼만 Supabase로 읽고 쓴다. 게임/뉴스는 JSON 스냅샷 그대로. 환경 변수가 없으면 기존 읽기 전용 데모. 로컬 Express+MariaDB 흐름은 변경 없음
- `supabase/schema.sql`: profiles, user_favorites, forum_posts, forum_comments, forum_likes 테이블, 가입 시 프로필 자동 생성 트리거, RLS(읽기는 누구나, 쓰기/삭제는 본인 행만). SQL Editor에서 실행
- `backend/scripts/exportSupabaseSeed.js` (`npm run export:supabase-seed`): 시연용 샘플 계정 20개와 글/댓글/좋아요를 `supabase/seed_demo.sql`로 만든다. 샘플 계정은 로그인 불가
- `frontend/src/api/supabaseApi.js`: `createSupabaseApi({ url, anonKey, base })`. 응답 모양은 `api/client.js`의 `api`와 같다. 포럼 목록은 최대 500개를 받아 클라이언트에서 처리
- `client.js`, App, Forum 연결(Supabase 모드 선택, 읽기 전용 표시 해제 등)은 Claude가 이 변경 안에서 함께 처리한다
- 문서: `docs/SUPABASE.md` 신규, `docs/DEPLOY.md` 갱신, `.gitignore`에 `*.local` 추가(`frontend/.env.static.local`용)
- 주의: anon key만 쓴다(공개 가능). service_role 키는 절대 쓰지 않는다. 시연 후 Supabase 프로젝트 삭제

## Codex 할 일 (3차: 피드백, 팀장 요청. Codex가 구현한다)
팀장 요청 원문 요약: "로그인한 사람만 피드백을 남기게. Supabase Auth 이메일+비밀번호, 가입 때 별명. feedback 표(별점 1~5, 한마디 200자 이하, 쓴 사람, 별명, 시각) SQL을 먼저 보여 주기(팀장이 SQL Editor에서 직접 실행). RLS: 읽기 누구나, 쓰기는 로그인한 본인 이름으로만, 수정/삭제는 본인 글만. 화면에는 이메일 대신 별명만. 이메일과 별명 외 개인정보는 받지 않는다. secret/service_role 키는 쓰지 않는다. 다 되면 GitHub에."

이미 되어 있는 것 (다시 만들지 말고 재사용): 회원가입(이메일, 비밀번호, 별명), 로그인, 로그아웃, 프로필 사진/관심 게임/포럼, RLS 패턴 -> `supabase/schema.sql`, `frontend/src/api/supabaseApi.js`(PostgREST/GoTrue를 fetch로 직접 호출, `createSupabaseApi`), `frontend/src/api/client.js`(hasSupabase), `frontend/src/AuthDialog.jsx`, `frontend/src/App.jsx`(user 상태), `docs/SUPABASE.md`. 프로젝트 주소와 publishable key는 이미 `frontend/.env.static`에 들어 있다(공개 값). 새로 키를 요구하거나 쓰지 말 것.

해야 할 것 (이 순서):
1. **`supabase/feedback.sql` 작성** (여러 번 실행해도 안전하게, schema.sql 스타일). 먼저 이 파일 내용을 팀장에게 보여 주고 실행을 기다린다 (Codex는 DB에 직접 실행하지 못한다).
   - `public.feedback`: id bigint identity PK, user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade, nickname text not null (1~40자), rating smallint not null check 1~5, comment text not null check 1~200자(btrim 후), created_at timestamptz default now(). 인덱스: created_at desc, user_id.
   - 별명(nickname)은 클라이언트가 보내는 값을 믿지 않는다: BEFORE INSERT 트리거로 profiles.display_name을 복사해 넣는다 (위조 방지). 닉네임을 바꾸면 기존 글에도 반영하려면 profiles 변경 트리거를 추가하거나, 조회 때 profiles를 조인하는 방식 중 하나를 골라 이유를 주석으로 적는다.
   - RLS enable. 정책: select 누구나(using true), insert는 with check (auth.uid() = user_id), update/delete는 using/with check (auth.uid() = user_id). anon/authenticated 권한은 schema.sql처럼 revoke all 후 필요한 것만 grant (update는 rating, comment 열만). email 같은 개인정보 컬럼은 만들지 않는다.
2. **API**: `supabaseApi.js`에 `listFeedback({ limit, page })` (최신순, { items, total, average }), `createFeedback({ rating, comment })`, `updateFeedback(id, { rating?, comment? })`, `deleteFeedback(id)` 추가. 입력 검증(별점 정수 1~5, 한마디 1~200자 글자 수는 [...text].length)을 ApiError(400, errors:[{field,message}])로. 응답은 `{ id, rating, comment, author: { id, displayName, avatar }, createdAt, mine }` (이메일은 절대 포함하지 않는다). 1인 1개로 제한할지는 정하지 말고(여러 개 허용) 그대로 둔다.
3. **화면**: 새 `frontend/src/Feedback.jsx` + 메뉴(App.jsx의 navigation)에 "피드백" 추가. 목록(별명, 프로필 사진, 별점, 한마디, 시각, 평균 별점), 로그인한 사람만 작성 폼(별점 1~5 선택, 한마디 200자 카운터), 내 글에만 수정/삭제 버튼, 비로그인은 "로그인해야 남길 수 있어요" + 로그인 버튼(onLogin). `hasSupabase`가 아니면(읽기 전용 데모/로컬 Express) 이 메뉴를 숨기거나 안내만 보여 준다. 기존 포럼 화면의 스타일 클래스를 최대한 재사용하고 모바일(375px)에서 가로 스크롤이 생기지 않게 한다.
4. **테스트**: `frontend/test/supabaseApi.test.js` 스타일로 피드백 API 테스트 추가(가짜 fetch). `cd frontend && npm test` 전부 통과, `npm run build:static` 성공.
5. **문서**: `docs/SUPABASE.md`에 feedback.sql 실행 단계 추가, 이 파일 맨 끝 "마지막으로 한 일"에 기록.
6. **commit까지만** (CLAUDE.md 규칙: push는 하지 않는다. 팀장이 요청하면 Claude가 push한다). 비밀번호/토큰/개인정보를 파일이나 로그에 적지 않는다. root의 index.html은 건드리지 않는다.

SQL 실행 후 실서버 검증 (팀장이 feedback.sql을 실행했다고 알려 주면): 가짜 계정으로 가입 -> 피드백 작성/수정/삭제, 남의 글 수정/삭제가 막히는지, 비로그인 작성이 막히는지 확인하는 스크립트를 임시 폴더에서 돌린다 (테스트 계정 이메일은 @example.com, 비밀번호는 무작위로 만들어 출력하지 않는다).

### 2026-11-20 피드백 기능 완료 (Claude가 마무리. Codex는 한도 문제로 SQL까지만 작성)
- supabase/feedback.sql(Codex 작성, 실서버 적용됨), frontend/src/Feedback.jsx, supabaseApi.js의 listFeedback/createFeedback/updateFeedback/deleteFeedback, 메뉴 '피드백'(Supabase 연결 시에만 표시).
- 실서버 검증: 비로그인 작성 차단, 남의 글 수정/삭제 차단(404), 별명/user_id 위조 차단(403), 별점 6과 201자 거절, 응답에 이메일 없음.

