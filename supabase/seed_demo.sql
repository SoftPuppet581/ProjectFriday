-- 자동 생성 파일 (backend/scripts/exportSupabaseSeed.js). 시연용 가상의 샘플 계정과 글이다. 샘플 계정은 로그인할 수 없다.
-- 먼저 supabase/schema.sql을 실행한 뒤 이 파일을 실행한다.
begin;
delete from public.profiles where is_demo;  -- 글, 댓글, 좋아요는 연쇄로 지워진다

insert into public.profiles (id, display_name, avatar, is_demo, created_at) values ('a5551307-4a54-5d73-a42f-351818eb85d3', '새벽고양이', 'a12', true, now() - interval '28800 minutes');
insert into public.profiles (id, display_name, avatar, is_demo, created_at) values ('060f5271-f706-527b-a54d-0a93dc586f1f', '모카라떼', 'a17', true, now() - interval '27397 minutes');
insert into public.profiles (id, display_name, avatar, is_demo, created_at) values ('c43cf929-0018-52b8-a053-ef7428a0f4fc', '김치볶음밥', 'a07', true, now() - interval '25994 minutes');
insert into public.profiles (id, display_name, avatar, is_demo, created_at) values ('6928ad6a-5069-596a-a12a-1318c44eb31e', '별빛수집가', 'a02', true, now() - interval '24591 minutes');
insert into public.profiles (id, display_name, avatar, is_demo, created_at) values ('bc0835ac-9639-5696-afe8-29955c690b92', '콩나물게이머', 'a01', true, now() - interval '23188 minutes');
insert into public.profiles (id, display_name, avatar, is_demo, created_at) values ('b13c48b3-cd14-5295-afc6-b73cc98f501a', '밤하늘고래', 'a08', true, now() - interval '21785 minutes');
insert into public.profiles (id, display_name, avatar, is_demo, created_at) values ('c4ab29c4-5dd0-5c82-a69c-a930111f4066', '초코송이', 'a16', true, now() - interval '20382 minutes');
insert into public.profiles (id, display_name, avatar, is_demo, created_at) values ('a12a49d2-93ad-5751-a0a6-380fc921cf29', '퀘스트중독', 'a15', true, now() - interval '18979 minutes');
insert into public.profiles (id, display_name, avatar, is_demo, created_at) values ('d3d6ceca-5841-5327-ac09-725c9f68a52a', '한입만', 'a03', true, now() - interval '17576 minutes');
insert into public.profiles (id, display_name, avatar, is_demo, created_at) values ('9902d259-b4fa-5985-a1f7-7e6307d3f119', '느긋한거북이', 'a14', true, now() - interval '16173 minutes');
insert into public.profiles (id, display_name, avatar, is_demo, created_at) values ('50c9c8e5-cc89-574a-a4e3-764b3748baaf', '라면은진리', 'a06', true, now() - interval '14770 minutes');
insert into public.profiles (id, display_name, avatar, is_demo, created_at) values ('0b674842-ed77-5c8b-a305-31386f8ba090', '뚜벅이용사', 'a19', true, now() - interval '13367 minutes');
insert into public.profiles (id, display_name, avatar, is_demo, created_at) values ('8ec9724d-e90f-5617-a5bd-9aa3c1e243fe', '달빛여우', 'a09', true, now() - interval '11964 minutes');
insert into public.profiles (id, display_name, avatar, is_demo, created_at) values ('fffe8724-d316-5e8d-ad9f-d8e88175813b', '소심한탱커', 'a05', true, now() - interval '10561 minutes');
insert into public.profiles (id, display_name, avatar, is_demo, created_at) values ('a93727cd-905e-5043-acba-5f83aaf77bcd', '야근하는힐러', 'a04', true, now() - interval '9158 minutes');
insert into public.profiles (id, display_name, avatar, is_demo, created_at) values ('745adb23-3c04-5eab-aaa3-59679ab3b1c0', '치즈케이크', 'a10', true, now() - interval '7755 minutes');
insert into public.profiles (id, display_name, avatar, is_demo, created_at) values ('ffe610d3-e18a-5313-a35f-e3fd6f2cf21f', '방구석탐험가', 'a18', true, now() - interval '6352 minutes');
insert into public.profiles (id, display_name, avatar, is_demo, created_at) values ('5f4f229a-6cfa-5526-a247-9af73f0ddfac', '로딩중', 'a13', true, now() - interval '4949 minutes');
insert into public.profiles (id, display_name, avatar, is_demo, created_at) values ('5ee27912-e50a-5efb-a3cc-76e360387f8c', '고양이집사', 'a11', true, now() - interval '3546 minutes');
insert into public.profiles (id, display_name, avatar, is_demo, created_at) values ('8e28afcb-e03d-548d-a62a-cc97ca600987', '민트초코', 'a20', true, now() - interval '2143 minutes');

insert into public.forum_posts (id, user_id, category, title, body, game_id, game_title, created_at) overriding system value values (1, 'a5551307-4a54-5d73-a42f-351818eb85d3', '질문', '퇴근하고 짧게 즐길 만한 게임 있을까요?', '퇴근하면 한두 시간밖에 못 해서 긴 호흡의 게임은 자꾸 손이 안 가요. 부담 없이 한 판씩 끊어서 할 수 있는 게임 있으면 추천 부탁드려요.', null, null, now() - interval '9000 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (1, '060f5271-f706-527b-a54d-0a93dc586f1f', '저는 요즘 협동 게임을 친구들이랑 가끔 켜요. 시간 맞춰서 한두 시간만 하는 편이라 퇴근 후에 딱입니다.', now() - interval '8910 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (1, '9902d259-b4fa-5985-a1f7-7e6307d3f119', '로그라이크가 짧게 하기 좋아요. 한 판에 20~30분이라 중간에 끊어도 아쉽지 않아요.', now() - interval '8820 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (1, 'a5551307-4a54-5d73-a42f-351818eb85d3', '로그라이크 좋네요! 이 사이트에서 장르 필터로 한번 찾아볼게요 ㅎㅎ', now() - interval '8700 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (1, 'a93727cd-905e-5043-acba-5f83aaf77bcd', '저도 비슷한 고민이라 지켜보는 중입니다…', now() - interval '8460 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (1, '060f5271-f706-527b-a54d-0a93dc586f1f', now() - interval '8940 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (1, '9902d259-b4fa-5985-a1f7-7e6307d3f119', now() - interval '8940 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (1, 'd3d6ceca-5841-5327-ac09-725c9f68a52a', now() - interval '8940 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (1, '8e28afcb-e03d-548d-a62a-cc97ca600987', now() - interval '8940 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (1, '5f4f229a-6cfa-5526-a247-9af73f0ddfac', now() - interval '8940 minutes');
insert into public.forum_posts (id, user_id, category, title, body, game_id, game_title, created_at) overriding system value values (2, 'a12a49d2-93ad-5751-a0a6-380fc921cf29', '자유', 'GTA6 트레일러 2 몇 번 돌려보셨어요?', '트레일러 볼 때마다 배경에 새로 보이는 게 있어서 자꾸 다시 보게 돼요. 다들 어떤 장면이 제일 기억에 남으세요?', 38, 'Grand Theft Auto VI', now() - interval '7560 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (2, 'c4ab29c4-5dd0-5c82-a69c-a930111f4066', '저는 도시 전경 나오는 부분이요. 분위기가 확 살아요.', now() - interval '7518 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (2, '50c9c8e5-cc89-574a-a4e3-764b3748baaf', '출시일이 언제로 나오든 일단 기다리는 중입니다 ㅋㅋ 이 사이트 히어로에서 자동으로 재생되는 게 은근 보게 되네요.', now() - interval '7440 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (2, 'b13c48b3-cd14-5295-afc6-b73cc98f501a', '음악이랑 같이 보면 더 좋아요. 소리 켜고 한번 보세요.', now() - interval '7320 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (2, '0b674842-ed77-5c8b-a305-31386f8ba090', '다른 건 몰라도 그래픽은 기대됩니다.', now() - interval '7200 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (2, 'ffe610d3-e18a-5313-a35f-e3fd6f2cf21f', '저는 아직 1편 트레일러만 봤는데 2편도 찾아봐야겠네요.', now() - interval '6900 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (2, 'a5551307-4a54-5d73-a42f-351818eb85d3', now() - interval '7500 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (2, 'b13c48b3-cd14-5295-afc6-b73cc98f501a', now() - interval '7500 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (2, 'c4ab29c4-5dd0-5c82-a69c-a930111f4066', now() - interval '7500 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (2, '0b674842-ed77-5c8b-a305-31386f8ba090', now() - interval '7500 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (2, '50c9c8e5-cc89-574a-a4e3-764b3748baaf', now() - interval '7500 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (2, '8ec9724d-e90f-5617-a5bd-9aa3c1e243fe', now() - interval '7500 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (2, '745adb23-3c04-5eab-aaa3-59679ab3b1c0', now() - interval '7500 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (2, 'ffe610d3-e18a-5313-a35f-e3fd6f2cf21f', now() - interval '7500 minutes');
insert into public.forum_posts (id, user_id, category, title, body, game_id, game_title, created_at) overriding system value values (3, 'bc0835ac-9639-5696-afe8-29955c690b92', '질문', 'Requiem PC로 하려는데 사양 어느 정도 봐야 할까요?', '그래픽카드 바꿀지 말지 고민 중이에요. 공식 권장 사양을 보긴 했는데, 실제로 돌려보신 분들 체감은 어떤지 궁금합니다. 해상도는 1440p 생각하고 있어요.', 40, 'Resident Evil 9: Requiem', now() - interval '6600 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (3, '5f4f229a-6cfa-5526-a247-9af73f0ddfac', '공식 권장 사양보다 한 단계 높게 잡는 걸 추천해요. 최근 게임들은 옵션을 낮춰도 쾌적함 차이가 커서요.', now() - interval '6450 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (3, 'fffe8724-d316-5e8d-ad9f-d8e88175813b', '저도 같은 고민이에요. 이 사이트에서 가격 확인하고 세일할 때 맞춰서 살까 생각 중입니다.', now() - interval '6300 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (3, 'bc0835ac-9639-5696-afe8-29955c690b92', '다들 감사합니다! 일단 세일 기다려보고 결정해 볼게요.', now() - interval '6180 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (3, 'fffe8724-d316-5e8d-ad9f-d8e88175813b', now() - interval '6540 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (3, '5f4f229a-6cfa-5526-a247-9af73f0ddfac', now() - interval '6540 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (3, '060f5271-f706-527b-a54d-0a93dc586f1f', now() - interval '6540 minutes');
insert into public.forum_posts (id, user_id, category, title, body, game_id, game_title, created_at) overriding system value values (4, 'd3d6ceca-5841-5327-ac09-725c9f68a52a', '질문', 'Enshrouded 협동으로 하면 재밌나요?', '친구 두 명이랑 같이 할 만한 생존 게임을 찾고 있어요. 혼자서도 괜찮은지, 인원이 늘면 어떤 점이 달라지는지 아시는 분 있으면 알려주세요.', 44, 'Enshrouded', now() - interval '5880 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (4, '6928ad6a-5069-596a-a12a-1318c44eb31e', '생존 게임은 인원이 있으면 역할 분담이 되니까 확실히 편해요. 건축 담당, 채집 담당 이런 식으로요.', now() - interval '5640 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (4, '060f5271-f706-527b-a54d-0a93dc586f1f', '상세 페이지에서 스크린샷부터 보세요. 분위기가 맞는지 확인하기 좋아요.', now() - interval '5400 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (4, '6928ad6a-5069-596a-a12a-1318c44eb31e', now() - interval '5820 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (4, '060f5271-f706-527b-a54d-0a93dc586f1f', now() - interval '5820 minutes');
insert into public.forum_posts (id, user_id, category, title, body, game_id, game_title, created_at) overriding system value values (5, 'fffe8724-d316-5e8d-ad9f-d8e88175813b', '질문', 'POE2 처음인데 첫 캐릭터는 뭐로 시작하나요?', '전작은 안 해봤고 이 장르가 처음이에요. 너무 복잡하다고 들어서 겁나는데, 초보가 시작하기 좋은 방식이 있을까요?', 7, 'Path of Exile 2', now() - interval '5400 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (5, '50c9c8e5-cc89-574a-a4e3-764b3748baaf', '처음에는 빌드 욕심 내지 말고 스토리 따라가면서 손에 맞는 걸 찾는 게 제일 편해요.', now() - interval '5340 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (5, 'a93727cd-905e-5043-acba-5f83aaf77bcd', '저는 가이드 영상 한두 개만 보고 시작했어요. 너무 많이 보면 오히려 재미가 줄더라고요.', now() - interval '5190 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (5, 'fffe8724-d316-5e8d-ad9f-d8e88175813b', '맞아요… 일단 부딪혀 볼게요. 고맙습니다!', now() - interval '5040 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (5, 'a93727cd-905e-5043-acba-5f83aaf77bcd', now() - interval '5340 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (5, '9902d259-b4fa-5985-a1f7-7e6307d3f119', now() - interval '5340 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (5, '50c9c8e5-cc89-574a-a4e3-764b3748baaf', now() - interval '5340 minutes');
insert into public.forum_posts (id, user_id, category, title, body, game_id, game_title, created_at) overriding system value values (6, '50c9c8e5-cc89-574a-a4e3-764b3748baaf', '공략', '게임 살 때 저만의 체크리스트', '1) 출시 직후 말고 첫 패치 이후에 사기
2) 스토어 가격이 평소보다 높은지 낮은지 확인하기
3) 스크린샷이랑 트레일러 먼저 보고 분위기 맞는지 보기
4) 플랫폼별 가격이 다를 수 있으니 같이 비교하기

이 사이트 상세 화면에 스토어 링크가 같이 있어서 비교하기 편하더라고요.', null, null, now() - interval '5040 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (6, '745adb23-3c04-5eab-aaa3-59679ab3b1c0', '2번이 중요하죠. 할인 중인지 아닌지 모르고 샀다가 며칠 뒤에 세일해서 속상했던 적 있어요 ㅠㅠ', now() - interval '4920 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (6, '5ee27912-e50a-5efb-a3cc-76e360387f8c', '저장해 둡니다. 특히 1번은 맞는 말이에요.', now() - interval '4740 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (6, 'a5551307-4a54-5d73-a42f-351818eb85d3', now() - interval '4980 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (6, '745adb23-3c04-5eab-aaa3-59679ab3b1c0', now() - interval '4980 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (6, 'bc0835ac-9639-5696-afe8-29955c690b92', now() - interval '4980 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (6, '5ee27912-e50a-5efb-a3cc-76e360387f8c', now() - interval '4980 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (6, '060f5271-f706-527b-a54d-0a93dc586f1f', now() - interval '4980 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (6, 'd3d6ceca-5841-5327-ac09-725c9f68a52a', now() - interval '4980 minutes');
insert into public.forum_posts (id, user_id, category, title, body, game_id, game_title, created_at) overriding system value values (7, '0b674842-ed77-5c8b-a305-31386f8ba090', '자유', '울버린 기다리는 분 계세요?', 'PS5 독점이라 PC 쪽은 어떻게 될지 모르겠지만, 액션이 어떻게 나올지 기대가 커요. 인섬니악 게임 좋아하시는 분들 이야기 들어보고 싶어요.', 45, 'Marvel''s Wolverine', now() - interval '4560 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (7, '8ec9724d-e90f-5617-a5bd-9aa3c1e243fe', '저도 기다리는 중이에요. 스토리 중심 게임을 좋아해서요.', now() - interval '4380 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (7, 'a12a49d2-93ad-5751-a0a6-380fc921cf29', '일단 트레일러 보고 결정하려고요. 메인 화면에서 나오는 거 봤는데 분위기 좋아 보였어요.', now() - interval '4140 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (7, '8ec9724d-e90f-5617-a5bd-9aa3c1e243fe', now() - interval '4500 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (7, 'a12a49d2-93ad-5751-a0a6-380fc921cf29', now() - interval '4500 minutes');
insert into public.forum_posts (id, user_id, category, title, body, game_id, game_title, created_at) overriding system value values (8, '8ec9724d-e90f-5617-a5bd-9aa3c1e243fe', '추천', '운전 게임 좋아하시는 분들, 일본 배경 기대되지 않으세요?', '시리즈를 좋아해서 이번엔 일본이 배경이라는 소식에 반가웠어요. 드라이브하면서 풍경 구경하는 걸 좋아해서 기대 중입니다. 레이싱 게임 추천도 환영이에요!', 51, 'Forza Horizon 6', now() - interval '4200 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (8, 'c43cf929-0018-52b8-a053-ef7428a0f4fc', '레이싱 게임은 핸들 컨트롤러 있으면 느낌이 확 달라져요. 한 번 써보면 못 돌아와요 ㅋㅋ', now() - interval '4080 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (8, '5f4f229a-6cfa-5526-a247-9af73f0ddfac', '저는 풍경 감상용으로 켜는 편이에요. 사진 모드 열심히 찍습니다.', now() - interval '3840 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (8, '0b674842-ed77-5c8b-a305-31386f8ba090', now() - interval '4140 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (8, 'c43cf929-0018-52b8-a053-ef7428a0f4fc', now() - interval '4140 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (8, 'b13c48b3-cd14-5295-afc6-b73cc98f501a', now() - interval '4140 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (8, '5f4f229a-6cfa-5526-a247-9af73f0ddfac', now() - interval '4140 minutes');
insert into public.forum_posts (id, user_id, category, title, body, game_id, game_title, created_at) overriding system value values (9, '745adb23-3c04-5eab-aaa3-59679ab3b1c0', '질문', '게임 가격은 어디서 비교하세요?', '이 사이트 상세 화면에서 스팀 가격이랑 링크가 같이 나오는 건 편한데, 콘솔 게임은 가격이 안 나오더라고요. 콘솔 쪽 가격은 보통 어디서 확인하세요?', null, null, now() - interval '3720 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (9, '50c9c8e5-cc89-574a-a4e3-764b3748baaf', '콘솔은 각 스토어 앱에서 직접 확인하는 게 제일 정확해요. 상세 화면에 스토어 링크 버튼이 있으니까 거기서 바로 넘어가면 됩니다.', now() - interval '3630 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (9, '745adb23-3c04-5eab-aaa3-59679ab3b1c0', '아, 링크 버튼으로 가면 되는군요. 감사합니다!', now() - interval '3480 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (9, '50c9c8e5-cc89-574a-a4e3-764b3748baaf', now() - interval '3660 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (9, 'fffe8724-d316-5e8d-ad9f-d8e88175813b', now() - interval '3660 minutes');
insert into public.forum_posts (id, user_id, category, title, body, game_id, game_title, created_at) overriding system value values (10, 'a93727cd-905e-5043-acba-5f83aaf77bcd', '자유', '이번 달 출시 캘린더 보다가 지갑 닫는 중', '이번 달 출시작이 너무 많아서 뭐부터 해야 할지 모르겠어요 ㅋㅋ 백로그도 아직 안 끝났는데… 다들 어떻게 우선순위 정하세요?', null, null, now() - interval '3300 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (10, '8e28afcb-e03d-548d-a62a-cc97ca600987', '저는 관심 게임에 별표 눌러놓고 거기서만 골라요. 로그인하면 계정에 저장돼서 편해요.', now() - interval '3240 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (10, 'c4ab29c4-5dd0-5c82-a69c-a930111f4066', '백로그는 포기했습니다 ㅎㅎ 지금 재밌는 것만 해요.', now() - interval '3150 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (10, '6928ad6a-5069-596a-a12a-1318c44eb31e', '출시 한 달 뒤에 사는 게 제일 마음 편한 것 같아요. 세일도 하고 패치도 되고요.', now() - interval '2820 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (10, 'a5551307-4a54-5d73-a42f-351818eb85d3', now() - interval '3240 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (10, 'd3d6ceca-5841-5327-ac09-725c9f68a52a', now() - interval '3240 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (10, '8e28afcb-e03d-548d-a62a-cc97ca600987', now() - interval '3240 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (10, 'c4ab29c4-5dd0-5c82-a69c-a930111f4066', now() - interval '3240 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (10, '6928ad6a-5069-596a-a12a-1318c44eb31e', now() - interval '3240 minutes');
insert into public.forum_posts (id, user_id, category, title, body, game_id, game_title, created_at) overriding system value values (11, 'ffe610d3-e18a-5313-a35f-e3fd6f2cf21f', '질문', '007 First Light는 어떤 스타일의 게임인가요?', '스텔스 위주라고 얼핏 들었는데 정확히 어떤 느낌인지 궁금해요. 이런 장르 안 해본 사람도 할 만한지 아시는 분 있나요?', 42, '007 First Light', now() - interval '2880 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (11, '5ee27912-e50a-5efb-a3cc-76e360387f8c', '저도 정확히는 몰라서 트레일러만 봤어요. 상세 페이지에서 설명이랑 스크린샷 보면 분위기는 대략 알 수 있어요.', now() - interval '2580 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (11, '5ee27912-e50a-5efb-a3cc-76e360387f8c', now() - interval '2820 minutes');
insert into public.forum_posts (id, user_id, category, title, body, game_id, game_title, created_at) overriding system value values (12, '8e28afcb-e03d-548d-a62a-cc97ca600987', '질문', 'Fable 시리즈 처음인데 이전 작품부터 해야 하나요?', '이번 작품으로 처음 입문해 보려고 하는데, 이전 시리즈를 안 해도 스토리를 따라갈 수 있을까요?', 8, 'Fable', now() - interval '2460 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (12, '8ec9724d-e90f-5617-a5bd-9aa3c1e243fe', '보통은 새 작품으로 시작해도 괜찮게 만들어요. 다만 이전 작품을 알면 소소한 재미가 더 있겠죠.', now() - interval '2340 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (12, '8e28afcb-e03d-548d-a62a-cc97ca600987', '그렇군요, 일단 새 작품으로 시작해 볼게요!', now() - interval '2280 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (12, '8ec9724d-e90f-5617-a5bd-9aa3c1e243fe', now() - interval '2400 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (12, '060f5271-f706-527b-a54d-0a93dc586f1f', now() - interval '2400 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (12, 'b13c48b3-cd14-5295-afc6-b73cc98f501a', now() - interval '2400 minutes');
insert into public.forum_posts (id, user_id, category, title, body, game_id, game_title, created_at) overriding system value values (13, '6928ad6a-5069-596a-a12a-1318c44eb31e', '추천', '잔잔한 분위기의 게임 추천해 주세요', '요즘 너무 시끄러운 액션 게임만 해서 지쳤어요. 음악 좋고 천천히 즐길 수 있는 게임 있으면 추천 부탁드려요. 플랫폼은 가리지 않아요.', null, null, now() - interval '2040 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (13, '9902d259-b4fa-5985-a1f7-7e6307d3f119', '퍼즐이나 탐험 위주의 인디 게임이 잔잔한 게 많아요. 이 사이트에서 장르를 Puzzle이나 Adventure로 걸러보세요.', now() - interval '1968 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (13, '5ee27912-e50a-5efb-a3cc-76e360387f8c', '건축이나 농사 게임도 좋아요. 아무 생각 없이 하기 좋아요.', now() - interval '1860 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (13, '6928ad6a-5069-596a-a12a-1318c44eb31e', '장르 필터 써볼게요! 감사합니다 :)', now() - interval '1800 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (13, 'a5551307-4a54-5d73-a42f-351818eb85d3', now() - interval '1980 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (13, '9902d259-b4fa-5985-a1f7-7e6307d3f119', now() - interval '1980 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (13, 'd3d6ceca-5841-5327-ac09-725c9f68a52a', now() - interval '1980 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (13, '5ee27912-e50a-5efb-a3cc-76e360387f8c', now() - interval '1980 minutes');
insert into public.forum_posts (id, user_id, category, title, body, game_id, game_title, created_at) overriding system value values (14, '5f4f229a-6cfa-5526-a247-9af73f0ddfac', '질문', '아직 개발 중인 게임은 지금 사도 괜찮을까요?', '얼리 액세스 게임은 언제 사는 게 좋은지 항상 고민돼요. 지금 해도 되는지, 정식 출시까지 기다리는 게 나은지 여러분 의견이 궁금합니다.', 9, 'No Rest for the Wicked', now() - interval '1620 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (14, 'bc0835ac-9639-5696-afe8-29955c690b92', '저는 정식 출시까지 기다리는 편이에요. 개발 중에는 내용이 바뀔 수 있어서요.', now() - interval '1500 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (14, 'fffe8724-d316-5e8d-ad9f-d8e88175813b', '개발 방향이 마음에 들면 지금 사도 좋은데, 저는 후기를 좀 더 보고 결정하려고요.', now() - interval '1320 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (14, 'bc0835ac-9639-5696-afe8-29955c690b92', now() - interval '1560 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (14, 'fffe8724-d316-5e8d-ad9f-d8e88175813b', now() - interval '1560 minutes');
insert into public.forum_posts (id, user_id, category, title, body, game_id, game_title, created_at) overriding system value values (15, '5ee27912-e50a-5efb-a3cc-76e360387f8c', '자유', '포럼 처음 써봐요, 인사드립니다!', '게임 정보 보다가 포럼이 있길래 가입했어요. 앞으로 잘 부탁드립니다. 고양이 키우면서 게임하는 분들 계시면 반가워요 🐱', null, null, now() - interval '1200 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (15, 'a5551307-4a54-5d73-a42f-351818eb85d3', '환영해요! 저도 집사입니다 ㅎㅎ 키보드 위에 올라오는 거 공감해요.', now() - interval '1170 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (15, 'c43cf929-0018-52b8-a053-ef7428a0f4fc', '반갑습니다~ 편하게 이야기 나눠요.', now() - interval '1140 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (15, '5ee27912-e50a-5efb-a3cc-76e360387f8c', '다들 따뜻하게 맞아주셔서 감사해요!', now() - interval '1116 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (15, 'a5551307-4a54-5d73-a42f-351818eb85d3', now() - interval '1140 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (15, '060f5271-f706-527b-a54d-0a93dc586f1f', now() - interval '1140 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (15, 'c43cf929-0018-52b8-a053-ef7428a0f4fc', now() - interval '1140 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (15, 'c4ab29c4-5dd0-5c82-a69c-a930111f4066', now() - interval '1140 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (15, 'd3d6ceca-5841-5327-ac09-725c9f68a52a', now() - interval '1140 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (15, '8e28afcb-e03d-548d-a62a-cc97ca600987', now() - interval '1140 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (15, '5f4f229a-6cfa-5526-a247-9af73f0ddfac', now() - interval '1140 minutes');
insert into public.forum_posts (id, user_id, category, title, body, game_id, game_title, created_at) overriding system value values (16, 'c4ab29c4-5dd0-5c82-a69c-a930111f4066', '질문', 'Gears E-Day도 협동으로 즐길 수 있나요?', '시리즈 협동 플레이를 좋아해서요. 이번 작품도 친구랑 같이 할 수 있는지 아시는 분 계시면 알려주세요.', 61, 'Gears of War: E-Day', now() - interval '720 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (16, '0b674842-ed77-5c8b-a305-31386f8ba090', '시리즈 전통이니 기대는 하는데, 확정 정보는 공식 페이지에서 확인해 보세요. 상세 화면에 스토어 링크가 있어요.', now() - interval '540 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (16, '0b674842-ed77-5c8b-a305-31386f8ba090', now() - interval '660 minutes');
insert into public.forum_posts (id, user_id, category, title, body, game_id, game_title, created_at) overriding system value values (17, 'b13c48b3-cd14-5295-afc6-b73cc98f501a', '자유', '게임하다 시간 순삭된 경험 있나요?', '분명히 한 시간만 하려고 켰는데 눈 떠보니 새벽 세 시였던 적 다들 있죠? 제일 심했던 게임 이야기해 봐요 ㅋㅋ', null, null, now() - interval '360 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (17, 'a12a49d2-93ad-5751-a0a6-380fc921cf29', '저는 건축 게임이요. 벽 하나만 더 세우자가 계속 이어져요.', now() - interval '324 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (17, 'a93727cd-905e-5043-acba-5f83aaf77bcd', '다음 날 출근 생각하면 후회하는데 또 하게 되는 마법 ㅠㅠ', now() - interval '294 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (17, '50c9c8e5-cc89-574a-a4e3-764b3748baaf', now() - interval '300 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (17, 'a12a49d2-93ad-5751-a0a6-380fc921cf29', now() - interval '300 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (17, 'a93727cd-905e-5043-acba-5f83aaf77bcd', now() - interval '300 minutes');
insert into public.forum_posts (id, user_id, category, title, body, game_id, game_title, created_at) overriding system value values (18, 'c43cf929-0018-52b8-a053-ef7428a0f4fc', '공략', '게임 시작 전에 꼭 확인하는 설정 3가지', '1) 화면 밝기/HDR 설정부터 맞추기
2) 조작 키 한 번 훑어보기
3) 자막과 음성 언어 확인하기

이 세 가지만 확인해도 초반 몰입감이 달라져요. 여러분만의 설정 팁도 알려주세요!', null, null, now() - interval '180 minutes');
insert into public.forum_comments (post_id, user_id, body, created_at) values (18, '8e28afcb-e03d-548d-a62a-cc97ca600987', '저는 4번으로 사운드 밸런스 추가요. 효과음만 너무 크면 대사가 안 들려요.', now() - interval '132 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (18, '5ee27912-e50a-5efb-a3cc-76e360387f8c', now() - interval '120 minutes');
insert into public.forum_likes (post_id, user_id, created_at) values (18, '8e28afcb-e03d-548d-a62a-cc97ca600987', now() - interval '120 minutes');

-- 직접 지정한 글 번호 때문에 다음 새 글 번호가 겹치지 않게 맞춘다
select setval(pg_get_serial_sequence('public.forum_posts', 'id'), (select greatest(max(id), 1) from public.forum_posts));
commit;
