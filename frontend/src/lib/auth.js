// 로그인 토큰을 브라우저에 저장한다 (화면 코드 없음). 저장소가 막혀 있어도 에러 없이 "로그인 안 됨"으로 동작한다.
// 토큰은 서버가 준 임의의 긴 문자열이고, 서버에는 해시만 저장되어 있다. 비밀번호는 저장하지 않는다.

const TOKEN_KEY = 'gamecal.token';

const defaultStorage = () => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
};

export function loadToken(storage = defaultStorage()) {
  try {
    const value = storage?.getItem(TOKEN_KEY);
    return typeof value === 'string' && /^[\w-]{20,200}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveToken(token, storage = defaultStorage()) {
  try {
    storage?.setItem(TOKEN_KEY, token);
  } catch {
    // 저장 실패는 무시 (이번 방문 동안은 메모리 상태로만 로그인이 유지된다)
  }
}

export function clearToken(storage = defaultStorage()) {
  try {
    storage?.removeItem(TOKEN_KEY);
  } catch {
    // 무시
  }
}
