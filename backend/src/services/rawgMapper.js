// RAWG API 응답을 우리 games 테이블 형태로 바꾼다.
// list: GET /games 목록의 항목, detail: GET /games/{id}, movies: GET /games/{id}/movies
// 응답 필드가 없을 수 있으므로 모두 방어적으로 읽는다.
//
// 중요: 상세/영상 정보가 이번에 없으면 그 필드는 결과에 넣지 않는다(undefined).
// 그래야 다시 가져올 때 이미 저장된 설명이나 직접 넣은 트레일러가 null로 덮어써지지 않는다.

const names = (arr) => (Array.isArray(arr) ? arr.map((x) => x?.name).filter(Boolean) : []);
const isHttp = (v) => typeof v === 'string' && /^https?:\/\//i.test(v) && v.length <= 500;
const httpOrNull = (v) => (isHttp(v) ? v : null);

export function mapRawgGame(list, detail = null, movies = null) {
  if (!list?.id || !list?.name || !/^\d{4}-\d{2}-\d{2}$/.test(list.released ?? '')) return null; // 출시일 미정(TBA)은 제외

  const platforms = (list.platforms ?? []).map((p) => p?.platform?.name).filter(Boolean);
  const genres = names(list.genres);
  const screenshots = (list.short_screenshots ?? []).map((s) => s?.image).filter(isHttp);

  const game = {
    title: String(list.name).slice(0, 200),
    releaseDate: list.released,
    platforms,
    genre: genres[0] ? genres[0].slice(0, 50) : null,
    genres,
    coverImageUrl: httpOrNull(list.background_image),
    tags: names(list.tags).slice(0, 30),
    screenshots: screenshots.slice(0, 20),
    rating: typeof list.rating === 'number' && list.rating > 0 ? Math.min(5, list.rating) : null,
    ratingsCount: Number.isInteger(list.ratings_count) ? list.ratings_count : null,
    metacritic: Number.isInteger(list.metacritic) ? list.metacritic : null,
    esrbRating: list.esrb_rating?.name ? String(list.esrb_rating.name).slice(0, 50) : null,
    playtime: Number.isInteger(list.playtime) ? list.playtime : null,
    popularity: Number.isInteger(list.added) ? list.added : null,
    externalId: list.id,
    slug: list.slug ? String(list.slug).slice(0, 200) : null,
    sourceUrl: list.slug ? `https://rawg.io/games/${list.slug}` : null,
    source: 'rawg',
  };

  if (detail) {
    game.description = detail.description_raw ? String(detail.description_raw).slice(0, 20000) : null;
    game.officialUrl = httpOrNull(detail.website);
    game.developers = names(detail.developers);
    game.publishers = names(detail.publishers);
  }

  const clip = movies?.results?.[0]?.data;
  const trailerUrl = httpOrNull(clip?.max) ?? httpOrNull(clip?.['480']);
  if (trailerUrl) game.trailerUrl = trailerUrl;

  return game;
}
