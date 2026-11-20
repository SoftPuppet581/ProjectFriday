import HttpError from '../utils/HttpError.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function readBody(req, allowed) {
  const body = req.body;
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, '요청 본문은 JSON 객체여야 합니다.');
  }
  const errors = Object.keys(body).filter((k) => !allowed.includes(k)).map((field) => ({ field, message: '알 수 없는 필드입니다.' }));
  return { body, errors };
}

const fail = (errors) => {
  throw new HttpError(400, '입력값이 올바르지 않습니다.', errors);
};

function checkEmail(value, errors) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!email || email.length > 190 || !EMAIL_RE.test(email)) errors.push({ field: 'email', message: '올바른 이메일 주소를 입력해 주세요.' });
  return email;
}

function checkDisplayName(value, errors) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name || [...name].length > 40) errors.push({ field: 'displayName', message: '닉네임은 1~40자로 입력해 주세요.' });
  return name;
}

export function validateSignup(req, res, next) {
  const { body, errors } = readBody(req, ['email', 'password', 'displayName']);
  const email = checkEmail(body.email, errors);
  const displayName = checkDisplayName(body.displayName, errors);
  const password = body.password;
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    errors.push({ field: 'password', message: '비밀번호는 8~128자로 입력해 주세요.' });
  } else if (!/[A-Za-z가-힣]/.test(password) || !/\d/.test(password)) {
    errors.push({ field: 'password', message: '비밀번호에 글자와 숫자를 모두 넣어 주세요.' });
  }
  if (errors.length) fail(errors);
  req.credentials = { email, displayName, password };
  next();
}

export function validateLogin(req, res, next) {
  const { body, errors } = readBody(req, ['email', 'password']);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email) errors.push({ field: 'email', message: '이메일을 입력해 주세요.' });
  if (typeof body.password !== 'string' || !body.password) errors.push({ field: 'password', message: '비밀번호를 입력해 주세요.' });
  if (errors.length) fail(errors);
  req.credentials = { email, password: body.password };
  next();
}

export function validateProfile(req, res, next) {
  const { body, errors } = readBody(req, ['displayName', 'preferredPlatform']);
  const changes = {};
  if (body.displayName !== undefined) changes.displayName = checkDisplayName(body.displayName, errors);
  if (body.preferredPlatform !== undefined) {
    const p = body.preferredPlatform;
    if (p !== null && (typeof p !== 'string' || !p.trim() || p.length > 50)) errors.push({ field: 'preferredPlatform', message: '50자 이하의 문자열이거나 null이어야 합니다.' });
    else changes.preferredPlatform = p === null ? null : p.trim();
  }
  if (errors.length) fail(errors);
  req.profileChanges = changes;
  next();
}

export function validateFavoriteIds(req, res, next) {
  const { body, errors } = readBody(req, ['gameIds']);
  const ids = body.gameIds;
  if (!Array.isArray(ids) || ids.length > 500 || !ids.every((id) => Number.isInteger(id) && id > 0)) {
    errors.push({ field: 'gameIds', message: '양의 정수 500개 이하의 배열이어야 합니다.' });
  }
  if (errors.length) fail(errors);
  req.gameIds = [...new Set(ids)];
  next();
}

export function validateGameIdParam(req, res, next) {
  if (!/^[1-9]\d*$/.test(req.params.gameId)) {
    throw new HttpError(400, 'gameId는 양의 정수여야 합니다.', [{ field: 'gameId', message: '양의 정수' }]);
  }
  req.gameId = Number(req.params.gameId);
  next();
}
