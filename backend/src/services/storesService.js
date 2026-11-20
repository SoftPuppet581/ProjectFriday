// RAWG가 알려 주는 게임별 스토어 주소(Steam, PlayStation Store 등)를 정리해서 저장한다.

// RAWG의 스토어 번호 (GET /api/stores 로 확인한 값)
const STORE_NAMES = {
  1: 'Steam',
  2: 'Xbox Store',
  3: 'PlayStation Store',
  4: 'App Store',
  5: 'GOG',
  6: 'Nintendo Store',
  7: 'Xbox 360 Store',
  8: 'Google Play',
  9: 'itch.io',
  11: 'Epic Games',
};
// 화면에 보여 줄 순서: Steam이 먼저
const STORE_ORDER = [1, 3, 2, 6, 11, 5, 4, 8, 9, 7];

const isHttp = (v) => typeof v === 'string' && /^https?:\/\//i.test(v) && v.length <= 500;

// results: RAWG /games/{id}/stores 의 results. 반환: [{ name, url }] (http/https만, 중복 제거, Steam 먼저)
export function mapStores(results) {
  const seen = new Set();
  const stores = [];
  for (const item of Array.isArray(results) ? results : []) {
    if (!isHttp(item?.url) || seen.has(item.url)) continue;
    seen.add(item.url);
    stores.push({ id: item.store_id, name: STORE_NAMES[item.store_id] ?? '기타 스토어', url: item.url });
  }
  const rank = (id) => (STORE_ORDER.includes(id) ? STORE_ORDER.indexOf(id) : STORE_ORDER.length);
  return stores.sort((a, b) => rank(a.id) - rank(b.id)).map(({ name, url }) => ({ name, url }));
}

// Steam 스토어 주소에서 앱 번호를 뽑는다. 예: https://store.steampowered.com/app/3764200/Name/ → 3764200
export function steamAppIdFrom(stores) {
  for (const store of stores) {
    const match = String(store.url).match(/^https?:\/\/store\.steampowered\.com\/app\/(\d+)/i);
    if (match) return Number(match[1]);
  }
  return null;
}

// games: [{ id, externalId }]. client.getStores(externalId) 호출 결과를 save(id, stores, steamAppId)로 저장한다.
// 한 게임이 실패해도(fatal이 아니면) 다음 게임으로 넘어간다. 키 오류나 한도 초과(fatal)는 멈춘다.
export async function enrichStores({ client, games, save, log = () => {} }) {
  const stats = { checked: 0, withStores: 0, withSteam: 0, failed: 0 };
  for (const [index, game] of games.entries()) {
    try {
      const data = await client.getStores(game.externalId);
      const stores = mapStores(data?.results);
      const steamAppId = steamAppIdFrom(stores);
      await save(game.id, stores, steamAppId);
      stats.checked += 1;
      if (stores.length) stats.withStores += 1;
      if (steamAppId) stats.withSteam += 1;
    } catch (error) {
      if (error.fatal) throw error;
      stats.failed += 1;
      log(`  건너뜀 (${game.title ?? game.id}): ${error.message}`);
    }
    if ((index + 1) % 50 === 0) log(`스토어 확인 ${index + 1}/${games.length}`);
  }
  return stats;
}
