import HttpError from '../utils/HttpError.js';

// 로그인 시도 횟수 제한 (메모리, 서버를 다시 켜면 초기화). 비밀번호 무작위 대입을 늦추는 최소한의 장치다.
const attempts = new Map();
const MAX_FAILURES = 8;
const WINDOW_MS = 10 * 60 * 1000;

export const resetRateLimits = () => attempts.clear();

const keyOf = (req) => `${req.ip}|${String(req.body?.email ?? '').trim().toLowerCase()}`;

function current(key, now) {
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) return { count: 0, resetAt: now + WINDOW_MS };
  return entry;
}

export function loginRateLimit(req, res, next) {
  const entry = current(keyOf(req), Date.now());
  if (entry.count >= MAX_FAILURES) {
    res.set('Retry-After', String(Math.ceil((entry.resetAt - Date.now()) / 1000)));
    throw new HttpError(429, '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.');
  }
  next();
}

export function recordLoginFailure(req) {
  const key = keyOf(req);
  const entry = current(key, Date.now());
  attempts.set(key, { count: entry.count + 1, resetAt: entry.resetAt });
}

export const clearLoginFailures = (req) => attempts.delete(keyOf(req));
