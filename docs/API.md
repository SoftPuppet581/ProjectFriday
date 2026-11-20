# API 명세 (프론트엔드 담당 Codex용)

만드는 것: **달력이 중심인 게임 정보 홈페이지**. 실제 게임 데이터는 RAWG에서 미리 가져와 DB에 저장되어 있고, 프론트는 이 API만 호출합니다.
백엔드는 `http://localhost:3000`에서 실행됩니다. 요청과 응답은 모두 JSON입니다 (`.ics` 제외).
CORS는 `http://localhost:5173`(Vite 기본 주소)만 허용합니다. 다른 주소를 쓰면 `backend/.env`의 `CORS_ORIGIN`을 바꿔야 합니다.
Vite를 쓰면 `vite.config`의 `server.proxy`로 `/api`를 `http://localhost:3000`에 연결해도 됩니다.

## 실행 방법
1. MariaDB 실행: `"C:\Program Files\MariaDB 11.8\bin\mariadbd.exe" --console --bind-address=127.0.0.1 --port=3306`
2. 백엔드 실행: `cd backend` 후 `npm run dev` (Node는 `C:\Program Files\nodejs`)
3. `backend/.env`는 레포에 없습니다. `backend/.env.example`을 복사해서 채웁니다. (이 PC에는 이미 있음)

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
- **`trailerUrl`은 대부분 `.mp4` 파일 주소**입니다. `<video controls src=...>`로 재생하세요. 주소가 `youtube.com`이면 `embed/` 주소로 바꿔 `<iframe>`을 쓰세요. 트레일러가 없는 게임이 많으니 `null`이면 영역을 숨기세요.
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
