import HttpError from '../utils/HttpError.js';

export function notFoundHandler(req, res, next) {
  next(new HttpError(404, `${req.method} ${req.originalUrl} 경로가 없습니다.`));
}

// 에러 응답은 항상 { message, errors } 형식으로 통일한다
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message, errors: err.errors });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'JSON 형식이 올바르지 않습니다.', errors: [] });
  }
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      message: '같은 제목과 출시일의 게임이 이미 있습니다.',
      errors: [{ field: 'title', message: '중복' }],
    });
  }

  console.error(err);
  res.status(500).json({ message: '서버 오류가 발생했습니다.', errors: [] });
}
