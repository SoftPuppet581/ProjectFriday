import * as News from '../models/News.js';
import { ensureFreshNews } from '../services/newsService.js';

// 오래된 데이터면 뒤에서 새로 가져오도록 시키고, 응답은 지금 저장된 것으로 바로 돌려준다
export async function list(req, res) {
  ensureFreshNews().catch((error) => console.error('뉴스 갱신 확인 실패:', error.message));
  const { items, total } = await News.findAll(req.newsFilters);
  res.set('X-Total-Count', String(total)).json(items);
}

export async function sources(req, res) {
  res.json(await News.countBySource());
}
