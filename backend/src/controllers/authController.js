import * as User from '../models/User.js';
import HttpError from '../utils/HttpError.js';
import { hashPassword, verifyPassword, newToken, hashToken } from '../services/passwords.js';
import { recordLoginFailure, clearLoginFailures } from '../middleware/rateLimit.js';

// 가입하거나 로그인에 성공하면 토큰을 만들어 사용자 정보와 함께 돌려준다 (비밀번호 해시는 절대 포함하지 않는다)
async function startSession(user) {
  const token = newToken();
  const expiresAt = await User.createSession(user.id, hashToken(token));
  return { token, expiresAt, user };
}

const publicUser = ({ passwordHash, ...user }) => user;

export async function signup(req, res) {
  const { email, displayName, password } = req.credentials;
  let user;
  try {
    user = await User.create({ email, displayName, passwordHash: await hashPassword(password) });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new HttpError(409, '이미 가입된 이메일입니다.', [{ field: 'email', message: '이미 가입된 이메일입니다.' }]);
    }
    throw error;
  }
  res.status(201).location('/api/users/me').json(await startSession(user));
}

// 이메일이 없든 비밀번호가 틀리든 같은 메시지를 준다 (가입된 이메일인지 알아내지 못하게)
export async function login(req, res) {
  const { email, password } = req.credentials;
  const account = await User.findCredentialsByEmail(email);
  // 계정이 없어도 해시 계산을 한 번 해서 응답 시간 차이로 가입 여부를 알아내기 어렵게 한다
  const ok = await verifyPassword(password, account?.passwordHash ?? 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==');
  if (!account || !ok) {
    recordLoginFailure(req);
    throw new HttpError(401, '이메일 또는 비밀번호가 올바르지 않습니다.');
  }
  clearLoginFailures(req);
  res.status(201).json(await startSession(publicUser(account)));
}

export async function logout(req, res) {
  await User.deleteSession(req.tokenHash);
  res.status(204).end();
}

export function me(req, res) {
  res.json(req.user);
}

export async function updateMe(req, res) {
  res.json(await User.updateProfile(req.user.id, req.profileChanges));
}

// ---- 관심 게임 ----

export async function listFavorites(req, res) {
  res.json(await User.favoriteGames(req.user.id));
}

export async function listFavoriteIds(req, res) {
  res.json(await User.favoriteIds(req.user.id));
}

// 여러 개를 한 번에 추가한다 (로그인 전에 담아 둔 관심 게임을 계정에 합칠 때). 전체 목록의 id를 돌려준다
export async function addFavorites(req, res) {
  await User.addFavorites(req.user.id, req.gameIds);
  res.json(await User.favoriteIds(req.user.id));
}

export async function addFavorite(req, res) {
  if (!(await User.gameExists(req.gameId))) throw new HttpError(404, `id ${req.gameId} 게임을 찾을 수 없습니다.`);
  await User.addFavorites(req.user.id, [req.gameId]);
  res.status(204).end();
}

export async function removeFavorite(req, res) {
  await User.removeFavorite(req.user.id, req.gameId);
  res.status(204).end();
}
