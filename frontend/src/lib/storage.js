// 브라우저 저장소(localStorage) 도우미: 관심 게임 별표(#10, #12)와 내 플랫폼 설정(#7). (화면 코드 없음)
// 저장소가 막혀 있거나(사생활 보호 모드 등) 값이 깨져 있어도 에러 없이 빈 값으로 동작한다.

const FAVORITES_KEY = 'gamecal.favorites';
const PLATFORM_KEY = 'gamecal.platform';

const defaultStorage = () => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
};

export function loadFavorites(storage = defaultStorage()) {
  try {
    const value = JSON.parse(storage?.getItem(FAVORITES_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((id) => Number.isInteger(id) && id > 0) : [];
  } catch {
    return [];
  }
}

export function saveFavorites(ids, storage = defaultStorage()) {
  try {
    storage?.setItem(FAVORITES_KEY, JSON.stringify(ids));
  } catch {
    // 저장 실패는 무시 (이번 방문 동안만 유지됨)
  }
}

// 별표를 켜고 끈 새 배열을 돌려준다 (원본은 바꾸지 않는다)
export function toggleFavorite(ids, id) {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

export function loadPlatform(storage = defaultStorage()) {
  try {
    return storage?.getItem(PLATFORM_KEY) || null;
  } catch {
    return null;
  }
}

export function savePlatform(platform, storage = defaultStorage()) {
  try {
    if (platform) storage?.setItem(PLATFORM_KEY, platform);
    else storage?.removeItem(PLATFORM_KEY);
  } catch {
    // 무시
  }
}
