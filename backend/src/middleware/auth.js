import HttpError from '../utils/HttpError.js';
import { hashToken } from '../services/passwords.js';
import * as User from '../models/User.js';

const bearer = (req) => /^Bearer\s+([\w-]{20,200})$/.exec(req.get('Authorization') ?? '')?.[1] ?? null;

// 로그인했으면 req.user를 채우고, 아니어도 통과시킨다 (글 목록에서 "내가 좋아요 했는지" 같은 것만 달라질 때)
export async function optionalAuth(req, res, next) {
  const token = bearer(req);
  req.user = token ? await User.findUserBySession(hashToken(token)) : null;
  next();
}

// 로그인한 사용자만 통과시킨다. req.user, req.tokenHash 를 채운다
export async function requireAuth(req, res, next) {
  const token = bearer(req);
  const user = token ? await User.findUserBySession(hashToken(token)) : null;
  if (!user) throw new HttpError(401, '로그인이 필요합니다.');
  req.user = user;
  req.tokenHash = hashToken(token);
  next();
}
