const BASE_URL = 'https://api.rawg.io/api';

export class RawgError extends Error {
  // fatal=true: 키 오류나 한도 초과라서 가져오기를 멈춰야 하는 경우
  constructor(message, { fatal = false } = {}) {
    super(message);
    this.fatal = fatal;
  }
}

// 에러 메시지에 API 키가 섞여 들어가지 않도록, 요청 주소는 절대 메시지에 쓰지 않는다
export function createRawgClient({ key, fetchImpl = fetch, delayMs = 150, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  if (!key) throw new RawgError('RAWG_API_KEY가 없습니다. backend/.env에 RAWG_API_KEY=키 를 넣어 주세요.', { fatal: true });

  async function get(path, params = {}) {
    const url = new URL(`${BASE_URL}${path}`);
    url.searchParams.set('key', key);
    for (const [name, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(name, String(value));
    }

    await sleep(delayMs);

    let response;
    for (let attempt = 1; ; attempt += 1) {
      try {
        response = await fetchImpl(url);
        break;
      } catch {
        if (attempt >= 3) throw new RawgError(`RAWG ${path} 요청이 네트워크 오류로 실패했습니다.`, { fatal: true });
        await sleep(500 * attempt);
      }
    }

    if (response.status === 401 || response.status === 403) {
      throw new RawgError('RAWG가 API 키를 거절했습니다. 키가 맞는지 확인해 주세요.', { fatal: true });
    }
    if (response.status === 429) {
      throw new RawgError('RAWG 요청 한도를 넘었습니다. 잠시 후 다시 하거나 가져올 개수를 줄여 주세요.', { fatal: true });
    }
    if (!response.ok) {
      throw new RawgError(`RAWG ${path} 요청이 실패했습니다. (HTTP ${response.status})`);
    }
    return response.json();
  }

  return {
    listGames: ({ from, to, page = 1, pageSize = 40 }) =>
      get('/games', { dates: `${from},${to}`, ordering: '-added', page, page_size: pageSize }),
    getGame: (id) => get(`/games/${id}`),
    getMovies: (id) => get(`/games/${id}/movies`),
    getStores: (id) => get(`/games/${id}/stores`), // [{ store_id, url }]
  };
}
