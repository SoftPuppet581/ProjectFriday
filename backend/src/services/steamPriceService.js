// Steam 스토어의 공개 가격 조회(appdetails)로 원화 가격을 가져온다.
// 공식 문서가 있는 API는 아니라서 응답이 바뀔 수 있다. 그래서 값이 이상하면 가격을 만들지 않고 null로 둔다.
// 가격은 Steam에서 파는 게임에만 있다. 콘솔 전용, 출시 전, 무료, Steam에 없는 게임은 null이다.

const APPDETAILS_URL = 'https://store.steampowered.com/api/appdetails';

export class SteamError extends Error {
  // fatal=true: 요청이 막혔거나 한도를 넘어서 계속하면 안 되는 경우
  constructor(message, { fatal = false } = {}) {
    super(message);
    this.fatal = fatal;
  }
}

// Steam은 금액을 100배 한 정수로 준다. 예: 4290000 = ₩42,900 (final_formatted "₩ 42,900"으로 확인한 값)
export function parsePriceOverview(overview) {
  if (!overview || overview.currency !== 'KRW') return null;
  const final = overview.final / 100;
  const initial = overview.initial / 100;
  if (!Number.isInteger(final) || !Number.isInteger(initial) || final < 0 || initial < final) return null;
  const percent = Number.isInteger(overview.discount_percent) ? overview.discount_percent : 0;
  return {
    currency: 'KRW',
    final,
    initial,
    discountPercent: Math.min(100, Math.max(0, percent)),
    formatted: String(overview.final_formatted || `₩ ${final.toLocaleString('ko-KR')}`).slice(0, 30),
  };
}

// appIds를 batchSize개씩 묶어 조회한다. (여러 앱을 한 번에 묻는 것은 filters=price_overview 일 때만 동작한다)
// 반환: Map(appId -> 가격 객체 또는 null). null은 "응답은 왔는데 가격이 없음". 응답에 없는 앱은 Map에도 없다.
export async function fetchSteamPrices(appIds, { fetchImpl = fetch, batchSize = 30, delayMs = 1500, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), log = () => {} } = {}) {
  const prices = new Map();
  const ids = [...new Set(appIds)];

  for (let start = 0; start < ids.length; start += batchSize) {
    const chunk = ids.slice(start, start + batchSize);
    if (start > 0) await sleep(delayMs); // Steam은 짧은 시간에 많이 부르면 막는다

    const url = new URL(APPDETAILS_URL);
    url.searchParams.set('appids', chunk.join(','));
    url.searchParams.set('cc', 'kr');
    url.searchParams.set('l', 'koreana');
    url.searchParams.set('filters', 'price_overview');

    let response;
    try {
      response = await fetchImpl(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GameCalendarStudentProject)' } });
    } catch {
      log(`  네트워크 오류로 ${chunk.length}개를 건너뜀`);
      continue;
    }
    if (response.status === 429 || response.status === 403) {
      throw new SteamError('Steam이 요청을 막았습니다(너무 자주 호출). 몇 분 뒤에 다시 하세요.', { fatal: true });
    }
    if (!response.ok) {
      log(`  HTTP ${response.status} 로 ${chunk.length}개를 건너뜀`);
      continue;
    }

    let body;
    try {
      body = await response.json();
    } catch {
      log(`  응답을 읽지 못해 ${chunk.length}개를 건너뜀`);
      continue;
    }
    for (const id of chunk) {
      const entry = body?.[id];
      if (!entry) continue; // 응답에 없으면 모르는 것이니 건드리지 않는다
      prices.set(id, entry.success ? parsePriceOverview(entry.data?.price_overview) : null);
    }
  }
  return prices;
}

// Steam은 무료 게임에는 가격 정보를 주지 않아서, 가격이 없는 앱은 "진짜 무료"인지 "출시 전이라 미정"인지 구분이 안 된다.
// 그래서 가격이 없는 앱만 한 개씩 상세 조회해서 is_free를 확인한다. (개수가 적고 한 개씩이라 느리다)
// 반환: Map(appId -> true/false). 조회에 실패한 앱은 Map에 없다.
export async function fetchSteamIsFree(appIds, { fetchImpl = fetch, delayMs = 1600, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), log = () => {} } = {}) {
  const result = new Map();
  for (const [index, appId] of [...new Set(appIds)].entries()) {
    if (index > 0) await sleep(delayMs);

    const url = new URL(APPDETAILS_URL);
    url.searchParams.set('appids', String(appId));
    url.searchParams.set('cc', 'kr');
    url.searchParams.set('l', 'koreana');
    url.searchParams.set('filters', 'basic');

    let response;
    try {
      response = await fetchImpl(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GameCalendarStudentProject)' } });
    } catch {
      log(`  앱 ${appId}: 네트워크 오류로 건너뜀`);
      continue;
    }
    if (response.status === 429 || response.status === 403) {
      throw new SteamError('Steam이 요청을 막았습니다(너무 자주 호출). 몇 분 뒤에 다시 하세요.', { fatal: true });
    }
    if (!response.ok) continue;
    try {
      const entry = (await response.json())?.[appId];
      if (entry?.success && typeof entry.data?.is_free === 'boolean') result.set(appId, entry.data.is_free);
    } catch {
      log(`  앱 ${appId}: 응답을 읽지 못해 건너뜀`);
    }
  }
  return result;
}

export const FREE_PRICE = { currency: 'KRW', final: 0, initial: 0, discountPercent: 0, formatted: '무료' };

// games: [{ id, steamAppId }]. 가격을 확인한 게임만 save(id, price|null)로 저장한다.
// 가격이 없는 앱 중 Steam이 "무료"라고 하는 것은 0원(무료)으로 저장한다.
export async function refreshPrices({ games, fetchPrices = fetchSteamPrices, fetchFree = fetchSteamIsFree, save, log = () => {} }) {
  const prices = await fetchPrices(games.map((g) => g.steamAppId), { log });
  const stats = { checked: games.length, priced: 0, free: 0, noPrice: 0, unknown: 0 };

  const noPriceApps = games.filter((g) => prices.has(g.steamAppId) && prices.get(g.steamAppId) === null).map((g) => g.steamAppId);
  const freeFlags = noPriceApps.length ? await fetchFree(noPriceApps, { log }) : new Map();

  for (const game of games) {
    if (!prices.has(game.steamAppId)) {
      stats.unknown += 1;
      continue;
    }
    const price = prices.get(game.steamAppId);
    if (price) {
      await save(game.id, price);
      stats.priced += 1;
    } else if (freeFlags.get(game.steamAppId) === true) {
      await save(game.id, FREE_PRICE);
      stats.free += 1;
    } else {
      await save(game.id, null);
      stats.noPrice += 1;
    }
  }
  return stats;
}
