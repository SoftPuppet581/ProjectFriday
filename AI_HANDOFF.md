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

## 역할 분담 (파일 소유자를 나눠서 충돌을 막는다)
**Claude Code 소유**
- `backend/` 전부, `docs/API.md`, DB, `start.bat`, `stop.bat`, `scripts/`
- `frontend/src/api/`, `frontend/src/lib/`, `frontend/test/` : 화면과 무관한 모듈(API 호출, 날짜 계산, 즐겨찾기 저장, 트레일러 판별)과 테스트. 이미 완성. **Codex는 수정하지 말고 import해서 쓴다**

**Codex 소유**
- `frontend/src/`의 나머지 전부 (main.jsx, CalendarView.jsx, ReleaseViews.jsx, calendar.js, releases.js, 새 components/ 폴더, 스타일)
- Claude 소유 모듈에 고칠 점이 있으면 코드를 고치지 말고 아래 "Codex 요청"에 적는다

같은 파일을 동시에 고치지 않는다. API가 바뀌면 docs/API.md와 테스트를 같이 갱신한다.

## Codex 할 일 (2차, 팀장 요청 5가지. 위에서부터)
팀장이 정한 방향: **① 존나 깔끔하게(미니멀) ② 메인에 트레일러 자동 재생(멋있게) ③ GTA VI는 대작이니까 메인의 주인공 ④ 뉴스 페이지 추가 ⑤ 성인 게임은 전부 제거(백엔드에서 이미 처리함, 화면 작업 없음)**

새로 쓸 수 있는 것 (Claude 소유 모듈. 수정하지 말고 import해서 쓴다):
```js
import { api } from './api/client.js';   // api.featured(), api.listNews({ limit, page, source, lang, q }), api.newsSources()
import { heroEmbedUrl, trailerInfo } from './lib/trailer.js';
```
1. **메인 히어로 = 대작 트레일러 캐러셀.** `api.featured()`가 돌려주는 대작 6개(GTA VI가 1번째)를 캐러셀 슬라이드로 쓴다. **슬라이드마다 트레일러**가 자동 재생된다 (캐러셀 규칙은 이 항목 끝에 있다). `heroEmbedUrl(game.trailerUrl)`이 null이 아니면 히어로 배경에 `<iframe allow="autoplay; encrypted-media" title="트레일러" />`로 **음소거 자동 재생·반복**한다. 화면 전체 배경처럼 cover로 깔고, 그 위에 어두운 그라데이션, 제목, 출시일, 플랫폼, "게임 정보 보기" 버튼을 얹는다.
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
3. **전체 디자인을 깔끔하게(미니멀).** 요소를 줄이고 여백을 늘린다. 지금의 다크 + 주황 포인트 하나를 유지하고, 카드 테두리, 그림자, 장식 아이콘, 배지를 줄인다. 글자 크기는 3~4단계로 통일한다. 달력 칸은 텍스트 칩 대신 썸네일 위주로 단순하게.
4. **GTA VI(대작) 표시**는 달력과 목록에서 작은 표시 하나만 (과하지 않게). 메인은 1번에서 처리.
5. **확인**: `npm run build`, 데스크톱과 모바일 폭, 브라우저 콘솔 에러 0개, 영상이 음소거로 자동 재생되는지, 뉴스 링크가 새 탭으로 열리는지.

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

## 데이터 현황 (DB에 들어 있는 것: 게임 480개, 뉴스 169건)
- 출처는 전부 RAWG. 가짜 샘플은 삭제했다. 성인 게임 12개도 삭제했다 (ESRB Adults Only, NSFW/Sexual Content 같은 태그, 선정적인 제목). GTA VI 같은 일반 대작은 남겼다
- **뉴스 169건** (오늘 가져옴): PC Gamer 49, GameSpot 30, 게임메카 30, 인벤 25, IGN 20, 루리웹 15. 한국어 70건, 영어 99건. 성인 기사는 걸러진다. 서버가 켜질 때와 요청이 올 때 마지막 수집이 30분보다 오래됐으면 뒤에서 새로 가져온다. 지금 바로 새로 가져오려면 `cd backend; npm run news:refresh`
- 월별: 2026-03/04가 각 60개 이상으로 가장 많고, 2026-11은 67개, 12월 11개. **2027년 이후는 월 10개 미만**으로 거의 없다 (RAWG에 출시 전 게임이 적다). 시연은 2026-03~2026-11 사이 달이 보기 좋다
- 상세 정보(설명, 개발사)는 인기 상위 일부 게임에만 있다. 없으면 `description: null`, `developers: []`. 화면에서 비어 있어도 깨지지 않게 한다
- `platforms`가 빈 배열인 게임이 약 50개 있다 (플랫폼 미정). 필터에는 안 잡힌다
- **트레일러(`trailerUrl`)는 메인 대작 6개에만 있다.** RAWG가 영상 데이터를 사실상 주지 않아서(GTA VI도 0개) 팀장 지시로 메이저 게임 6개의 공식 YouTube 트레일러를 직접 골라 지정했다 (`backend/db/featured.json`). 올린 채널을 확인했다: GTA VI(Rockstar Games), Wolverine(PlayStation), Gears of War: E-Day(Gears of War), Forza Horizon 6(Forza)는 제작사/퍼블리셔 공식 채널이고, RE Requiem과 007 First Light는 제작사 채널 영상을 못 찾아서 IGN이 올린 공식 트레일러다. Crimson Desert는 쓸 만한 영상이 없어 뺐다. 지정할 때 YouTube oEmbed로 퍼가기가 되는지 확인했다 (`backend/db/featured.json`, `npm run db:featured`). 나머지 게임은 `trailerUrl`이 null이고, API가 `trailerSearchUrl`(YouTube 검색 링크)을 대신 계산해 주며 `trailerInfo()`가 그걸 `kind: 'search'`로 돌려준다. 영상 플레이어 대신 "트레일러 검색" 버튼으로 표시한다
- 메인 대작 목록은 `GET /api/featured`로 받는다 (지금 6개, 순서: GTA VI, Wolverine, RE Requiem, Gears of War: E-Day, Forza Horizon 6, 007 First Light)

## 데이터 규칙
- 데이터 출처는 RAWG(rawg.io). **화면에 "Data from RAWG" 같은 출처 표시와 링크(게임의 sourceUrl)를 넣어야 한다** (RAWG 이용 조건)
- 출시일은 바뀔 수 있으므로 화면에 "출시 정보는 변경될 수 있음"을 표시한다
- AI가 기억에 의존해 게임 정보를 DB에 채우지 않는다. 데이터는 가져오기 스크립트로만 넣는다
- 이미지는 파일을 복사하지 않고 외부 링크로만 연결한다
- RAWG API 키는 backend/.env의 RAWG_API_KEY에만 둔다. 채팅, 문서, 코드, 커밋에 적지 않는다

## 현재 상태
- 백엔드 완성 (Claude): games RESTful CRUD, 확장 필드, 페이지네이션(X-Total-Count), 기간/ids/minRating 필터, 달력 요약, 비슷한 게임, .ics, 장르/플랫폼 목록, trailerSearchUrl. 자동 테스트 104개 통과 (`cd backend; npm test`)
- 팀장 요청 5가지 중 백엔드 몫 완료 (Claude): 성인 게임 필터와 삭제, 대작 고정 API(`/api/featured`)와 GTA VI 트레일러, 뉴스 수집과 API(`/api/news`, `/api/news/sources`), 재가져오기 때 직접 넣은 값이 지워지던 문제 수정. 남은 건 Codex의 화면 작업(위 "Codex 할 일 2차")
- RAWG 가져오기 실제 실행 완료. 첫 실행에서 응답 매핑이 맞는 것을 확인했다 (평점, 개발사, 스크린샷, 장르, 플랫폼 정상). 키는 backend/.env에 있다
- 프론트 비화면 모듈 완성 (Claude): api 클라이언트(featured, listNews 추가), 날짜 계산, 저장소, 트레일러 판별(heroEmbedUrl 추가). 테스트 30개 통과 (`cd frontend; npm test`)
- 프론트 화면 완성 (Codex): 실제 RAWG 데이터로 월간·주간 출시 달력, 날짜별 목록, 게임 탐색·검색, 플랫폼·장르 필터, 상세·트레일러 검색·비슷한 게임, 관심 게임·임박 표시, 두 게임 비교, .ics 파일을 제공한다
- 게임 포럼: 글과 댓글은 브라우저 localStorage에 저장한다. 여러 기기나 사용자의 게시물을 공유하려면 별도 API가 필요하다
- 프론트 검증: npm run build 및 npm test 26개 통과. 2026년 11월 API 일정 67건, 주요 UI 동작과 모바일 화면을 브라우저에서 확인했다
- 실행 스크립트 완성 (Claude): `start.bat`으로 처음부터 6초 만에 3개가 모두 켜지는 것을 확인했고, 재실행(이미 켜진 상태)과 `stop.bat`, DB를 껐다 켜도 데이터(492개)가 보존되는 것도 확인했다
- index.html(루트)은 미커밋 임시 확인용 파일 (정리 대기)

## 마지막으로 한 일
| 날짜 | 도구 | 내용 |
|------|------|------|
| 2026-11-20 | Claude Code | 레포 생성, 문서, 백엔드 CRUD, 확장 API, RAWG 가져오기(실행 완료, 약 490개), 테스트, CORS(127.0.0.1) 수정, trailerSearchUrl, 프론트 비화면 모듈 |
| 2026-11-20 | Codex | React 화면을 실제 RAWG 데이터에 연결하고 출시 달력, 탐색, 게임 상세, 비교와 로컬 포럼 구현. 빌드·테스트 및 데스크톱/모바일 브라우저 확인 |
| 2026-11-20 | Claude Code | 성인 게임 12개 삭제와 가져올 때 필터, `/api/featured`와 GTA VI 공식 트레일러 지정, 뉴스 수집/API(RSS 6곳, 169건), heroEmbedUrl, 테스트 101개/29개 |
| 2026-11-20 | Claude Code | 메인 캐러셀용 메이저 게임 5개 트레일러 추가(총 6개, 채널 확인 후 등록, 잘못된 영상 방지 검사), heroEmbedUrl 캐러셀 옵션, 테스트 104개/30개 |

## 다음 할 일
- [x] (Codex) 출시 달력과 게임 탐색·상세·비교, 포럼 UI를 로컬에서 빌드하고 확인
- [ ] (Codex) "Codex 할 일 (2차)" 1~5번: 히어로 자동 재생, 뉴스 페이지, 미니멀 디자인
- [ ] (Claude) Codex 요청이 올라오면 백엔드 수정
- [ ] (팀장) 시연 전에 `start.bat`으로 서비스를 켜고 http://127.0.0.1:5173 에서 확인한 뒤, 필요할 때 직접 push
- [ ] 임시 index.html 정리 (삭제 여부 팀장 확인)

## Codex 요청 (Codex가 백엔드/Claude 소유 모듈에 바라는 점을 여기에 적는다)
- (아직 없음)
