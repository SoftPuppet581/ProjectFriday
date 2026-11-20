import express from 'express';
import cors from 'cors';
import gamesRouter from './routes/games.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/games', gamesRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
