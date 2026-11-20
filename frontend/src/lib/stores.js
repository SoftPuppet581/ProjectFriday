// 가격 표시와 스토어/뉴스 바로 가기 링크 목록 (화면 코드 없음). 게임 객체(game)는 docs/API.md 참고.
//
// 가격은 Steam(원화) 기준이다. Steam에서 팔지 않거나(콘솔 전용), 출시 전이거나, Steam이 가격을 안 주면 game.price가 null이다.

const won = (n) => `₩${Number(n).toLocaleString('ko-KR')}`;

// 반환: { kind, text, originalText, discountText }
//   kind: 'paid'(정가) | 'sale'(할인 중) | 'free'(0원) | 'unknown'(가격 정보 없음)
export function formatPrice(price) {
  if (!price || typeof price.final !== 'number') {
    return { kind: 'unknown', text: '가격 미정', originalText: null, discountText: null };
  }
  if (price.final === 0) return { kind: 'free', text: '무료', originalText: null, discountText: null };
  if (price.onSale && price.initial > price.final) {
    return { kind: 'sale', text: won(price.final), originalText: won(price.initial), discountText: `-${price.discountPercent}%` };
  }
  return { kind: 'paid', text: won(price.final), originalText: null, discountText: null };
}

const STORE_KEYS = {
  Steam: 'steam',
  'PlayStation Store': 'playstation',
  'Xbox Store': 'xbox',
  'Nintendo Store': 'nintendo',
  'Epic Games': 'epic',
  GOG: 'gog',
  'App Store': 'appstore',
  'Google Play': 'googleplay',
  'itch.io': 'itch',
};

// 상세 화면에 버튼으로 보여 줄 스토어 링크들 (Steam 먼저).
// 반환: [{ key, label, url, kind }]  kind: 'store'(실제 상품 페이지) | 'search'(검색 결과 페이지)
// Steam 상품 주소가 없는 게임은 "Steam에서 검색" 링크를 맨 뒤에 붙인다.
export function storeLinks(game) {
  const links = (game?.stores ?? []).map((store) => ({
    key: STORE_KEYS[store.name] ?? 'store',
    label: store.name,
    url: store.url,
    kind: 'store',
  }));
  const hasSteam = links.some((l) => l.key === 'steam') || Boolean(game?.steamStoreUrl);
  if (game?.steamStoreUrl && !links.some((l) => l.key === 'steam')) {
    links.unshift({ key: 'steam', label: 'Steam', url: game.steamStoreUrl, kind: 'store' });
  }
  if (!hasSteam && game?.steamSearchUrl) {
    links.push({ key: 'steam-search', label: 'Steam에서 검색', url: game.steamSearchUrl, kind: 'search' });
  }
  return links;
}

// "Steam 앱으로 열기" 링크. Steam 앱이 설치된 PC에서만 동작하므로 보조 버튼으로 쓴다. 앱 번호가 없으면 null
export const steamClientLink = (game) => game?.steamClientUrl ?? null;

// 뉴스 바로 가기: 이 게임의 뉴스 검색 결과(네이버)로 가는 링크. 사이트 안의 뉴스 페이지에서 찾으려면 api.listNews({ q: game.title })
export const newsSearchLink = (game) => game?.newsSearchUrl ?? null;
