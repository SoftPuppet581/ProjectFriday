import { useEffect, useRef, useState } from 'react';
import { api } from './api/client.js';
import { Dialog } from './ReleaseViews.jsx';

const LABELS = {
  login: { title: '로그인', submit: '로그인', switchText: '아직 계정이 없나요?', switchAction: '회원가입' },
  signup: { title: '회원가입', submit: '가입하고 시작하기', switchText: '이미 계정이 있나요?', switchAction: '로그인' },
};

// 로그인/회원가입 창. 성공하면 onAuth({ token, expiresAt, user })를 부른다. (창 닫기는 부르는 쪽에서)
export default function AuthDialog({ onClose, onAuth, initialMode = 'login', note }) {
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ email: '', password: '', displayName: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const emailInput = useRef(null);
  // <dialog>가 열리면 브라우저가 첫 버튼(닫기)에 포커스를 주므로, 이메일 칸으로 옮긴다
  useEffect(() => { emailInput.current?.focus(); }, [mode]);
  const text = LABELS[mode];
  const signup = mode === 'signup';
  const fieldError = (field) => error?.errors?.find((entry) => entry.field === field)?.message;
  const generalError = error && !error.errors?.length ? error.message : null;

  const change = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = signup
        ? await api.signup({ email: form.email, password: form.password, displayName: form.displayName })
        : await api.login({ email: form.email, password: form.password });
      onAuth(result);
    } catch (caught) {
      setError(caught);
      setBusy(false);
    }
  }

  function switchMode() {
    setMode(signup ? 'login' : 'signup');
    setError(null);
  }

  return (
    <Dialog label={text.title} onClose={onClose} className="auth-dialog">
      <form className="auth-form" onSubmit={submit} noValidate>
        <h2>{text.title}</h2>
        {note && <p className="auth-note">{note}</p>}

        <label className="field">
          <span>이메일</span>
          <input type="email" autoComplete="email" ref={emailInput} value={form.email} onChange={change('email')} aria-invalid={Boolean(fieldError('email'))} aria-describedby="auth-email-error" required />
          <small id="auth-email-error" className="field-error">{fieldError('email')}</small>
        </label>

        {signup && (
          <label className="field">
            <span>닉네임</span>
            <input type="text" autoComplete="nickname" maxLength={40} value={form.displayName} onChange={change('displayName')} aria-invalid={Boolean(fieldError('displayName'))} aria-describedby="auth-name-error" required />
            <small id="auth-name-error" className="field-error">{fieldError('displayName')}</small>
          </label>
        )}

        <label className="field">
          <span>비밀번호</span>
          <input type="password" autoComplete={signup ? 'new-password' : 'current-password'} value={form.password} onChange={change('password')} aria-invalid={Boolean(fieldError('password'))} aria-describedby="auth-password-error" required />
          <small id="auth-password-error" className={fieldError('password') ? 'field-error' : 'field-hint'}>
            {fieldError('password') || (signup ? '8자 이상, 글자와 숫자를 모두 넣어 주세요.' : '')}
          </small>
        </label>

        <p className="auth-error" role="alert" aria-live="assertive">{generalError}</p>

        <button type="submit" className="button button-accent auth-submit" disabled={busy}>{busy ? '잠시만요…' : text.submit}</button>
        <p className="auth-switch">
          {text.switchText} <button type="button" className="link-button" onClick={switchMode}>{text.switchAction}</button>
        </p>
        {signup && <p className="auth-fineprint">실습용 사이트입니다. 실제로 쓰는 비밀번호는 넣지 마세요.</p>}
      </form>
    </Dialog>
  );
}
