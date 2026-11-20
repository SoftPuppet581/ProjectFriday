-- 화면 확인용 가짜 샘플 게임을 지운다. 실제 데이터를 가져오기 전후에 실행한다.
DELETE FROM games WHERE title LIKE '[샘플]%' OR source = 'sample';
