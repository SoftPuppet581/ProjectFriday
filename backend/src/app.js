import express from 'express';
import cors from 'cors';
import gamesRouter, { calendarRouter, metaRouter } from './routes/games.js';
import newsRouter from './routes/news.js';
import { usersRouter, sessionsRouter } from './routes/users.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

const app = express();

// 쉼표로 여러 주소를 허용한다. Vite가 127.0.0.1로 뜨는 경우도 있어서 둘 다 기본 허용
const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    exposedHeaders: ['X-Total-Count', 'Location'], // 브라우저(React)에서 읽을 수 있게 노출
  }),
);
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/games', gamesRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/news', newsRouter);
app.use('/api/users', usersRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api', metaRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
