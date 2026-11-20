import HttpError from '../utils/HttpError.js';
import { CATEGORIES } from '../models/Forum.js';

const asString = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined);
const fail = (errors) => {
  throw new HttpError(400, '입력값이 올바르지 않습니다.', errors);
};

function readBody(req, allowed) {
  const body = req.body;
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, '요청 본문은 JSON 객체여야 합니다.');
  const errors = Object.keys(body).filter((k) => !allowed.includes(k)).map((field) => ({ field, message: '알 수 없는 필드입니다.' }));
  return { body, errors };
}

export function parseForumQuery(req, res, next) {
  const q = req.query;
  const errors = [];
  const filters = {};

  const category = asString(q.category);
  if (category !== undefined) {
    if (CATEGORIES.includes(category)) filters.category = category;
    else errors.push({ field: 'category', message: `${CATEGORIES.join(', ')} 중 하나여야 합니다.` });
  }
  const search = asString(q.q);
  if (search !== undefined) {
    if (search.length <= 100) filters.q = search;
    else errors.push({ field: 'q', message: '100자 이하여야 합니다.' });
  }
  const gameId = asString(q.gameId);
  if (gameId !== undefined) {
    if (/^[1-9]\d*$/.test(gameId)) filters.gameId = Number(gameId);
    else errors.push({ field: 'gameId', message: '양의 정수여야 합니다.' });
  }
  const sort = asString(q.sort);
  if (sort !== undefined) {
    if (sort === 'recent' || sort === 'popular') filters.sort = sort;
    else errors.push({ field: 'sort', message: 'recent 또는 popular 이어야 합니다.' });
  }
  let limit = 20;
  const rawLimit = asString(q.limit);
  if (rawLimit !== undefined) {
    if (/^\d+$/.test(rawLimit) && Number(rawLimit) >= 1 && Number(rawLimit) <= 50) limit = Number(rawLimit);
    else errors.push({ field: 'limit', message: '1~50 사이의 정수여야 합니다.' });
  }
  let page = 1;
  const rawPage = asString(q.page);
  if (rawPage !== undefined) {
    if (/^[1-9]\d*$/.test(rawPage) && Number(rawPage) <= 100000) page = Number(rawPage);
    else errors.push({ field: 'page', message: '1 이상의 정수여야 합니다.' });
  }
  if (errors.length) fail(errors);
  req.forumFilters = { ...filters, limit, offset: (page - 1) * limit };
  next();
}

export function validatePost(req, res, next) {
  const { body, errors } = readBody(req, ['category', 'title', 'body', 'gameId']);
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const text = typeof body.body === 'string' ? body.body.trim() : '';
  if (!CATEGORIES.includes(body.category)) errors.push({ field: 'category', message: `${CATEGORIES.join(', ')} 중 하나여야 합니다.` });
  if (!title || [...title].length > 100) errors.push({ field: 'title', message: '제목은 1~100자로 입력해 주세요.' });
  if (!text || [...text].length > 3000) errors.push({ field: 'body', message: '내용은 1~3000자로 입력해 주세요.' });
  if (body.gameId !== undefined && body.gameId !== null && !(Number.isInteger(body.gameId) && body.gameId > 0)) {
    errors.push({ field: 'gameId', message: '양의 정수이거나 null이어야 합니다.' });
  }
  if (errors.length) fail(errors);
  req.postInput = { category: body.category, title, body: text, gameId: body.gameId ?? null };
  next();
}

export function validateComment(req, res, next) {
  const { body, errors } = readBody(req, ['body']);
  const text = typeof body.body === 'string' ? body.body.trim() : '';
  if (!text || [...text].length > 1000) errors.push({ field: 'body', message: '댓글은 1~1000자로 입력해 주세요.' });
  if (errors.length) fail(errors);
  req.commentInput = { body: text };
  next();
}

export function validateForumIds(req, res, next) {
  for (const name of ['postId', 'commentId']) {
    if (req.params[name] !== undefined && !/^[1-9]\d*$/.test(req.params[name])) {
      throw new HttpError(400, `${name}는 양의 정수여야 합니다.`, [{ field: name, message: '양의 정수' }]);
    }
  }
  req.postId = req.params.postId === undefined ? undefined : Number(req.params.postId);
  req.commentId = req.params.commentId === undefined ? undefined : Number(req.params.commentId);
  next();
}
