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
- **`trailerUrl`은 메인 대작 6개(`/api/featured`)만 값이 있고(공식 YouTube 주소), 나머지는 `null`입니다.** RAWG가 영상 데이터를 사실상 주지 않기 때문입니다. 대신 API가 **`trailerSearchUrl`**(YouTube 검색 링크, 저장값이 아니라 계산값)을 항상 같이 돌려줍니다. 직접 판단하지 말고 `frontend/src/lib/trailer.js`의 `trailerInfo(game)`를 쓰세요. 영상이 있으면 video/youtube, 없으면 search 링크를 알려 줍니다.
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
| 메인 대작 | `GET /api/featured` | 200 + 게임 배열 (`featuredOrder` 순, 지금 6개, 모두 `trailerUrl` 있음) |
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

## 회원, 로그인, 개인 기능 (관심 게임 · 선호 플랫폼)
이메일 + 비밀번호로 가입하고 로그인하면 **토큰**을 받습니다. 토큰이 필요한 요청에는 `Authorization: Bearer <토큰>` 헤더를 붙입니다. (`frontend/src/api/client.js`의 `api`가 저장된 토큰을 자동으로 붙여 줍니다.) 토큰은 14일 뒤 만료되고, 서버에는 토큰의 해시만 저장됩니다.

| 동작 | 요청 | 성공 | 토큰 |
|------|------|------|------|
| 회원가입 | `POST /api/users` `{ email, password, displayName }` | 201 `{ token, expiresAt, user }` (가입과 동시에 로그인) | 불필요 |
| 로그인 | `POST /api/sessions` `{ email, password }` | 201 `{ token, expiresAt, user }` | 불필요 |
| 로그아웃 | `DELETE /api/sessions/current` | 204 (이 토큰만 무효, 다른 기기는 유지) | 필요 |
| 내 정보 | `GET /api/users/me` | 200 `{ id, email, displayName, preferredPlatform, createdAt }` | 필요 |
| 내 정보 수정 | `PATCH /api/users/me` `{ displayName?, preferredPlatform? }` | 200 내 정보 (`preferredPlatform: null`로 비우기) | 필요 |
| 관심 게임 id 목록 | `GET /api/users/me/favorites/ids` | 200 `[1, 5, 9]` (최근에 담은 순) | 필요 |
| 관심 게임 목록 | `GET /api/users/me/favorites` | 200 게임 객체 배열 (게임 목록과 같은 모양) | 필요 |
| 관심 게임 추가 | `PUT /api/users/me/favorites/:gameId` | 204 (이미 있어도 204, 없는 게임은 404) | 필요 |
| 관심 게임 삭제 | `DELETE /api/users/me/favorites/:gameId` | 204 (없는 걸 지워도 204) | 필요 |
| 관심 게임 일괄 추가 | `POST /api/users/me/favorites` `{ gameIds: [1, 2] }` | 200 계정의 전체 id 배열 (있는 게임만 합치고 중복은 무시) | 필요 |

- **가입 규칙**: 이메일 형식(대소문자 무시, 공백 제거), 비밀번호 8~128자에 글자와 숫자 포함, 닉네임 1~40자. 같은 이메일이면 `409`, 규칙 위반은 `400`과 `errors[{ field, message }]`.
- **로그인 실패는 항상 같은 `401` 응답**입니다("이메일 또는 비밀번호가 올바르지 않습니다."). 이메일이 가입되어 있는지 알 수 없게 하려는 것입니다. 같은 이메일+주소로 **8번 틀리면 10분간 `429`**(`Retry-After` 헤더)이고, 성공하면 횟수가 지워집니다.
- 토큰이 없거나 만료되었거나 잘못됐으면 `401`("로그인이 필요합니다."). 화면에서는 로그아웃 상태로 돌려 보내세요.
- 응답 어디에도 비밀번호나 해시는 없습니다. 비밀번호는 `scrypt`(솔트 포함)로 저장됩니다.
- **로그인 전에 이 브라우저에 담아 둔 관심 게임은 로그인할 때 `POST /api/users/me/favorites`로 합치고**, 합친 뒤 로컬 목록을 비웁니다(다음 로그인 때 다시 합쳐지지 않게). 구현은 `App.jsx`의 `handleAuth`입니다.
- 이메일 인증, 비밀번호 재설정, 계정 삭제는 없습니다(실습용). 비밀번호를 잊으면 DB에서 계정을 지워야 합니다.

## 프로필 사진
- 내 정보(`user`)와 포럼의 작성자(`author`)에 `avatar` 필드가 있습니다. 값은 `"a01"`~`"a20"` 중 하나이거나 `null`(기본 사진)입니다.
- 사진 파일은 `frontend/public/avatars/`의 SVG입니다 (`default.svg`, `a01.svg`~`a20.svg`, `scripts/makeAvatars.mjs`로 생성). 화면에서는 `Avatar` 컴포넌트와 `lib/avatars.js`의 `avatarPath(key)`를 쓰세요. 알 수 없는 값은 자동으로 기본 사진이 됩니다.
- 바꾸기: `PATCH /api/users/me` `{ "avatar": "a12" }` (`null`이면 기본 사진). 다른 값은 `400`입니다. 직접 올린 사진 업로드는 지원하지 않습니다.

## 포럼 (`/api/forum`)
읽기는 누구나, 쓰기/좋아요/삭제는 로그인(토큰)이 필요합니다. 분류는 `자유`, `질문`, `추천`, `공략` 네 가지입니다.

| 동작 | 요청 | 성공 |
|------|------|------|
| 글 목록 | `GET /api/forum/posts` | 200 글 요약 배열, `X-Total-Count` 헤더 |
| 글 상세 | `GET /api/forum/posts/:postId` | 200 본문과 댓글 포함 |
| 글 쓰기 | `POST /api/forum/posts` `{ category, title, body, gameId? }` | 201 글 (토큰 필요) |
| 글 삭제 | `DELETE /api/forum/posts/:postId` | 204 (내 글만, 남의 글은 `403`) |
| 댓글 쓰기 | `POST /api/forum/posts/:postId/comments` `{ body }` | 201 댓글 (토큰 필요) |
| 댓글 삭제 | `DELETE /api/forum/posts/:postId/comments/:commentId` | 204 (내 댓글만) |
| 좋아요 | `PUT /api/forum/posts/:postId/like` | 204 (여러 번 눌러도 한 번만) |
| 좋아요 취소 | `DELETE /api/forum/posts/:postId/like` | 204 |

- 목록 쿼리(모두 선택): `category`, `q`(제목/내용 검색), `gameId`, `sort=recent`(기본)|`popular`(좋아요×2+댓글 순), `limit`(1~50, 기본 20), `page`
- 글 객체: `{ id, category, title, excerpt|body, author: { id, displayName, avatar }, game: { id, title } | null, createdAt, commentCount, likeCount, liked, mine, comments? }`. 목록에는 본문 대신 140자 `excerpt`가, 상세에는 `body`와 `comments`가 있습니다. **작성자의 이메일은 어디에도 나오지 않습니다.**
- `liked`(내가 좋아요 했는지)와 `mine`(내 글인지)은 보는 사람 기준이고, 로그인 안 했으면 모두 `false`입니다. 댓글에도 `mine`이 있습니다.
- 글이나 계정이 지워지면 딸린 댓글과 좋아요도 같이 지워집니다.

### 시연용 샘플 계정
- `npm run seed:demo`(backend)가 **가상의 샘플 계정 20개**와 글 18개, 댓글 43개, 좋아요 63개를 넣습니다. 프로필 사진 20개를 하나씩 쓰고, 시각은 최근 일주일에 흩어집니다. 다시 실행하면 샘플만 지우고 새로 넣습니다.
- 샘플 계정은 DB에 `is_demo = 1`이 붙고, 이메일은 존재할 수 없는 `.invalid` 주소이며, 비밀번호는 무작위로 만들어 버립니다. **아무도 로그인할 수 없고 토큰도 서버가 거부합니다.**
- 지우기: `npm run seed:demo:remove` (샘플만 지워지고 실제 사용자의 계정과 글은 그대로). 포럼 화면 아래에 "포럼의 일부 계정과 글은 시연용 샘플입니다" 안내가 표시됩니다.

## 스토어 링크, 가격, 바로 가기 링크
게임 객체에 아래 필드가 항상 들어 있습니다. **전부 읽기 전용**입니다 (API로 쓸 수 없고, `PUT`으로 게임을 덮어써도 지워지지 않습니다).
```json
{
  "stores": [ { "name": "Steam", "url": "https://store.steampowered.com/app/3764200/Resident_Evil_Requiem/" },
              { "name": "PlayStation Store", "url": "https://store.playstation.com/..." } ],
  "steamAppId": 3764200,
  "price": { "currency": "KRW", "final": 79800, "initial": 79800, "discountPercent": 0, "formatted": "₩ 79,800",
             "onSale": false, "updatedAt": "2026-11-20T04:06:39Z" },
  "steamStoreUrl": "https://store.steampowered.com/app/3764200/",
  "steamClientUrl": "steam://store/3764200",
  "steamSearchUrl": "https://store.steampowered.com/search/?term=...",
  "newsSearchUrl": "https://search.naver.com/search.naver?where=news&query=..."
}
```
- `stores`: 스토어 이름과 상품 페이지 주소. Steam이 먼저입니다. **없으면 `[]`** (스토어가 하나도 안 알려진 게임이 140개 정도 있습니다)
- `steamAppId`: Steam 앱 번호. Steam에서 안 파는 게임은 `null`
- **`price`는 Steam 원화 기준이고, 없으면 `null`("가격 미정")입니다.** 가격이 `null`인 이유는 콘솔 전용(GTA VI, Wolverine 등), 출시 전이라 가격 미공개, Steam 미등록입니다. 가격이 `0`이면 무료 게임입니다(`formatted: "무료"`).
- `price.initial`은 할인 전 가격, `discountPercent`는 할인율(0~100), `onSale`은 할인 중인지입니다. `updatedAt`은 가격을 확인한 시각(UTC)이고, **가격은 계속 바뀌므로** 화면에 "변동될 수 있음"을 함께 쓰세요.
- `steamStoreUrl`(Steam 상품 페이지)과 `steamClientUrl`(Steam 앱으로 열기, `steam://` 주소라 Steam이 설치된 PC에서만 열림)은 `steamAppId`가 있을 때만 값이 있고 아니면 `null`입니다.
- `steamSearchUrl`(Steam 검색 결과)과 `newsSearchUrl`(네이버 뉴스 검색 결과)은 **모든 게임에 항상** 있습니다. 제목으로 만든 검색 링크입니다.
- 화면에서는 직접 가공하지 말고 `frontend/src/lib/stores.js`의 `formatPrice(game.price)`, `storeLinks(game)`, `steamClientLink(game)`, `newsSearchLink(game)`를 쓰세요.
- 모든 외부 링크는 새 탭(`target="_blank" rel="noopener noreferrer"`)으로 여세요.

## 메인 대작(featured)과 트레일러 자동 재생
- `GET /api/featured`는 메인 화면(캐러셀)에 고정할 게임들을 순서대로 돌려줍니다. 지금은 아래 6개이고 모두 `trailerUrl`에 YouTube 공식 트레일러 주소가 들어 있습니다. 등록할 때 YouTube로 **퍼가기 가능 여부와 올린 채널**을 확인했습니다.

  | 순서 | 게임 | 올린 채널 |
  |------|------|-----------|
  | 1 | Grand Theft Auto VI | Rockstar Games |
  | 2 | Marvel's Wolverine | PlayStation |
  | 3 | Resident Evil 9: Requiem | IGN (제작사 채널 영상을 못 찾아서 IGN이 올린 공식 트레일러) |
  | 4 | Gears of War: E-Day | Gears of War |
  | 5 | Forza Horizon 6 | Forza |
  | 6 | 007 First Light | IGN (제작사 채널 영상을 못 찾아서 IGN이 올린 공식 트레일러) |

- 자동 재생 주소는 직접 만들지 말고 `frontend/src/lib/trailer.js`의 `heroEmbedUrl(game.trailerUrl, { loop, start })`을 쓰세요. 음소거와 자동 재생 옵션이 들어간 주소를 돌려주고, YouTube가 아니면 `null`입니다. 캐러셀에서는 `{ loop: false }`를 주고, 현재 보이는 슬라이드 하나만 iframe으로 띄우세요.
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
