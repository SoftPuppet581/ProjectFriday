import { Router } from 'express';
import * as controller from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { loginRateLimit } from '../middleware/rateLimit.js';
import { validateSignup, validateLogin, validateProfile, validateFavoriteIds, validateGameIdParam } from '../middleware/validateAuth.js';

// /api/users : 회원가입, 내 정보, 내 관심 게임
export const usersRouter = Router();
usersRouter.post('/', validateSignup, controller.signup);
usersRouter.get('/me', requireAuth, controller.me);
usersRouter.patch('/me', requireAuth, validateProfile, controller.updateMe);
usersRouter.get('/me/favorites', requireAuth, controller.listFavorites);
usersRouter.get('/me/favorites/ids', requireAuth, controller.listFavoriteIds);
usersRouter.post('/me/favorites', requireAuth, validateFavoriteIds, controller.addFavorites);
usersRouter.put('/me/favorites/:gameId', requireAuth, validateGameIdParam, controller.addFavorite);
usersRouter.delete('/me/favorites/:gameId', requireAuth, validateGameIdParam, controller.removeFavorite);

// /api/sessions : 로그인(세션 만들기), 로그아웃(현재 세션 지우기)
export const sessionsRouter = Router();
sessionsRouter.post('/', validateLogin, loginRateLimit, controller.login);
sessionsRouter.delete('/current', requireAuth, controller.logout);
