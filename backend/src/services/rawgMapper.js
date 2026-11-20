// RAWG API 응답을 우리 games 테이블 형태로 바꾼다.
// list: GET /games 목록의 항목, detail: GET /games/{id}, movies: GET /games/{id}/movies
// 응답 필드가 없을 수 있으므로 모두 방어적으로 읽는다.

const names = (arr) => (Array.isArray(arr) ? arr.map((x) => x?.name).filter(Boolean) : []);
const isHttp = (v) => typeof v === 'string' && /^https?:\/\//i.test(v) && v.length <= 500;
const httpOrNull = (v) => (isHttp(v) ? v : null);

export function mapRawgGame(list, detail = null, movies = null) {
  if (!list?.id || !list?.name || !/^\d{4}-\d{2}-\d{2}$/.test(list.released ?? '')) return null; // 출시일 미정(TBA)은 제외

  const platforms = (list.platforms ?? []).map((p) => p?.platform?.name).filter(Boolean);
  const genres = names(list.genres);
  const clip = movies?.results?.[0]?.data;
  const screenshots = (list.short_screenshots ?? []).map((s) => s?.image).filter(isHttp);

  return {
    title: String(list.name).slice(0, 200),
    releaseDate: list.released,
    platforms,
    genre: genres[0] ? genres[0].slice(0, 50) : null,
    genres,
    description: detail?.description_raw ? String(detail.description_raw).slice(0, 20000) : null,
    trailerUrl: httpOrNull(clip?.max) ?? httpOrNull(clip?.['480']),
    coverImageUrl: httpOrNull(list.background_image),
    officialUrl: httpOrNull(detail?.website),
    tags: names(list.tags).slice(0, 30),
    developers: names(detail?.developers),
    publishers: names(detail?.publishers),
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
}
