import { useEffect, useState } from 'react';
import { ArrowLeft, MessageCircle, MessageSquare, PenLine, Plus } from 'lucide-react';
import { Dialog } from './ReleaseViews.jsx';

const storageKey = 'projectfriday.forum';
const categories = ['자유', '질문', '추천', '공략'];
const topics = [
  { id: 'starter-now', category: '자유', title: '요즘 어떤 게임을 하고 계세요?', body: '최근 플레이한 게임과 가장 기억에 남는 순간을 소개해 주세요.', replies: [] },
  { id: 'starter-coop', category: '추천', title: '친구와 함께 할 협동 게임 추천', body: '인원수와 플레이하는 플랫폼을 함께 적어 주면 다른 사람이 고르기 쉬워요.', replies: [] },
  { id: 'starter-help', category: '질문', title: '게임을 고르기 어려울 때', body: '좋아하는 게임과 찾고 있는 분위기, 플랫폼을 알려 주세요. 서로 게임을 추천해 봐요.', replies: [] },
];
const timeLabel = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });

function readThreads() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    if (Array.isArray(saved) && saved.every((item) => item && typeof item.title === 'string' && Array.isArray(item.replies))) return saved;
  } catch {
    // 저장소를 사용할 수 없는 경우 기본 주제로 시작한다.
  }
  return topics;
}

export default function Forum({ draftGame, onClearDraft }) {
  const [threads, setThreads] = useState(readThreads);
  const [category, setCategory] = useState('');
  const [activeId, setActiveId] = useState(null);
  const [writing, setWriting] = useState(false);
  const [reply, setReply] = useState('');
  const [storageError, setStorageError] = useState(false);
  const active = threads.find(({ id }) => id === activeId);
  const filtered = category ? threads.filter((thread) => thread.category === category) : threads;
  const isWriting = writing || Boolean(draftGame);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(threads));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [threads]);

  function closeComposer() {
    setWriting(false);
    onClearDraft();
  }

  function publish(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const title = values.get('title').trim();
    const body = values.get('body').trim();
    if (!title || !body) return;
    const thread = { id: crypto.randomUUID(), category: values.get('category'), title, body, created: Date.now(), replies: [] };
    setThreads((current) => [thread, ...current]);
    setCategory('');
    setActiveId(thread.id);
    closeComposer();
  }

  function addReply(event) {
    event.preventDefault();
    if (!reply.trim()) return;
    const message = { id: crypto.randomUUID(), body: reply.trim(), created: Date.now() };
    setThreads((current) => current.map((thread) => thread.id === activeId ? { ...thread, replies: [...thread.replies, message] } : thread));
    setReply('');
  }

  return (
    <section aria-labelledby="forum-heading" className="forum">
      <div className="section-heading">
        <div><h2 id="forum-heading">게임 포럼</h2><p>글과 댓글은 이 브라우저에 저장됩니다.</p></div>
        <button className="button button-accent" type="button" onClick={() => setWriting(true)}><Plus size={18} /> 새 글</button>
      </div>
      {storageError && <p className="placeholder error" role="status">브라우저 저장소에 저장할 수 없어 이번 방문 동안만 글이 유지됩니다.</p>}
      {active ? (
        <article className="panel thread">
          <button className="button button-small" type="button" onClick={() => { setActiveId(null); setReply(''); }}><ArrowLeft size={15} /> 목록</button>
          <span className="forum-category">{active.category}</span>
          <h3>{active.title}</h3>
          <p className="thread-body">{active.body}</p>
          {active.created && <time dateTime={new Date(active.created).toISOString()}>{timeLabel.format(active.created)}</time>}
          <h4>댓글 {active.replies.length}</h4>
          {active.replies.length > 0 && (
            <ul className="replies">
              {active.replies.map((message) => <li key={message.id}><p>{message.body}</p><time dateTime={new Date(message.created).toISOString()}>{timeLabel.format(message.created)}</time></li>)}
            </ul>
          )}
          <form className="reply-form" onSubmit={addReply}>
            <label htmlFor="reply-body">댓글 작성</label>
            <textarea id="reply-body" required maxLength={1000} value={reply} onChange={(event) => setReply(event.target.value)} />
            <button type="submit" className="button button-accent" disabled={!reply.trim()}>댓글 남기기</button>
          </form>
        </article>
      ) : (
        <div className="panel forum-board">
          <div className="forum-tabs" aria-label="포럼 분류">
            {['', ...categories].map((option) => <button key={option} type="button" aria-pressed={category === option} onClick={() => setCategory(option)}>{option || '전체'}</button>)}
          </div>
          {filtered.length > 0 ? (
            <ul className="forum-list">
              {filtered.map((thread) => (
                <li key={thread.id}>
                  <button className="thread-row" type="button" onClick={() => { setActiveId(thread.id); setReply(''); }}>
                    <span className="forum-icon"><MessageSquare size={21} /></span>
                    <span className="thread-copy"><span className="forum-category">{thread.category}</span><strong>{thread.title}</strong><span>{thread.created ? timeLabel.format(thread.created) : '시작 주제'}</span></span>
                    <span className="thread-count" aria-label={'댓글 ' + thread.replies.length + '개'}><MessageCircle size={16} /> {thread.replies.length}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="placeholder">이 분류에 아직 올라온 글이 없어요.</p>}
        </div>
      )}
      {isWriting && (
        <Dialog label="포럼에 새 글 쓰기" onClose={closeComposer}>
          <form className="forum-form" onSubmit={publish}>
            <h3><PenLine size={21} /> 새 글 쓰기</h3>
            <label>분류<select name="category" defaultValue="자유">{categories.map((name) => <option key={name}>{name}</option>)}</select></label>
            <label>제목<input name="title" defaultValue={draftGame ? draftGame + ' 이야기' : ''} maxLength={100} required /></label>
            <label>내용<textarea name="body" maxLength={3000} rows={6} required /></label>
            <button type="submit" className="button button-accent">글 올리기</button>
          </form>
        </Dialog>
      )}
    </section>
  );
}
