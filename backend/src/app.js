import express from 'express';
import cors from 'cors';
import gamesRouter, { calendarRouter, metaRouter } from './routes/games.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    exposedHeaders: ['X-Total-Count', 'Location'], // 브라우저(React)에서 읽을 수 있게 노출
  }),
);
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/games', gamesRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api', metaRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
