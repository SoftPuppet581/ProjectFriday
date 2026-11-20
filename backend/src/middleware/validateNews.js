import HttpError from '../utils/HttpError.js';

const asString = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined);

// 뉴스 목록 쿼리를 검사하고 req.newsFilters에 정리해서 넣는다
export function parseNewsQuery(req, res, next) {
  const q = req.query;
  const errors = [];
  const filters = {};

  const source = asString(q.source);
  if (source !== undefined) {
    if (source.length <= 50) filters.source = source;
    else errors.push({ field: 'source', message: '50자 이하여야 합니다.' });
  }
  const language = asString(q.lang);
  if (language !== undefined) {
    if (language === 'ko' || language === 'en') filters.language = language;
    else errors.push({ field: 'lang', message: 'ko 또는 en 이어야 합니다.' });
  }
  const search = asString(q.q);
  if (search !== undefined) {
    if (search.length <= 100) filters.q = search;
    else errors.push({ field: 'q', message: '100자 이하여야 합니다.' });
  }

  let limit = 20;
  const rawLimit = asString(q.limit);
  if (rawLimit !== undefined) {
    if (/^\d+$/.test(rawLimit) && Number(rawLimit) >= 1 && Number(rawLimit) <= 100) limit = Number(rawLimit);
    else errors.push({ field: 'limit', message: '1~100 사이의 정수여야 합니다.' });
  }
  let page = 1;
  const rawPage = asString(q.page);
  if (rawPage !== undefined) {
    if (/^[1-9]\d*$/.test(rawPage) && Number(rawPage) <= 100000) page = Number(rawPage);
    else errors.push({ field: 'page', message: '1 이상의 정수여야 합니다.' });
  }

  if (errors.length) throw new HttpError(400, '입력값이 올바르지 않습니다.', errors);

  req.newsFilters = { ...filters, limit, offset: (page - 1) * limit };
  next();
}
