// 백엔드 API 호출 모듈 (화면 코드 없음). docs/API.md 참고.
// 사용 예: import { api } from './api/client.js';  const { items, total } = await api.listGames({ month: '2026-12' });

export class ApiError extends Error {
  constructor(status, message, errors = []) {
    super(message);
    this.status = status;
    this.errors = errors; // [{ field, message }]
  }
}

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export function createApi({ baseUrl = 'http://localhost:3000', fetchImpl = (...args) => fetch(...args) } = {}) {
  async function request(method, path, { params, body } = {}) {
    const options = { method, headers: {} };
    if (body !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    let response;
    try {
      response = await fetchImpl(`${baseUrl}${path}${buildQuery(params)}`, options);
    } catch {
      throw new ApiError(0, '서버에 연결할 수 없습니다. 백엔드(localhost:3000)가 켜져 있는지 확인해 주세요.');
    }

    if (response.status === 204) return { data: null, response };

    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!response.ok) {
      throw new ApiError(response.status, data?.message ?? `요청이 실패했습니다. (HTTP ${response.status})`, data?.errors ?? []);
    }
    return { data, response };
  }

  return {
    health: async () => (await request('GET', '/api/health')).data,

    // 목록: { items, total }. 전체 개수는 X-Total-Count 헤더에서 읽는다
    async listGames(params) {
      const { data, response } = await request('GET', '/api/games', { params });
      return { items: data, total: Number(response.headers.get('X-Total-Count') ?? data.length) };
    },
    getGame: async (id) => (await request('GET', `/api/games/${id}`)).data,
    similarGames: async (id, limit) => (await request('GET', `/api/games/${id}/similar`, { params: { limit } })).data,
    createGame: async (game) => (await request('POST', '/api/games', { body: game })).data,
    replaceGame: async (id, game) => (await request('PUT', `/api/games/${id}`, { body: game })).data,
    patchGame: async (id, changes) => (await request('PATCH', `/api/games/${id}`, { body: changes })).data,
    deleteGame: async (id) => (await request('DELETE', `/api/games/${id}`)).data,

    // 달력 요약: [{ date, count, games: [{ id, title, coverImageUrl, rating }] }]
    calendar: async (params) => (await request('GET', '/api/calendar', { params })).data,
    genres: async () => (await request('GET', '/api/genres')).data,
    platforms: async () => (await request('GET', '/api/platforms')).data,

    // 구글 캘린더 등에 추가할 .ics 파일 주소 (링크로 걸면 다운로드된다)
    icsUrl: (id) => `${baseUrl}/api/games/${id}/calendar.ics`,
  };
}

// 기본 인스턴스. 주소를 바꾸려면 frontend/.env 에 VITE_API_BASE=... 를 넣는다
export const api = createApi({ baseUrl: import.meta.env?.VITE_API_BASE ?? 'http://localhost:3000' });
