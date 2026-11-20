import { useEffect, useRef, useState } from 'react';
import { Bookmark, CalendarDays, ChevronLeft, ChevronRight, Columns2, ExternalLink, Play, RefreshCw, Star, X } from 'lucide-react';
import { api } from './api/client.js';
import { dateLabel } from './calendar.js';
import { dDay } from './lib/dates.js';
import { trailerInfo } from './lib/trailer.js';
import { RelatedNews } from './NewsCards.jsx';
import { GamePrice, PriceNote, QuickStore, StoreActions } from './StoreViews.jsx';
import { useRequest } from './useRequest.js';

function webUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value) ? value : null;
}

function CoverImage({ src, eager }) {
  const [state, setState] = useState('loading');
  return (
    <span className="cover-image" data-state={state}>
      <img src={src} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" onLoad={() => setState('ready')} onError={() => setState('failed')} />
      {state === 'loading' && <span className="cover-shimmer" />}
    </span>
  );
}

export function Cover({ game, className = '', eager = false }) {
  const image = webUrl(game?.coverImageUrl);
  const initials = game?.title?.trim().split(/\s+/u).slice(0, 2).map((word) => [...word][0]).join('').toUpperCase() || '';
  return (
    <span className={'cover ' + className} aria-hidden="true">
      {initials && <span className="cover-fallback">{initials}</span>}
      {image && <CoverImage key={image} src={image} eager={eager} />}
    </span>
  );
}

export function WaitState({ request, empty, children }) {
  if (request.loading) {
    return (
      <div className="placeholder state-loading" role="status">
        <span className="sr-only">불러오는 중…</span>
        <span /><span /><span />
      </div>
    );
  }
  if (request.error) {
    const offline = request.error.status === 0;
    return (
      <div className="placeholder error" role="alert">
        <strong>{offline ? '서버에 연결할 수 없어요.' : '정보를 불러오지 못했어요.'}</strong>
        <p>{offline ? '프로젝트의 start.bat으로 서버를 켠 뒤 다시 시도해 주세요.' : request.error.message}</p>
        <button className="button button-small" type="button" onClick={request.retry}><RefreshCw size={14} /> 다시 시도</button>
      </div>
    );
  }
  return children ?? (empty ? <p className="placeholder state-empty">{empty}</p> : null);
}

export function DateBadge({ date }) {
  const { days, label } = dDay(date);
  if (days < 0) return null;
  return <span className={'date-badge' + (days === 0 ? ' date-badge-today' : '')}>{label}</span>;
}

function Rating({ game }) {
  if (!game.rating || Number(game.rating) <= 0) return null;
  return <span className="rating"><Star size={13} fill="currentColor" /> {Number(game.rating).toFixed(1)}</span>;
}

export function FlagshipMarker({ game }) {
  if (game.title !== 'Grand Theft Auto VI') return null;
  return <span className="flagship-marker" role="img" aria-label="주요작" title="주요작" />;
}

export function GameList({ games, onGame }) {
  return (
    <ul className="game-list">
      {games.map((game) => (
        <li className="game-row-entry" key={game.id}>
          <button type="button" className="game-row" onClick={() => onGame(game.id)}>
            <Cover game={game} />
            <span className="game-row-copy">
              <strong><FlagshipMarker game={game} />{game.title}</strong>
              <span>{dateLabel(game.releaseDate)}{game.genre && ' · ' + game.genre}</span>
              <GamePrice game={game} />
            </span>
            <DateBadge date={game.releaseDate} />
          </button>
          <QuickStore game={game} />
        </li>
      ))}
    </ul>
  );
}

export function GameGrid({ games, onGame, favorites = [], onFavorite }) {
  return (
    <ul className="game-grid">
      {games.map((game) => (
        <li className="game-card" key={game.id}>
          <button type="button" className="game-card-main" onClick={() => onGame(game.id)}>
            <Cover game={game} />
            <span className="game-card-copy">
              <span className="game-card-genre">{game.genre || '게임'} <Rating game={game} /></span>
              <strong><FlagshipMarker game={game} />{game.title}</strong>
              <span>{dateLabel(game.releaseDate)} · {game.platforms?.slice(0, 2).join(', ') || '플랫폼 미정'}</span>
              <GamePrice game={game} />
            </span>
          </button>
          <div className="game-card-actions"><QuickStore game={game} /></div>
          {onFavorite && (
            <button type="button" className="icon-button card-favorite" aria-label={game.title + ' 관심 게임'} aria-pressed={favorites.includes(game.id)} onClick={() => onFavorite(game.id)}>
              <Bookmark size={17} fill={favorites.includes(game.id) ? 'currentColor' : 'none'} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

export function Dialog({ label, onClose, children, className = '' }) {
  const dialog = useRef(null);
  useEffect(() => {
    if (!dialog.current.open) dialog.current.showModal();
  }, []);
  return (
    <dialog className={'dialog ' + className} ref={dialog} aria-label={label} onClose={(event) => {
      event.stopPropagation();
      onClose();
    }} onClick={(event) => {
      if (event.target === event.currentTarget) dialog.current.close();
    }}>
      <div className="dialog-inner">
        <button className="icon-button dialog-close" type="button" onClick={() => dialog.current.close()} aria-label="닫기"><X size={20} /></button>
        {children}
      </div>
    </dialog>
  );
}

function Trailer({ game }) {
  const { kind, src } = trailerInfo(game);
  const url = webUrl(src);
  if (!url) return null;
  if (kind === 'video') return <video className="trailer" controls preload="none" src={url} aria-label={game.title + ' 트레일러'} />;
  if (kind === 'youtube') return <iframe className="trailer" src={url} title={game.title + ' 트레일러'} loading="lazy" allowFullScreen />;
  return <a className="button" href={url} target="_blank" rel="noreferrer"><Play size={16} /> {kind === 'search' ? '트레일러 검색' : '트레일러 보기'}</a>;
}

function RatingGauge({ value }) {
  const rating = Number(value);
  if (!Number.isFinite(rating) || rating <= 0) return null;
  return (
    <span className="rating-gauge" aria-label={'RAWG 평점 ' + rating.toFixed(1) + ' / 5'} role="img">
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <circle cx="22" cy="22" r="19" className="gauge-track" />
        <circle cx="22" cy="22" r="19" pathLength="100" strokeDasharray={Math.min(rating * 20, 100) + ' 100'} transform="rotate(-90 22 22)" className="gauge-value" />
      </svg>
      <strong>{rating.toFixed(1)}</strong>
    </span>
  );
}

function ScreenshotGallery({ game }) {
  const [selected, setSelected] = useState(null);
  const images = [...new Set((game.screenshots || []).filter(webUrl))];
  if (!images.length) return null;

  const label = (index) => game.title + ' 스크린샷 ' + (index + 1);
  function move(step) {
    setSelected((index) => (index + step + images.length) % images.length);
  }

  return (
    <section className="screenshot-section">
      <h3>스크린샷</h3>
      <ul className="screenshots">
        {images.map((image, index) => (
          <li key={image}>
            <button type="button" onClick={() => setSelected(index)} aria-label={label(index) + ' 확대'}>
              <img src={image} alt="" loading="lazy" />
            </button>
          </li>
        ))}
      </ul>
      {selected !== null && (
        <Dialog label={label(selected)} onClose={() => setSelected(null)} className="lightbox">
          <div className="lightbox-content" onKeyDown={(event) => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault();
              move(event.key === 'ArrowLeft' ? -1 : 1);
            }
          }}>
            <img src={images[selected]} alt={label(selected)} />
            {images.length > 1 && (
              <div className="lightbox-controls">
                <button type="button" className="icon-button" aria-label="이전 스크린샷" onClick={() => move(-1)}><ChevronLeft size={19} /></button>
                <span aria-live="polite">{selected + 1} / {images.length}</span>
                <button type="button" className="icon-button" aria-label="다음 스크린샷" onClick={() => move(1)}><ChevronRight size={19} /></button>
              </div>
            )}
          </div>
        </Dialog>
      )}
    </section>
  );
}

function SimilarGames({ games, onGame }) {
  const rail = useRef(null);
  function move(step) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    rail.current?.scrollBy({ left: step * rail.current.clientWidth * .75, behavior: reduce ? 'auto' : 'smooth' });
  }
  return (
    <section className="similar">
      <div className="similar-heading">
        <h3>비슷한 게임</h3>
        {games.length > 1 && (
          <div className="rail-controls">
            <button type="button" className="icon-button" aria-label="이전 비슷한 게임" onClick={() => move(-1)}><ChevronLeft size={19} /></button>
            <button type="button" className="icon-button" aria-label="다음 비슷한 게임" onClick={() => move(1)}><ChevronRight size={19} /></button>
          </div>
        )}
      </div>
      <div className="similar-rail" ref={rail}>
        <GameGrid games={games} onGame={onGame} />
      </div>
    </section>
  );
}

export function GameDetail({ id, onClose, onGame, onJump, onDiscuss, favorites, onFavorite, compareIds, onCompare }) {
  const detail = useRequest(api.getGame, id);
  const similar = useRequest(api.similarGames, id, 6);
  const game = detail.data;
  const saved = favorites.includes(id);
  const inComparison = compareIds.includes(id);

  return (
    <Dialog label={game?.title || '게임 상세'} onClose={onClose}>
      <WaitState request={detail} empty="게임 정보를 찾을 수 없어요.">
        {game && (
          <>
            <div className="detail-hero">
              <Cover game={game} eager />
              <div className="detail-title">
                <p>{game.genres?.join(' / ') || game.genre || '게임 정보'}</p>
                <h2>{game.title}</h2>
              </div>
            </div>
            <div className="detail-body">
              <div className="detail-metadata">
                <span><CalendarDays size={17} /> {dateLabel(game.releaseDate, true)}</span>
                <DateBadge date={game.releaseDate} />
                <RatingGauge value={game.rating} />
                {game.metacritic > 0 && <span className="metacritic">Metacritic <strong>{game.metacritic}</strong></span>}
              </div>
              <dl className="detail-facts">
                <div><dt>플랫폼</dt><dd className="platform-chips">{game.platforms?.length ? game.platforms.map((platform) => <span key={platform}>{platform}</span>) : <span>미정</span>}</dd></div>
                {game.developers?.length > 0 && <div><dt>개발사</dt><dd>{game.developers.join(', ')}</dd></div>}
                {game.publishers?.length > 0 && <div><dt>배급사</dt><dd>{game.publishers.join(', ')}</dd></div>}
              </dl>
              {game.description && <p className="game-description">{game.description}</p>}
              <section className="purchase">
                <div>
                  <GamePrice game={game} large />
                  <PriceNote price={game.price} />
                </div>
                <StoreActions game={game} />
              </section>
              <ScreenshotGallery key={game.id} game={game} />
              <div className="detail-actions">
                <button type="button" className={'button ' + (saved ? 'button-accent' : '')} aria-pressed={saved} onClick={() => onFavorite(id)}><Bookmark size={17} fill={saved ? 'currentColor' : 'none'} /> {saved ? '관심 게임에 저장됨' : '관심 게임에 추가'}</button>
                <button type="button" className="button" onClick={() => onJump(game.releaseDate)}><CalendarDays size={17} /> 달력에서 보기</button>
                <a className="button" href={api.icsUrl(id)} download>캘린더 일정 파일</a>
                <button type="button" className="button" disabled={!inComparison && compareIds.length >= 2} aria-pressed={inComparison} onClick={() => onCompare(id)}><Columns2 size={17} /> {inComparison ? '비교에서 빼기' : '비교에 담기'}</button>
                <button type="button" className="button" onClick={() => onDiscuss(game.title)}>포럼에서 토론</button>
                <Trailer game={game} />
                {webUrl(game.sourceUrl) && <a className="button" href={game.sourceUrl} target="_blank" rel="noreferrer">RAWG 출처 <ExternalLink size={15} /></a>}
                {webUrl(game.officialUrl) && <a className="button" href={game.officialUrl} target="_blank" rel="noreferrer">공식 사이트 <ExternalLink size={15} /></a>}
              </div>
              <RelatedNews title={game.title} />
              {similar.data?.length > 0 && <SimilarGames games={similar.data} onGame={onGame} />}
              {similar.error && <WaitState request={similar} />}
            </div>
          </>
        )}
      </WaitState>
    </Dialog>
  );
}
