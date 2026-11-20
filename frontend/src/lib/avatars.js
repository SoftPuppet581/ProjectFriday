// 프로필 사진 키와 주소 (화면 코드 없음). 사진 파일은 frontend/public/avatars/ 에 있다 (scripts/makeAvatars.mjs로 만든 SVG).
// 키 a01~a20 중 하나를 고르고, 고르지 않았으면(null) 기본 사진(default.svg)을 쓴다. 서버도 같은 키만 받는다.

export const AVATAR_KEYS = Array.from({ length: 20 }, (_, index) => `a${String(index + 1).padStart(2, '0')}`);

export const isAvatarKey = (key) => AVATAR_KEYS.includes(key);

// 알 수 없는 값이 와도 에러 없이 기본 사진으로 (경로 조작 문자가 섞여도 주소에는 절대 반영되지 않는다)
export function avatarPath(key, base = '/') {
  return `${base}avatars/${isAvatarKey(key) ? key : 'default'}.svg`;
}
