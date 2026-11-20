# API 명세 (프론트엔드 담당 Codex용)

백엔드는 `http://localhost:3000`에서 실행됩니다. 요청과 응답은 모두 JSON입니다.
CORS는 `http://localhost:5173`(Vite 기본 주소)만 허용합니다. 다른 주소를 쓰면 `backend/.env`의 `CORS_ORIGIN`을 바꿔야 합니다.

## 실행 방법
1. MariaDB 실행: `"C:\Program Files\MariaDB 11.8\bin\mariadbd.exe" --console --bind-address=127.0.0.1 --port=3306`
2. 백엔드 실행: `cd backend` 후 `npm run dev` (Node는 `C:\Program Files\nodejs`)
3. `backend/.env`는 레포에 없습니다. `backend/.env.example`을 복사해서 채웁니다. (이 PC에는 이미 있음)

## Game 객체
```json
{
  "id": 1,
  "title": "게임 이름",
  "releaseDate": "2026-12-05",
  "platforms": ["PC", "PS5"],
  "genre": "RPG",
  "description": "설명",
  "trailerUrl": "https://www.youtube.com/watch?v=...",
  "coverImageUrl": "https://...",
  "officialUrl": "https://...",
  "createdAt": "2026-11-20 14:00:00",
  "updatedAt": "2026-11-20 14:00:00"
}
```
- 필수: `title`(1~200자), `releaseDate`(`YYYY-MM-DD`), `platforms`(문자열 1개 이상의 배열)
- 선택(없으면 `null`): `genre`(50자), `description`(5000자), `trailerUrl`, `coverImageUrl`, `officialUrl`(http/https 주소, 500자)
- 같은 `title` + `releaseDate`는 중복 등록 불가

## 엔드포인트

| 동작 | 요청 | 성공 응답 |
|------|------|-----------|
| 목록 | `GET /api/games` | 200 + 배열 |
| 단건 | `GET /api/games/:id` | 200 + 객체 |
| 등록 | `POST /api/games` | 201 + 객체, `Location` 헤더 |
| 전체 수정 | `PUT /api/games/:id` | 200 + 객체 (보내지 않은 선택 필드는 `null`로 초기화) |
| 일부 수정 | `PATCH /api/games/:id` | 200 + 객체 (보낸 필드만 변경) |
| 삭제 | `DELETE /api/games/:id` | 204 (본문 없음) |
| 상태 확인 | `GET /api/health` | 200 `{ "status": "ok" }` |

### 목록 쿼리 (모두 선택)
- `month=2026-12` : 해당 월 출시 게임 (달력 한 달 분량을 가져올 때)
- `platform=PC` : 해당 플랫폼 포함 게임
- `genre=RPG` : 장르가 정확히 일치하는 게임
- `q=검색어` : 제목과 설명에서 검색
- `sort=releaseDate` / `sort=-releaseDate` / `title` / `createdAt` : 앞에 `-`를 붙이면 내림차순. 기본은 출시일 오름차순

## 에러 응답
항상 같은 형식입니다.
```json
{ "message": "입력값이 올바르지 않습니다.", "errors": [ { "field": "title", "message": "1~200자의 문자열이 필요합니다." } ] }
```

| 상태 | 의미 |
|------|------|
| 400 | 입력 오류 (필수값 없음, 날짜 형식, 잘못된 JSON, 숫자가 아닌 id, 알 수 없는 필드) |
| 404 | 없는 id 또는 없는 경로 |
| 409 | 같은 제목과 출시일의 게임이 이미 있음 |
| 500 | 서버 오류 |

## 데이터 주의
- DB에 들어 있는 `[샘플]` 게임 3개는 화면 확인용 가짜 데이터입니다. 실제 출시 정보가 아닙니다.
- 화면에 "출시 정보는 변경될 수 있음" 문구를 표시해 주세요.
- 트레일러는 `trailerUrl`(YouTube 주소)로 저장됩니다. 임베드할 때 `watch?v=` 주소를 `embed/` 주소로 바꾸는 처리는 프론트에서 합니다.
