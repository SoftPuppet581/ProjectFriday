import HttpError from '../utils/HttpError.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function isHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

const OPTIONAL_TEXT = { genre: 50, description: 5000 };
const OPTIONAL_URLS = ['trailerUrl', 'coverImageUrl', 'officialUrl'];
const ALLOWED = ['title', 'releaseDate', 'platforms', 'genre', 'description', ...OPTIONAL_URLS];

// requireAll=true: POST/PUT (필수값 검사), false: PATCH (보낸 필드만 검사)
function validate(body, requireAll) {
  const errors = [];
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, '요청 본문은 JSON 객체여야 합니다.');
  }

  for (const key of Object.keys(body)) {
    if (!ALLOWED.includes(key)) errors.push({ field: key, message: '알 수 없는 필드입니다.' });
  }

  const has = (f) => body[f] !== undefined;

  if (requireAll || has('title')) {
    if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 200) {
      errors.push({ field: 'title', message: '1~200자의 문자열이 필요합니다.' });
    }
  }
  if (requireAll || has('releaseDate')) {
    if (!isValidDate(body.releaseDate)) {
      errors.push({ field: 'releaseDate', message: 'YYYY-MM-DD 형식의 실제 날짜여야 합니다.' });
    }
  }
  if (requireAll || has('platforms')) {
    const p = body.platforms;
    if (!Array.isArray(p) || p.length === 0 || p.some((x) => typeof x !== 'string' || !x.trim())) {
      errors.push({ field: 'platforms', message: '문자열 1개 이상의 배열이 필요합니다. 예: ["PC","PS5"]' });
    }
  }
  for (const [field, max] of Object.entries(OPTIONAL_TEXT)) {
    if (has(field) && body[field] !== null) {
      if (typeof body[field] !== 'string' || body[field].length > max) {
        errors.push({ field, message: `${max}자 이하의 문자열이어야 합니다.` });
      }
    }
  }
  for (const field of OPTIONAL_URLS) {
    if (has(field) && body[field] !== null) {
      if (typeof body[field] !== 'string' || body[field].length > 500 || !isHttpUrl(body[field])) {
        errors.push({ field, message: 'http 또는 https 주소(500자 이하)여야 합니다.' });
      }
    }
  }

  if (errors.length) throw new HttpError(400, '입력값이 올바르지 않습니다.', errors);
}

export const validateCreateOrReplace = (req, res, next) => {
  validate(req.body, true);
  next();
};

export const validatePatch = (req, res, next) => {
  validate(req.body, false);
  next();
};

export function validateListQuery(req, res, next) {
  const { month } = req.query;
  if (month !== undefined && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new HttpError(400, '입력값이 올바르지 않습니다.', [
      { field: 'month', message: 'YYYY-MM 형식이어야 합니다.' },
    ]);
  }
  next();
}

export function validateId(req, res, next) {
  if (!/^[1-9]\d*$/.test(req.params.id)) {
    throw new HttpError(400, 'id는 양의 정수여야 합니다.', [{ field: 'id', message: '양의 정수' }]);
  }
  next();
}
