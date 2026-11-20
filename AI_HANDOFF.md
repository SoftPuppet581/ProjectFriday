# AI HandOff

팀장이 Claude Code와 Codex를 번갈아 쓸 때 서로 작업을 넘겨받는 공유 메모입니다. 팀원 보고용 [HandOff.md](HandOff.md)와는 별개입니다.

## 규칙
1. 작업 시작 전에 이 파일을 먼저 읽습니다.
2. 작업을 마치면 "현재 상태", "마지막으로 한 일", "다음 할 일"을 갱신합니다.
3. commit까지만 하고 push는 하지 않습니다. push는 팀장이 직접 합니다.
4. 비밀번호, 토큰, 개인정보는 적지 않습니다. (공개 레포)

## 프로젝트 (팀장 개인 프로젝트)
- 오늘(2026-11-20) 14~18시 바이브 코딩 실습. 끝나면 레포 삭제 예정
- 팀원 4명은 각자 다른 개인 홈페이지를 따로 만든다. 이 문서는 팀장 프로젝트만 다룬다 (팀원은 팀장 관리 범위 밖)
- 주제: 게임 출시 캘린더 (게임 정보를 한눈에 보기). 단순 캘린더를 넘어 기능을 최대한 많이 넣는다

## 아키텍처
```
React (Vite) ──REST/JSON──▶ Node.js + Express (MVC) ──▶ MariaDB
 화면, 달력, 필터, 트레일러   routes → controllers → models
```
- 언어: JavaScript 하나 (프론트와 백엔드). Java는 쓰지 않기로 함
- DB: 팀장은 MariaDB. 팀원 쪽 DB는 관여하지 않음
- MVC: Model = models/Game (DB 쿼리), Controller = controllers/gameController (HTTP 처리), View = React
- 별도 DTO 계층은 만들지 않는다. 필수값 검증과 일정한 에러 JSON 형식만 한다
- 배포: Vercel로 Express+MariaDB는 못 돌린다. 오늘은 로컬 실행으로 시연한다. 인터넷 공개는 하지 않는다
- 설치 위치: Node.js는 C:\Program Files\nodejs, MariaDB는 C:\Program Files\MariaDB 11.8 (이미 열려 있던 터미널은 PATH에 없을 수 있으니 새로 열 것)
- MariaDB는 윈도우 서비스로 등록되지 않았다. 실행: "C:\Program Files\MariaDB 11.8\bin\mariadbd.exe" --console --bind-address=127.0.0.1 --port=3306 (내 컴퓨터에서만 접속됨)

## 역할 분담
- Claude Code: 백엔드(backend/), DB, API, 문서. 프론트엔드 코드는 건드리지 않는다
- Codex: 프론트엔드 UI와 화면(frontend/, React + Vite). 시작 전에 docs/API.md를 읽는다
- 둘이 같은 파일을 동시에 고치지 않는다. API가 바뀌면 docs/API.md를 같이 갱신한다

## RESTful API 규칙
| 동작 | 메서드와 URL | 성공 |
|------|--------------|------|
| 목록 | GET /api/games | 200 |
| 단건 | GET /api/games/:id | 200 |
| 등록 | POST /api/games | 201 + Location 헤더 |
| 전체 수정 | PUT /api/games/:id | 200 |
| 일부 수정 | PATCH /api/games/:id | 200 |
| 삭제 | DELETE /api/games/:id | 204 |
- 필터는 쿼리로: ?month=2026-12 &platform=PC &genre=RPG &sort=releaseDate &q=검색어
- 동사형 URL(/getGames 등) 금지. 요청과 응답은 JSON
- 에러: 400 입력 오류, 404 없는 id, 409 중복, 500 서버 오류. 본문은 { "message", "errors" } 형식으로 통일
- 서버는 상태를 기억하지 않는다 (무상태)

## 기능 범위 (단계별, 앞 단계를 끝낸 뒤 다음 단계로)
1. 핵심 (반드시 완성): 게임 CRUD, 월간 달력 격자, 플랫폼/장르 필터, 게임 상세
2. 확장: 트레일러(YouTube 링크 저장 후 임베드), 표지 이미지 URL, 출시 D-day, 검색/정렬, 관심 게임 즐겨찾기
3. 추가: 등록/수정 관리 폼, 페이지네이션, 다크 모드와 모바일 대응, 구글 캘린더 추가 링크, 이번 달 출시 요약
4. 선택: 외부 게임 API로 데이터 자동 가져오기 (API 키는 환경변수로만, 레포에 올리지 않는다)
- 한 단계가 끝나면 동작하는 상태로 커밋한다. 중간에 막혀도 직전 단계로 시연할 수 있게 한다

## 데이터 규칙
- 출시일은 바뀔 수 있으므로 화면에 "정보는 변경될 수 있음"을 표시한다
- 출시일과 트레일러 링크는 사람이 조사해서 입력하고 AI가 임의로 채우지 않는다. 샘플 데이터는 샘플임을 표시한다
- 이미지와 영상은 파일을 복사하지 않고 외부 링크로만 연결한다

## 현재 상태
- 레포 생성 및 문서(HandOff.md, AI_HANDOFF.md, CLAUDE.md, AGENTS.md) 작성 완료
- 백엔드 1단계(핵심) 완성: Express MVC + MariaDB, 게임 RESTful CRUD, 월/플랫폼/장르/검색/정렬 필터, 입력 검증, 일정한 에러 형식. 자동 테스트 37개 통과 (npm test, MariaDB가 켜져 있어야 함)
- DB: game_calendar (전용 사용자 gamecal, 접속 정보는 backend/.env에만 있고 git 제외). 샘플 게임 3개는 가짜 데이터
- 프론트엔드(frontend/)는 아직 없음. Codex 담당. API 명세는 docs/API.md
- index.html은 미커밋 임시 확인용 파일 (정리 대기)

## 마지막으로 한 일
| 날짜 | 도구 | 내용 |
|------|------|------|
| 2026-11-20 | Claude Code | 레포 생성, HandOff.md 작성, AI_HANDOFF.md/CLAUDE.md/AGENTS.md 추가 |

## 다음 할 일
- [x] Node.js, MariaDB 설치 완료 (Node 26.13.1 / npm 11.20.0, MariaDB 11.8.2 LTS)
- [x] 프로젝트 전용 DB와 사용자 생성 (root는 아직 비밀번호가 없음. 필요하면 설정. 비밀번호는 이 파일에 적지 않는다)
- [x] backend 뼈대와 games RESTful CRUD
- [ ] (Codex) frontend/ 생성: React + Vite, 달력 격자, 필터, 상세, 트레일러 임베드
- [ ] (Claude) 2단계 백엔드: 즐겨찾기 API, 이번 달 요약 API 등 프론트가 요청하는 것
- [x] (Claude) 백엔드 자동 테스트: backend에서 `npm test` (37개 통과). 별도 DB game_calendar_test를 쓰므로 운영 DB는 건드리지 않는다. API를 바꾸면 테스트도 같이 고친다
- [ ] 임시 index.html 정리 (삭제 여부 팀장 확인)
