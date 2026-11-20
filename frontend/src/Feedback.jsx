import { useState } from 'react';
import { Pencil, Star, Trash2 } from 'lucide-react';
import { api } from './api/client.js';
import { Avatar } from './Avatar.jsx';
import { PublishedTime } from './NewsCards.jsx';
import { WaitState } from './ReleaseViews.jsx';
import { useRequest } from './useRequest.js';

const MAX_COMMENT = 200;

function Stars({ value, label }) {
  return (
    <span className="stars" role="img" aria-label={`${label ?? '별점'} ${value}점 (5점 만점)`}>
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={16} fill={n <= Math.round(value) ? 'currentColor' : 'none'} aria-hidden="true" />)}
    </span>
  );
}

function StarPicker({ value, onChange, disabled }) {
  return (
    <div className="star-picker" role="radiogroup" aria-label="별점">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n}점`} disabled={disabled} onClick={() => onChange(n)} data-on={n <= value}>
          <Star size={26} fill={n <= value ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

// 별점과 한마디를 쓰는 폼. 새 글과 수정이 함께 쓴다
function FeedbackForm({ initial, submitLabel, onSubmit, onCancel }) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [comment, setComment] = useState(initial?.comment ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const length = [...comment].length;

  async function submit(event) {
    event.preventDefault();
    if (!rating) {
      setError('별점을 골라 주세요.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSubmit({ rating, comment: comment.trim() });
      if (!initial) {
        setRating(0);
        setComment('');
      }
    } catch (caught) {
      setError(caught.errors?.[0]?.message ?? caught.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="feedback-form" onSubmit={submit}>
      <StarPicker value={rating} onChange={setRating} disabled={busy} />
      <label className="feedback-field">
        <span className="sr-only">한마디</span>
        <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={MAX_COMMENT} rows={3} placeholder="사이트에 대한 한마디를 남겨 주세요" required />
      </label>
      <div className="feedback-form-foot">
        <small className={length >= MAX_COMMENT ? 'feedback-count is-full' : 'feedback-count'}>{length}/{MAX_COMMENT}</small>
        <span className="feedback-actions">
          {onCancel && <button type="button" className="button button-small" onClick={onCancel} disabled={busy}>취소</button>}
          <button type="submit" className="button button-small button-accent" disabled={busy || !comment.trim()}>{busy ? '저장 중…' : submitLabel}</button>
        </span>
      </div>
      {error && <p className="auth-error" role="alert">{error}</p>}
    </form>
  );
}

function FeedbackItem({ item, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');

  async function remove() {
    if (!window.confirm('이 피드백을 지울까요?')) return;
    try {
      await api.deleteFeedback(item.id);
      onChanged();
    } catch (caught) {
      setError(caught.message);
    }
  }

  return (
    <li className="feedback-item">
      <Avatar user={item.author} size={40} />
      <div className="feedback-copy">
        <div className="feedback-head">
          <strong>{item.author.displayName}</strong>
          <Stars value={item.rating} />
          <PublishedTime value={item.createdAt} />
        </div>
        {editing ? (
          <FeedbackForm
            initial={item}
            submitLabel="저장"
            onCancel={() => setEditing(false)}
            onSubmit={async (values) => { await api.updateFeedback(item.id, values); setEditing(false); onChanged(); }}
          />
        ) : (
          <p>{item.comment}</p>
        )}
        {error && <p className="auth-error" role="alert">{error}</p>}
      </div>
      {item.mine && !editing && (
        <span className="feedback-owner">
          <button type="button" className="icon-button" aria-label="내 피드백 수정" onClick={() => setEditing(true)}><Pencil size={15} /></button>
          <button type="button" className="icon-button" aria-label="내 피드백 삭제" onClick={remove}><Trash2 size={15} /></button>
        </span>
      )}
    </li>
  );
}

export default function Feedback({ user, onLogin }) {
  const list = useRequest(api.listFeedback, { limit: 50 });
  const data = list.data;

  return (
    <section aria-labelledby="feedback-heading" className="feedback">
      <div className="section-heading">
        <div>
          <h2 id="feedback-heading">피드백</h2>
          <p>사이트를 써 본 느낌을 별점과 한마디로 남겨 주세요. 로그인한 사람만 쓸 수 있고, 이메일은 보이지 않아요.</p>
        </div>
        {data && (
          <div className="feedback-summary" aria-label="전체 평균 별점">
            <strong>{data.average === null ? '-' : data.average.toFixed(1)}</strong>
            <Stars value={data.average ?? 0} label="평균 별점" />
            <small>{data.total}개</small>
          </div>
        )}
      </div>

      <div className="panel feedback-compose">
        {user ? (
          <FeedbackForm submitLabel="남기기" onSubmit={async (values) => { await api.createFeedback(values); list.retry(); }} />
        ) : (
          <p className="login-note">
            피드백은 로그인한 사람만 남길 수 있어요.
            <button type="button" className="button button-small" onClick={onLogin}>로그인 / 회원가입</button>
          </p>
        )}
      </div>

      <div className="panel">
        <WaitState request={list} empty="아직 남겨진 피드백이 없어요. 첫 피드백을 남겨 보세요.">
          {data?.items.length > 0 ? (
            <ul className="feedback-list">
              {data.items.map((item) => <FeedbackItem key={item.id} item={item} onChanged={list.retry} />)}
            </ul>
          ) : null}
        </WaitState>
      </div>
    </section>
  );
}
