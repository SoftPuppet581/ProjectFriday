import HttpError from '../utils/HttpError.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(value) {
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

const isText = (v, max, nonEmpty = false) => typeof v === 'string' && v.length <= max && (!nonEmpty || v.trim() !== '');
const isUrl = (v) => typeof v === 'string' && v.length <= 500 && isHttpUrl(v);

const TYPES = {
  title: (v) => isText(v, 200, true),
  date: isValidDate,
  url: isUrl,
  text50: (v) => isText(v, 50),
  text200: (v) => isText(v, 200),
  longText: (v) => isText(v, 20000),
  platforms: (v) => Array.isArray(v) && v.length >= 1 && v.length <= 30 && v.every((x) => isText(x, 100, true)),
  stringArray: (v) => Array.isArray(v) && v.length <= 50 && v.every((x) => isText(x, 200, true)),
  urlArray: (v) => Array.isArray(v) && v.length <= 50 && v.every(isUrl),
  rating: (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 5,
  metacritic: (v) => Number.isInteger(v) && v >= 0 && v <= 100,
  uint: (v) => Number.isInteger(v) && v >= 0 && v <= 4294967295,
  positiveInt: (v) => Number.isInteger(v) && v >= 1 && v <= 4294967295,
};

// required: POST/PUT에서 반드시 있어야 하는 필드. 나머지는 없어도 되고 null로 비울 수 있다
const SPEC = {
  title: { type: 'title', required: true, message: '1~200자의 문자열이 필요합니다.' },
  releaseDate: { type: 'date', required: true, message: 'YYYY-MM-DD 형식의 실제 날짜여야 합니다.' },
  platforms: { type: 'platforms', required: true, message: '문자열 1개 이상의 배열이 필요합니다. 예: ["PC","PS5"]' },
  genre: { type: 'text50', message: '50자 이하의 문자열이어야 합니다.' },
  genres: { type: 'stringArray', message: '문자열 배열이어야 합니다.' },
  description: { type: 'longText', message: '20000자 이하의 문자열이어야 합니다.' },
  trailerUrl: { type: 'url', message: 'http 또는 https 주소(500자 이하)여야 합니다.' },
  coverImageUrl: { type: 'url', message: 'http 또는 https 주소(500자 이하)여야 합니다.' },
  officialUrl: { type: 'url', message: 'http 또는 https 주소(500자 이하)여야 합니다.' },
  sourceUrl: { type: 'url', message: 'http 또는 https 주소(500자 이하)여야 합니다.' },
  tags: { type: 'stringArray', message: '문자열 배열이어야 합니다.' },
  developers: { type: 'stringArray', message: '문자열 배열이어야 합니다.' },
  publishers: { type: 'stringArray', message: '문자열 배열이어야 합니다.' },
  screenshots: { type: 'urlArray', message: 'http 또는 https 주소의 배열이어야 합니다.' },
  rating: { type: 'rating', message: '0~5 사이의 숫자여야 합니다.' },
  ratingsCount: { type: 'uint', message: '0 이상의 정수여야 합니다.' },
  metacritic: { type: 'metacritic', message: '0~100 사이의 정수여야 합니다.' },
  esrbRating: { type: 'text50', message: '50자 이하의 문자열이어야 합니다.' },
  playtime: { type: 'uint', message: '0 이상의 정수여야 합니다.' },
  popularity: { type: 'uint', message: '0 이상의 정수여야 합니다.' },
  externalId: { type: 'positiveInt', message: '1 이상의 정수여야 합니다.' },
  slug: { type: 'text200', message: '200자 이하의 문자열이어야 합니다.' },
  source: { type: 'text50', message: '50자 이하의 문자열이어야 합니다.' },
};

// requireAll=true: POST/PUT (필수값 검사), false: PATCH (보낸 필드만 검사)
function validate(body, requireAll) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, '요청 본문은 JSON 객체여야 합니다.');
  }

  const errors = [];
  for (const key of Object.keys(body)) {
    if (!(key in SPEC)) errors.push({ field: key, message: '알 수 없는 필드입니다.' });
  }

  for (const [field, spec] of Object.entries(SPEC)) {
    const value = body[field];
    const present = value !== undefined;
    if (spec.required) {
      if ((requireAll || present) && !TYPES[spec.type](value)) errors.push({ field, message: spec.message });
    } else if (present && value !== null && !TYPES[spec.type](value)) {
      errors.push({ field, message: spec.message });
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

const asString = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined);

// 목록/달력 쿼리를 검사하고 req.filters에 정리해서 넣는다
export function parseListQuery(req, res, next) {
  const q = req.query;
  const errors = [];
  const filters = {};

  const month = asString(q.month);
  if (month !== undefined) {
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) filters.month = month;
    else errors.push({ field: 'month', message: 'YYYY-MM 형식이어야 합니다.' });
  }
  for (const field of ['from', 'to']) {
    const value = asString(q[field]);
    if (value !== undefined) {
      if (isValidDate(value)) filters[field] = value;
      else errors.push({ field, message: 'YYYY-MM-DD 형식의 실제 날짜여야 합니다.' });
    }
  }
  for (const field of ['platform', 'genre']) {
    const value = asString(q[field]);
    if (value !== undefined) filters[field] = value;
  }
  const search = asString(q.q);
  if (search !== undefined) {
    if (search.length <= 100) filters.q = search;
    else errors.push({ field: 'q', message: '100자 이하여야 합니다.' });
  }
  const ids = asString(q.ids);
  if (ids !== undefined) {
    const list = ids.split(',');
    if (list.length <= 100 && list.every((x) => /^[1-9]\d*$/.test(x))) filters.ids = list.map(Number);
    else errors.push({ field: 'ids', message: '쉼표로 구분한 양의 정수 100개 이하여야 합니다. 예: 1,2,3' });
  }
  const minRating = asString(q.minRating);
  if (minRating !== undefined) {
    const n = Number(minRating);
    if (Number.isFinite(n) && n >= 0 && n <= 5) filters.minRating = n;
    else errors.push({ field: 'minRating', message: '0~5 사이의 숫자여야 합니다.' });
  }
  const sort = asString(q.sort);
  if (sort !== undefined) filters.sort = sort;

  const limit = asString(q.limit);
  if (limit !== undefined) {
    if (/^\d+$/.test(limit) && Number(limit) >= 1 && Number(limit) <= 200) filters.limit = Number(limit);
    else errors.push({ field: 'limit', message: '1~200 사이의 정수여야 합니다.' });
  }
  const page = asString(q.page);
  if (page !== undefined) {
    if (/^[1-9]\d*$/.test(page) && Number(page) <= 100000) filters.page = Number(page);
    else errors.push({ field: 'page', message: '1 이상의 정수여야 합니다.' });
  }
  const top = asString(q.top);
  if (top !== undefined) {
    if (/^\d+$/.test(top) && Number(top) >= 1 && Number(top) <= 10) filters.top = Number(top);
    else errors.push({ field: 'top', message: '1~10 사이의 정수여야 합니다.' });
  }

  if (errors.length) throw new HttpError(400, '입력값이 올바르지 않습니다.', errors);

  if (filters.page !== undefined || filters.limit !== undefined) {
    const size = filters.limit ?? 50;
    filters.limit = size;
    filters.offset = ((filters.page ?? 1) - 1) * size;
  }
  delete filters.page;
  req.filters = filters;
  next();
}

// 달력 요약은 기간(month 또는 from/to)이 꼭 있어야 한다
export function requireDateRange(req, res, next) {
  const f = req.filters;
  if (!f.month && !f.from && !f.to) {
    throw new HttpError(400, '입력값이 올바르지 않습니다.', [
      { field: 'month', message: 'month(YYYY-MM) 또는 from/to 중 하나가 필요합니다.' },
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
