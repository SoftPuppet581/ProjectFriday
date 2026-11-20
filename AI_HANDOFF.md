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
- 데이터는 가짜가 아니라 RAWG API에서 가져와 DB에 저장한 실제 게임 정보다. **양은 충분하다(약 490개). 더 가져올 필요 없다**

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

## Codex 할 일 (위에서부터. 1~5가 되면 시연 가능, 6 이후는 시간이 남을 때)
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

## 데이터 현황 (DB에 들어 있는 것, 총 약 490개)
- 출처는 전부 RAWG. 가짜 샘플은 삭제했다
- 월별: 2026-03/04가 각 60개 이상으로 가장 많고, 2026-11은 67개, 12월 11개. **2027년 이후는 월 10개 미만**으로 거의 없다 (RAWG에 출시 전 게임이 적다). 시연은 2026-03~2026-11 사이 달이 보기 좋다
- 상세 정보(설명, 개발사)는 인기 상위 일부 게임에만 있다. 없으면 `description: null`, `developers: []`. 화면에서 비어 있어도 깨지지 않게 한다
- `platforms`가 빈 배열인 게임이 약 50개 있다 (플랫폼 미정). 필터에는 안 잡힌다
- **트레일러(`trailerUrl`)는 전부 null이다.** RAWG가 영상 데이터를 사실상 주지 않는다(GTA VI도 0개). 그래서 API가 `trailerSearchUrl`(YouTube 검색 링크)을 대신 계산해 주고, `trailerInfo()`가 그걸 `kind: 'search'`로 돌려준다. 영상 플레이어 대신 "트레일러 검색" 버튼으로 표시한다

## 데이터 규칙
- 데이터 출처는 RAWG(rawg.io). **화면에 "Data from RAWG" 같은 출처 표시와 링크(게임의 sourceUrl)를 넣어야 한다** (RAWG 이용 조건)
- 출시일은 바뀔 수 있으므로 화면에 "출시 정보는 변경될 수 있음"을 표시한다
- AI가 기억에 의존해 게임 정보를 DB에 채우지 않는다. 데이터는 가져오기 스크립트로만 넣는다
- 이미지는 파일을 복사하지 않고 외부 링크로만 연결한다
- RAWG API 키는 backend/.env의 RAWG_API_KEY에만 둔다. 채팅, 문서, 코드, 커밋에 적지 않는다

## 현재 상태
- 백엔드 완성 (Claude): games RESTful CRUD, 확장 필드, 페이지네이션(X-Total-Count), 기간/ids/minRating 필터, 달력 요약, 비슷한 게임, .ics, 장르/플랫폼 목록, trailerSearchUrl. 자동 테스트 80개 통과 (`cd backend; npm test`)
- RAWG 가져오기 실제 실행 완료. 첫 실행에서 응답 매핑이 맞는 것을 확인했다 (평점, 개발사, 스크린샷, 장르, 플랫폼 정상). 키는 backend/.env에 있다
- 프론트 비화면 모듈 완성 (Claude): api 클라이언트, 날짜 계산, 저장소, 트레일러 판별. 테스트 26개 통과 (`cd frontend; npm test`)
- 프론트 화면은 Codex가 만드는 중 (현재는 가짜 데이터로 된 초기 화면, API 호출 아직 없음)
- 실행 스크립트 완성 (Claude): `start.bat`으로 처음부터 6초 만에 3개가 모두 켜지는 것을 확인했고, 재실행(이미 켜진 상태)과 `stop.bat`, DB를 껐다 켜도 데이터(492개)가 보존되는 것도 확인했다
- 지금 프론트 화면은 Vite 에러 오버레이가 뜬다: `src/main.jsx`가 아직 없는 `./App.jsx`(와 styles.css)를 import한다. Codex가 만드는 중이라 그런 것으로 보이며 start.bat 문제가 아니다
- index.html(루트)은 미커밋 임시 확인용 파일 (정리 대기)

## 마지막으로 한 일
| 날짜 | 도구 | 내용 |
|------|------|------|
| 2026-11-20 | Claude Code | 레포 생성, 문서, 백엔드 CRUD, 확장 API, RAWG 가져오기(실행 완료, 약 490개), 테스트, CORS(127.0.0.1) 수정, trailerSearchUrl, 프론트 비화면 모듈 |

## 다음 할 일
- [ ] (Codex) 위 "Codex 할 일" 1~5 먼저, 그다음 6~9
- [ ] (Claude) Codex 요청이 올라오면 백엔드 수정
- [ ] (팀장) 마지막에 push, 시연 전에 MariaDB와 백엔드가 켜져 있는지 확인
- [ ] 임시 index.html 정리 (삭제 여부 팀장 확인)

## Codex 요청 (Codex가 백엔드/Claude 소유 모듈에 바라는 점을 여기에 적는다)
- (아직 없음)
