import 'dotenv/config';
import app from './app.js';
import { ensureFreshNews } from './services/newsService.js';

const port = Number(process.env.PORT ?? 3000);

// 127.0.0.1에만 열어서 이 컴퓨터 밖에서는 접속되지 않게 한다
app.listen(port, '127.0.0.1', () => {
  console.log(`API 서버 실행 중: http://localhost:${port}`);
  // 켜질 때 뉴스가 오래됐으면 뒤에서 새로 가져온다 (실패해도 서버는 계속 돈다)
  ensureFreshNews().catch((error) => console.error('뉴스 갱신 확인 실패:', error.message));
});
