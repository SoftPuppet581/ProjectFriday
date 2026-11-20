# API 명세 (프론트엔드 담당 Codex용)

만드는 것: **달력이 중심인 게임 정보 홈페이지**. 실제 게임 데이터는 RAWG에서 미리 가져와 DB에 저장되어 있고, 프론트는 이 API만 호출합니다.
백엔드는 `http://localhost:3000`에서 실행됩니다. 요청과 응답은 모두 JSON입니다 (`.ics` 제외).
CORS는 `http://localhost:5173`과 `http://127.0.0.1:5173` 둘 다 허용합니다. 다른 주소를 쓰면 `backend/.env`의 `CORS_ORIGIN`에 쉼표로 추가해야 합니다.
API 호출은 `frontend/src/api/client.js`의 `api`를 쓰세요. 주소와 에러 처리가 이미 되어 있습니다.

## 실행 방법
- **레포 맨 위의 `start.bat`을 실행**하면 MariaDB, 백엔드, 프론트가 차례로 켜집니다. 끄기는 `stop.bat`입니다.
- 개별로 켜려면: 백엔드 `cd backend` 후 `npm run dev` (Node는 `C:\Program Files\nodejs`), 프론트 `cd frontend` 후 `npm run dev`
- `backend/.env`는 레포에 없습니다. `backend/.env.example`을 복사해서 채웁니다. (이 PC에는 이미 있음)

## Game 객체
```json
{
  "id": 1,
  "title": "게임 이름",
  "releaseDate": "2026-12-01",
  "platforms": ["PC", "PlayStation 5"],
  "genre": "Action",
  "genres": ["Action", "RPG"],
  "description": "설명 (없으면 null)",
  "trailerUrl": "https://.../trailer.mp4",
  "coverImageUrl": "https://...",
  "officialUrl": "https://...",
  "tags": ["Singleplayer"],
  "developers": ["개발사"],
  "publishers": ["배급사"],
  "screenshots": ["https://..."],
  "rating": 4.25,
  "ratingsCount": 1200,
  "metacritic": 88,
  "esrbRating": "Mature",
  "playtime": 12,
  "popularity": 5000,
  "externalId": 9001,
  "slug": "game-slug",
  "sourceUrl": "https://rawg.io/games/game-slug",
  "source": "rawg",
  "createdAt": "2026-11-20 14:00:00",
  "updatedAt": "2026-11-20 14:00:00"
}
```
- **항상 있음**: `id`, `title`, `releaseDate`(`YYYY-MM-DD`), `platforms`(배열), `genres`/`tags`/`developers`/`publishers`/`screenshots`(없으면 `[]`)
- **없으면 `null`**: `genre`, `description`, `trailerUrl`, `coverImageUrl`, `officialUrl`, `rating`, `ratingsCount`, `metacritic`, `esrbRating`, `playtime`, `popularity`, `externalId`, `slug`, `sourceUrl`, `source`
- `rating`은 0~5 숫자, `popularity`는 클수록 인기(RAWG의 added 수), `playtime`은 시간 단위
- **`trailerUrl`은 GTA VI 하나만 값이 있고(Rockstar 공식 YouTube 주소), 나머지는 `null`입니다.** RAWG가 영상 데이터를 사실상 주지 않기 때문입니다. 대신 API가 **`trailerSearchUrl`**(YouTube 검색 링크, 저장값이 아니라 계산값)을 항상 같이 돌려줍니다. 직접 판단하지 말고 `frontend/src/lib/trailer.js`의 `trailerInfo(game)`를 쓰세요. 영상이 있으면 video/youtube, 없으면 search 링크를 알려 줍니다.
- 같은 `title` + `releaseDate`는 중복 등록 불가

## 엔드포인트

| 동작 | 요청 | 성공 응답 |
|------|------|-----------|
| 목록 | `GET /api/games` | 200 + 배열, `X-Total-Count` 헤더 |
| 단건 | `GET /api/games/:id` | 200 + 객체 |
| 등록 | `POST /api/games` | 201 + 객체, `Location` 헤더 |
| 전체 수정 | `PUT /api/games/:id` | 200 + 객체 (보내지 않은 선택 필드는 `null`로 초기화) |
| 일부 수정 | `PATCH /api/games/:id` | 200 + 객체 (보낸 필드만 변경) |
| 삭제 | `DELETE /api/games/:id` | 204 (본문 없음) |
| 비슷한 게임 | `GET /api/games/:id/similar?limit=6` | 200 + 게임 배열 (장르/태그가 겹치는 순) |
| 달력 파일 | `GET /api/games/:id/calendar.ics` | 200 + `.ics` (출시일 종일 일정) |
| 달력 요약 | `GET /api/calendar?month=2026-12` | 200 + 날짜별 배열 |
| 장르 목록 | `GET /api/genres` | 200 + `[{ "name": "RPG", "count": 12 }]` (많은 순) |
| 플랫폼 목록 | `GET /api/platforms` | 200 + `[{ "name": "PC", "count": 30 }]` (많은 순) |
| 메인 대작 | `GET /api/featured` | 200 + 게임 배열 (`featuredOrder` 순, 지금은 GTA VI 하나) |
| 뉴스 목록 | `GET /api/news` | 200 + 기사 배열 (최신순), `X-Total-Count` 헤더 |
| 뉴스 매체 | `GET /api/news/sources` | 200 + `[{ "name": "IGN", "language": "en", "count": 20 }]` |
| 상태 확인 | `GET /api/health` | 200 `{ "status": "ok" }` |

### 목록 쿼리 (`GET /api/games`, 모두 선택, 같이 쓰면 AND)
- `month=2026-12` : 해당 월 출시
- `from=2026-12-01&to=2026-12-07` : 기간 (양 끝 포함). 주간 보기, "이번 주 출시"에 사용
- `platform=PC` : 해당 플랫폼 포함 게임 (이름은 `/api/platforms` 값 그대로)
- `genre=RPG` : 해당 장르 포함 게임 (이름은 `/api/genres` 값 그대로)
- `q=검색어` : 제목과 설명에서 검색
- `ids=1,2,3` : 해당 id의 게임만 (최대 100개). 즐겨찾기, 비교 보기에 사용
- `minRating=4` : 평점 4 이상
- `sort=releaseDate` (기본, 오름차순) / `-releaseDate` / `title` / `rating` / `popularity` / `metacritic` / `createdAt`. 앞에 `-`를 붙이면 내림차순
- `limit=50&page=1` : 쪽 단위. **기본 limit은 50, 최대 200**. 전체 개수는 응답 헤더 `X-Total-Count`

### 달력 요약 (`GET /api/calendar`)
`month=2026-12` 또는 `from`/`to` 중 하나는 필수. `platform`, `genre`, `minRating`도 쓸 수 있고, `top=3`(1~10, 기본 3)은 날짜마다 돌려줄 인기 게임 수입니다.
```json
[
  { "date": "2026-12-01", "count": 14,
    "games": [ { "id": 7, "title": "...", "coverImageUrl": "https://...", "rating": 4.5 } ] }
]
```
- 출시작이 있는 날짜만 들어 있습니다. 없는 날은 칸을 비워 두세요.
- `games`는 인기순 상위 `top`개이고, `count`는 그날의 전체 개수입니다. ("+N개" = `count - games.length`)

## 메인 대작(featured)과 트레일러 자동 재생
- `GET /api/featured`는 메인 화면에 고정할 게임들을 순서대로 돌려줍니다. 지금은 **Grand Theft Auto VI** 하나이고 `trailerUrl`에 Rockstar Games 공식 채널의 YouTube 주소가 들어 있습니다. (등록할 때 YouTube oEmbed로 퍼가기가 되는지 확인했습니다.)
- 자동 재생 주소는 직접 만들지 말고 `frontend/src/lib/trailer.js`의 `heroEmbedUrl(game.trailerUrl)`을 쓰세요. 음소거, 자동 재생, 반복 옵션이 들어간 주소를 돌려주고, YouTube가 아니면 `null`입니다.
- 브라우저는 **음소거 상태에서만** 자동 재생을 허용합니다. 영상이 로드되기 전이나 실패했을 때를 대비해 `coverImageUrl`을 배경으로 깔아 두세요.

## 뉴스 (`GET /api/news`)
여러 매체의 RSS에서 가져온 **제목, 짧은 요약, 썸네일, 원문 링크**만 저장합니다. 본문은 저장하지 않으니 원문은 `url`로 보내세요 (새 탭).
```json
{ "id": 1, "source": "인벤", "language": "ko", "title": "기사 제목", "url": "https://원문주소",
  "excerpt": "180자 이내 요약 (없으면 null)", "imageUrl": "https://썸네일 (없으면 null)", "publishedAt": "2026-11-20T03:23:14Z" }
```
- 쿼리(모두 선택): `limit`(1~100, 기본 20), `page`, `source`(매체 이름 그대로), `lang`(`ko` 또는 `en`), `q`(제목/요약 검색)
- 최신순이고 전체 개수는 `X-Total-Count` 헤더입니다.
- **`imageUrl`이 null인 기사가 있습니다** (루리웹은 전부). 이미지 없는 카드 디자인이 필요합니다.
- `publishedAt`은 UTC입니다. 화면에서 "3시간 전" 같은 상대 시간으로 바꿔 보여 주세요.
- 매체: 게임메카, 인벤, 루리웹(한국어), IGN, GameSpot, PC Gamer(영어). 성인 기사는 걸러져 있습니다.
- 게임 상세의 "관련 뉴스"는 `GET /api/news?q=게임제목&limit=5`로 만드세요.

## 성인 게임
성인 게임은 DB에서 삭제했고 앞으로도 들어오지 않습니다. 화면에서 따로 거를 필요가 없습니다.

## 기능과 API 대응표

| # | 기능 | 만드는 방법 |
|---|------|-------------|
| 1 | 달력 칸 클릭 → 그날 출시작 | `GET /api/games?from=D&to=D&sort=-popularity&limit=200` (D = 그 날짜) |
| 2 | 출시 D-day 배지 | `releaseDate`로 프론트에서 계산. 오늘이면 "오늘 출시" |
| 3 | 표지 썸네일 달력 | `GET /api/calendar?month=...`의 `games[].coverImageUrl`, 남은 수는 `count - games.length` |
| 4 | 트레일러 바로 보기 | `trailerUrl` (위 설명 참고, null이면 숨김) |
| 5 | 대작 강조 | `rating`/`metacritic`/`popularity` 기준으로 프론트에서 강조. 목록은 `sort=-popularity` |
| 6 | 플랫폼, 장르 필터 | 선택지는 `/api/platforms`, `/api/genres`, 적용은 `platform=`, `genre=` 쿼리 |
| 7 | 내 플랫폼만 보기 | 선택한 플랫폼을 localStorage에 저장하고 `platform=`에 항상 적용 |
| 8 | 주간/월간 전환 | 월간은 `month=`, 주간은 `from=`/`to=` |
| 9 | "이번 주 출시" 띠 | `from=`(이번 주 월요일) `to=`(일요일) `sort=-popularity&limit=10` |
| 10 | 관심 게임 별표 | 게임 `id` 배열을 localStorage에 저장. 목록은 `GET /api/games?ids=1,2,3` |
| 11 | 구글 캘린더에 추가 | `GET /api/games/:id/calendar.ics` 링크(다운로드), 또는 프론트에서 구글 캘린더 템플릿 주소를 만들어도 됨 |
| 12 | 임박 배너 | 별표한 `ids`를 조회해 `releaseDate`가 7일 이내인 게임을 배너로 표시 |
| 13 | 상세 페이지 | `GET /api/games/:id` + `GET /api/games/:id/similar` |
| 14 | 출시 몰림 히트맵 | `/api/calendar`의 `count`를 색 진하기로 표현 |
| 15 | 검색 → 달력 점프 | `GET /api/games?q=...`로 찾고, 선택한 게임의 `releaseDate`로 달력 이동 |
| 16 | 두 게임 비교 | `GET /api/games?ids=1,2` (또는 각각 단건 조회) |

## 에러 응답
항상 같은 형식입니다.
```json
{ "message": "입력값이 올바르지 않습니다.", "errors": [ { "field": "month", "message": "YYYY-MM 형식이어야 합니다." } ] }
```

| 상태 | 의미 |
|------|------|
| 400 | 입력 오류 (쿼리 형식, 필수값 없음, 잘못된 JSON, 숫자가 아닌 id, 알 수 없는 필드) |
| 404 | 없는 id 또는 없는 경로 |
| 409 | 같은 제목과 출시일의 게임이 이미 있음 |
| 500 | 서버 오류 |

## 꼭 지킬 것
- **출처 표시**: 화면 어딘가(푸터 등)에 "Data from RAWG"와 링크를 넣고, 상세 화면에는 `sourceUrl` 링크를 넣으세요. RAWG 이용 조건입니다.
- **"출시 정보는 변경될 수 있음"** 문구를 달력 근처에 표시하세요.
- `[샘플]`로 시작하는 게임은 가짜 데이터입니다. 실제 데이터를 가져오면 지워집니다. 화면에서 따로 가공하지 마세요.
- 이미지와 영상은 외부 주소를 그대로 쓰세요. 다운로드해서 레포에 넣지 마세요.
- API가 부족하거나 이상하면 백엔드를 고치지 말고 `AI_HANDOFF.md`의 "Codex 요청"에 적어 주세요. 백엔드는 Claude Code가 고칩니다.
