import { avatarPath } from './lib/avatars.js';

// 동그란 프로필 사진. user는 { displayName, avatar } 모양이면 된다 (avatar가 없으면 기본 사진)
export function Avatar({ user, size = 36, className = '' }) {
  const name = user?.displayName;
  return (
    <img
      className={'avatar ' + className}
      src={avatarPath(user?.avatar, import.meta.env?.BASE_URL ?? '/')}
      alt={name ? name + ' 프로필 사진' : '프로필 사진'}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
    />
  );
}
