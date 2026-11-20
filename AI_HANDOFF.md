# AI HandOff

팀장이 Claude Code와 Codex를 번갈아 쓸 때 서로 작업을 넘겨받는 공유 메모입니다. 팀원 보고용 [HandOff.md](HandOff.md)와는 별개입니다.

## 규칙
1. 작업 시작 전에 이 파일을 먼저 읽습니다.
2. 작업을 마치면 "현재 상태", "마지막으로 한 일", "다음 할 일"을 갱신합니다.
3. commit까지만 하고 push는 하지 않습니다. push는 팀장이 직접 합니다.
4. 비밀번호, 토큰, API 키, 개인정보는 적지 않습니다. (공개 레포)

## 프로젝트 (팀장 개인 프로젝트)
- 오늘(2026-11-20) 14~18시 바이브 코딩 실습. 끝나면 레포 삭제 예정
- 팀원 4명은 각자 다른 개인 홈페이지를 따로 만든다. 이 문서는 팀장 프로젝트만 다룬다 (팀원은 팀장 관리 범위 밖)
- **무엇을 만드나: "게임 정보 홈페이지"**. 세계에 실제로 존재하는 수많은 게임의 정보를 한곳에서 보는 사이트다
- **달력이 메인 기능**이다. 달력을 중심으로 파생 기능들을 붙인다 (예: 12월 1일 칸을 누르면 그날 출시하는 게임이 열리고, D-day, 트레일러, 상세로 이어진다)
- 가짜 데이터로 만드는 출시 캘린더가 아니다. 실제 게임 데이터를 외부 API(RAWG)에서 가져와 DB에 저장해 쓴다
- 기능은 오늘 안에 전부 하는 것이 목표다 (아래 기능 목록)

## 아키텍처
```
RAWG API ──(npm run import, 사전 실행)──▶ MariaDB ◀── Express (MVC) ◀──REST/JSON── React (Vite)
```
- 언어: JavaScript 하나. Java는 쓰지 않기로 함
- DB: MariaDB. 시연 중에 외부 API를 부르지 않고, 미리 가져와 저장해 둔 데이터를 쓴다
- MVC: Model = models/Game, Controller = controllers/gameController, View = React
- 별도 DTO 계층은 만들지 않는다. 필수값 검증과 일정한 에러 JSON 형식만 한다
- 배포: Express+MariaDB는 Vercel에서 못 돌린다. 오늘은 로컬 실행으로 시연한다. 인터넷 공개는 하지 않는다
- 설치 위치: Node.js는 C:\Program Files\nodejs, MariaDB는 C:\Program Files\MariaDB 11.8 (이미 열려 있던 터미널은 PATH에 없을 수 있으니 새로 열 것)
- MariaDB는 윈도우 서비스로 등록되지 않았다. 실행: "C:\Program Files\MariaDB 11.8\bin\mariadbd.exe" --console --bind-address=127.0.0.1 --port=3306 (내 컴퓨터에서만 접속됨)

## 역할 분담
- Claude Code: 백엔드(backend/), DB, API, 가져오기 스크립트, 테스트, 문서. 프론트엔드 코드는 건드리지 않는다
- Codex: 프론트엔드 UI와 화면(frontend/, React + Vite). **시작 전에 docs/API.md를 끝까지 읽는다**. 특히 "기능과 API 대응표"
- 둘이 같은 파일을 동시에 고치지 않는다. API가 바뀌면 docs/API.md와 테스트를 같이 갱신한다

## 기능 목록 (전부 오늘 목표)
달력 중심 파생 기능. 어떤 API로 만드는지는 docs/API.md의 "기능과 API 대응표" 참고
1. 달력 칸 클릭 → 그날 출시작 패널
2. 출시 D-day 배지
3. 표지 썸네일 달력 ("+N개"로 접기)
4. 트레일러 바로 보기
5. 평점/인기 높은 대작 강조
6. 플랫폼, 장르 필터
7. 내 플랫폼만 보기 (설정 저장)
8. 주간/월간 보기 전환
9. "이번 주 출시" 요약 띠
10. 관심 게임 별표 (브라우저 저장)
11. 구글 캘린더에 추가
12. 관심 게임 출시 임박 배너
13. 게임 상세 페이지 (개발사, 평점, 스크린샷, 비슷한 게임)
14. 출시 몰림 히트맵
15. 검색 → 달력 점프
16. 두 게임 비교 보기

## 데이터 규칙
- 데이터 출처는 RAWG(rawg.io). **화면에 "Data from RAWG" 같은 출처 표시와 링크(게임의 sourceUrl)를 넣어야 한다** (RAWG 이용 조건)
- 출시일은 바뀔 수 있으므로 화면에 "출시 정보는 변경될 수 있음"을 표시한다
- AI가 기억에 의존해 게임 정보를 DB에 채우지 않는다. 데이터는 가져오기 스크립트로만 넣는다
- 이미지와 영상은 파일을 복사하지 않고 외부 링크로만 연결한다
- DB의 "[샘플]" 게임은 가짜다. 실제 데이터를 가져온 뒤 `npm run db:clean-samples`로 지운다
- RAWG API 키는 backend/.env의 RAWG_API_KEY에만 둔다. 채팅, 문서, 코드, 커밋에 적지 않는다

## 현재 상태
- 레포 생성 및 문서(HandOff.md, AI_HANDOFF.md, CLAUDE.md, AGENTS.md) 작성 완료
- 백엔드 완성 (Claude): games RESTful CRUD, 확장 필드(평점, 장르 배열, 태그, 개발사, 스크린샷, 트레일러 등), 페이지네이션(X-Total-Count), 기간/ids/minRating 필터, 달력 요약 API, 비슷한 게임 API, .ics 내려받기, 장르/플랫폼 목록 API
- RAWG 가져오기 스크립트 완성 (`npm run import`). 하지만 **RAWG API 키가 아직 없어서 실제 RAWG 서버로는 한 번도 실행해 보지 못했다.** 가짜 응답(fixture)으로만 테스트했으므로, 키가 생기면 첫 실행에서 응답 필드가 맞는지 확인해야 한다
- 자동 테스트 78개 통과 (`npm test`, MariaDB가 켜져 있어야 함, 별도 DB game_calendar_test 사용)
- DB: game_calendar (전용 사용자 gamecal, 접속 정보는 backend/.env에만 있고 git 제외). 지금 들어 있는 게임은 가짜 샘플 3개뿐
- 프론트엔드(frontend/)는 아직 없음. Codex 담당
- index.html은 미커밋 임시 확인용 파일 (정리 대기)

## 마지막으로 한 일
| 날짜 | 도구 | 내용 |
|------|------|------|
| 2026-11-20 | Claude Code | 레포 생성, 문서 작성 |
| 2026-11-20 | Claude Code | 백엔드 CRUD, 테스트 37개 |
| 2026-11-20 | Claude Code | 방향 변경(실제 게임 정보 사이트, 달력 중심)에 맞춰 확장 API, RAWG 가져오기, 테스트 78개, 문서 갱신 |

## 다음 할 일
- [ ] (팀장) rawg.io/apidocs에서 무료 API 키 발급 → backend/.env에 `RAWG_API_KEY=키` 추가 (직접 해야 함)
- [ ] (Claude) 키가 생기면 `npm run import` 첫 실행, 실제 응답과 매핑 확인, 필요하면 수정
- [ ] (Claude) 가져온 뒤 `npm run db:clean-samples`로 가짜 샘플 삭제
- [ ] (Codex) frontend/ 생성: React + Vite, 위 기능 목록 전부. API가 부족하거나 이상하면 코드를 고치지 말고 이 파일 "Codex 요청" 아래에 적는다
- [ ] 임시 index.html 정리 (삭제 여부 팀장 확인)

## Codex 요청 (Codex가 백엔드에 바라는 점을 여기에 적는다)
- (아직 없음)
