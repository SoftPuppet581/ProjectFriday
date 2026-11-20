import { useRef, useState } from 'react';
import { ArrowLeft, Heart, MessageCircle, PenLine, Plus, Trash2 } from 'lucide-react';
import { api, isStaticDemo } from './api/client.js';
import { Avatar } from './Avatar.jsx';
import { PublishedTime } from './NewsCards.jsx';
import { Dialog, WaitState } from './ReleaseViews.jsx';
import { useRequest } from './useRequest.js';

const categories = ['자유', '질문', '추천', '공략'];

function LoginPrompt({ onLogin, children }) {
  return (
    <p className="login-note">
      {children}
      <button type="button" className="button button-small" onClick={onLogin}>로그인 / 회원가입</button>
    </p>
  );
}

// 글 하나: 본문, 좋아요, 댓글
function Thread({ id, user, onBack, onLogin, onGame, onChanged }) {
  const request = useRequest(api.forumPost, id);
  const last = useRef(null);
  if (request.data) last.current = request.data;
  const post = request.data ?? last.current; // 댓글을 쓰고 다시 불러오는 동안에도 화면이 깜빡이지 않게
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(action) {
    setBusy(true);
    setError('');
    try {
      await action();
      request.retry();
      onChanged();
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  }

  if (!post) {
    return (
      <div className="panel thread">
        <button className="button button-small" type="button" onClick={onBack}><ArrowLeft size={15} /> 목록</button>
        <WaitState request={request} empty="글을 찾을 수 없어요." />
      </div>
    );
  }

  const toggleLike = () => (user ? run(() => (post.liked ? api.unlikeForumPost(id) : api.likeForumPost(id))) : onLogin());
  const removePost = () => {
    if (window.confirm('이 글을 지울까요? 댓글도 함께 지워져요.')) run(async () => { await api.deleteForumPost(id); onBack(); });
  };
  const submitComment = (event) => {
    event.preventDefault();
    if (comment.trim()) run(async () => { await api.addForumComment(id, comment.trim()); setComment(''); });
  };

  return (
    <article className="panel thread">
      <div className="thread-top">
        <button className="button button-small" type="button" onClick={onBack}><ArrowLeft size={15} /> 목록</button>
        {post.mine && <button className="button button-small" type="button" onClick={removePost} disabled={busy}><Trash2 size={15} /> 삭제</button>}
      </div>
      <div className="thread-tags">
        <span className="forum-category">{post.category}</span>
        {post.game && <button type="button" className="forum-game forum-game-link" onClick={() => onGame(post.game.id)}>{post.game.title}</button>}
      </div>
      <h3>{post.title}</h3>
      <div className="author-line">
        <Avatar user={post.author} size={40} />
        <div><strong>{post.author.displayName}</strong><PublishedTime value={post.createdAt} /></div>
      </div>
      <p className="thread-body">{post.body}</p>
      <div className="thread-actions">
        <button type="button" className="like-button" aria-pressed={post.liked} onClick={toggleLike} disabled={busy || isStaticDemo} title={isStaticDemo ? '데모 버전에서는 좋아요를 누를 수 없어요' : undefined}>
          <Heart size={17} fill={post.liked ? 'currentColor' : 'none'} /> 좋아요 {post.likeCount}
        </button>
      </div>
      {error && <p className="auth-error" role="alert">{error}</p>}

      <h4>댓글 {post.comments.length}</h4>
      {post.comments.length > 0 && (
        <ul className="replies">
          {post.comments.map((entry) => (
            <li key={entry.id}>
              <Avatar user={entry.author} size={34} />
              <div className="reply-copy">
                <div className="reply-head"><strong>{entry.author.displayName}</strong><PublishedTime value={entry.createdAt} /></div>
                <p>{entry.body}</p>
              </div>
              {entry.mine && (
                <button type="button" className="icon-button reply-delete" aria-label="내 댓글 삭제" disabled={busy} onClick={() => run(() => api.deleteForumComment(id, entry.id))}><Trash2 size={15} /></button>
              )}
            </li>
          ))}
        </ul>
      )}

      {user ? (
        <form className="reply-form" onSubmit={submitComment}>
          <label htmlFor="reply-body">댓글 작성</label>
          <textarea id="reply-body" required maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)} />
          <button type="submit" className="button button-accent" disabled={!comment.trim() || busy}>댓글 남기기</button>
        </form>
      ) : isStaticDemo ? (
        <p className="login-note">데모 버전에서는 글을 읽을 수만 있어요. 댓글과 글쓰기는 로컬 서버에서 쓸 수 있어요.</p>
      ) : (
        <LoginPrompt onLogin={onLogin}>댓글을 쓰려면 로그인해 주세요.</LoginPrompt>
      )}
    </article>
  );
}

export default function Forum({ draftGame, onClearDraft, user, onLogin, onGame }) {
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('recent');
  const [activeId, setActiveId] = useState(null);
  const [writing, setWriting] = useState(false);
  const [formError, setFormError] = useState('');
  const [posting, setPosting] = useState(false);
  const list = useRequest(api.forumPosts, { category, sort, limit: 30 });
  const posts = list.data?.items;
  const isWriting = writing || Boolean(draftGame);

  function closeComposer() {
    setWriting(false);
    setFormError('');
    onClearDraft();
  }

  async function publish(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setPosting(true);
    setFormError('');
    try {
      const created = await api.createForumPost({ category: values.get('category'), title: values.get('title').trim(), body: values.get('body').trim() });
      list.retry();
      setCategory('');
      setActiveId(created.id);
      closeComposer();
    } catch (caught) {
      setFormError(caught.errors?.[0]?.message ?? caught.message);
    } finally {
      setPosting(false);
    }
  }

  return (
    <section aria-labelledby="forum-heading" className="forum">
      <div className="section-heading">
        <div><h2 id="forum-heading">게임 포럼</h2><p>{isStaticDemo ? '게임 이야기를 나누는 곳이에요.' : '게임 이야기를 나누는 곳이에요. 읽기는 누구나, 글쓰기는 로그인이 필요해요.'}</p></div>
        {!isStaticDemo && <button className="button button-accent" type="button" onClick={() => (user ? setWriting(true) : onLogin())}><Plus size={18} /> 새 글</button>}
      </div>

      {activeId ? (
        <Thread key={activeId} id={activeId} user={user} onLogin={onLogin} onGame={onGame} onBack={() => { setActiveId(null); list.retry(); }} onChanged={list.retry} />
      ) : (
        <div className="panel forum-board">
          <div className="forum-toolbar">
            <div className="forum-tabs" aria-label="포럼 분류">
              {['', ...categories].map((option) => <button key={option} type="button" aria-pressed={category === option} onClick={() => setCategory(option)}>{option || '전체'}</button>)}
            </div>
            <div className="segmented" aria-label="정렬">
              <button type="button" aria-pressed={sort === 'recent'} onClick={() => setSort('recent')}>최신순</button>
              <button type="button" aria-pressed={sort === 'popular'} onClick={() => setSort('popular')}>인기순</button>
            </div>
          </div>
          <WaitState request={list} empty="이 분류에 아직 올라온 글이 없어요.">
            {posts?.length > 0 ? (
              <ul className="forum-list">
                {posts.map((post) => (
                  <li key={post.id}>
                    <button className="thread-row" type="button" onClick={() => setActiveId(post.id)}>
                      <Avatar user={post.author} size={44} />
                      <span className="thread-copy">
                        <span className="thread-tags">
                          <span className="forum-category">{post.category}</span>
                          {post.game && <span className="forum-game">{post.game.title}</span>}
                        </span>
                        <strong>{post.title}</strong>
                        <span className="thread-excerpt">{post.excerpt}</span>
                        <span className="thread-meta">{post.author.displayName} · <PublishedTime value={post.createdAt} /></span>
                      </span>
                      <span className="thread-stats" aria-label={`좋아요 ${post.likeCount}개, 댓글 ${post.commentCount}개`}>
                        <span><Heart size={15} /> {post.likeCount}</span>
                        <span><MessageCircle size={15} /> {post.commentCount}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </WaitState>
        </div>
      )}
      <p className="forum-sample-note">포럼의 일부 계정과 글은 시연용 샘플입니다.</p>

      {isWriting && (
        <Dialog label="포럼에 새 글 쓰기" onClose={closeComposer}>
          {user ? (
            <form className="forum-form" onSubmit={publish}>
              <h3><PenLine size={21} /> 새 글 쓰기</h3>
              <label>분류<select name="category" defaultValue="자유">{categories.map((name) => <option key={name}>{name}</option>)}</select></label>
              <label>제목<input name="title" defaultValue={draftGame ? draftGame + ' 이야기' : ''} maxLength={100} required /></label>
              <label>내용<textarea name="body" maxLength={3000} rows={6} required /></label>
              {formError && <p className="auth-error" role="alert">{formError}</p>}
              <button type="submit" className="button button-accent" disabled={posting}>{posting ? '올리는 중…' : '글 올리기'}</button>
            </form>
          ) : (
            <div className="forum-form">
              <h3><PenLine size={21} /> 새 글 쓰기</h3>
              <LoginPrompt onLogin={() => { closeComposer(); onLogin(); }}>글을 쓰려면 로그인해 주세요.</LoginPrompt>
            </div>
          )}
        </Dialog>
      )}
    </section>
  );
}
