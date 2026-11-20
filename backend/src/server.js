import 'dotenv/config';
import app from './app.js';

const port = Number(process.env.PORT ?? 3000);

// 127.0.0.1에만 열어서 이 컴퓨터 밖에서는 접속되지 않게 한다
app.listen(port, '127.0.0.1', () => {
  console.log(`API 서버 실행 중: http://localhost:${port}`);
});
