import { useState } from 'react';
import { Check } from 'lucide-react';
import { api } from './api/client.js';
import { Avatar } from './Avatar.jsx';
import { Dialog } from './ReleaseViews.jsx';
import { AVATAR_KEYS } from './lib/avatars.js';

// 프로필 설정: 사진(기본 + 20개 중 선택)과 닉네임. 저장하면 onSaved(바뀐 내 정보)를 부른다
export default function ProfileDialog({ user, onClose, onSaved }) {
  const [avatar, setAvatar] = useState(user.avatar ?? null);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const fieldError = (field) => error?.errors?.find((entry) => entry.field === field)?.message;
  const changed = avatar !== (user.avatar ?? null) || displayName.trim() !== user.displayName;

  async function save(event) {
    event.preventDefault();
    if (busy || !changed) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await api.updateMe({ displayName: displayName.trim(), avatar }));
    } catch (caught) {
      setError(caught);
      setBusy(false);
    }
  }

  return (
    <Dialog label="프로필 설정" onClose={onClose} className="profile-dialog">
      <form className="profile-form" onSubmit={save}>
        <h2>프로필 설정</h2>

        <div className="profile-preview">
          <Avatar user={{ displayName, avatar }} size={72} />
          <div>
            <strong>{displayName.trim() || '닉네임'}</strong>
            <span>{user.email}</span>
          </div>
        </div>

        <fieldset className="avatar-picker">
          <legend>프로필 사진</legend>
          <div className="avatar-grid" role="radiogroup" aria-label="프로필 사진 선택">
            {[null, ...AVATAR_KEYS].map((key) => {
              const selected = key === avatar;
              return (
                <button
                  key={key ?? 'default'}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={key ? `프로필 사진 ${Number(key.slice(1))}번` : '기본 프로필 사진'}
                  className="avatar-option"
                  onClick={() => setAvatar(key)}
                >
                  <Avatar user={{ avatar: key }} size={52} />
                  {selected && <span className="avatar-check" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>}
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="field">
          <span>닉네임</span>
          <input type="text" maxLength={40} value={displayName} onChange={(event) => setDisplayName(event.target.value)} aria-invalid={Boolean(fieldError('displayName'))} required />
          <small className="field-error">{fieldError('displayName')}</small>
        </label>

        <p className="auth-error" role="alert">{error && !error.errors?.length ? error.message : ''}</p>
        <div className="profile-actions">
          <button type="button" className="button" onClick={onClose}>취소</button>
          <button type="submit" className="button button-accent" disabled={busy || !changed}>{busy ? '저장 중…' : '저장'}</button>
        </div>
      </form>
    </Dialog>
  );
}
