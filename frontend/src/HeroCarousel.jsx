import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { dateLabel } from './calendar.js';
import { heroEmbedUrl } from './lib/trailer.js';
import { Cover } from './ReleaseViews.jsx';
import { useMedia } from './useMedia.js';

const slideDuration = 12_000;
let playerApi;

function loadPlayerApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (playerApi) return playerApi;

  playerApi = new Promise((resolve, reject) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    const script = document.createElement('script');

    function finish(error) {
      clearTimeout(timeout);
      window.onYouTubeIframeAPIReady = previousCallback;
      if (error) {
        script.remove();
        reject(error);
      } else {
        resolve(window.YT);
      }
    }

    const timeout = setTimeout(() => finish(new Error('YouTube API timeout')), 9_000);
    window.onYouTubeIframeAPIReady = () => {
      finish();
      previousCallback?.();
    };
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => finish(new Error('YouTube API unavailable'));
    document.head.append(script);
  }).catch((error) => {
    playerApi = null;
    throw error;
  });

  return playerApi;
}

function TrailerBackground({ src, title }) {
  const slot = useRef(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const url = new URL(src);
    url.searchParams.set('enablejsapi', '1');
    url.searchParams.set('origin', window.location.origin);

    const iframe = document.createElement('iframe');
    iframe.src = url.href;
    iframe.title = title + ' 트레일러';
    iframe.allow = 'autoplay; encrypted-media';
    iframe.tabIndex = -1;
    iframe.loading = 'eager';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.setAttribute('aria-hidden', 'true');
    slot.current.append(iframe);

    let player;
    let disposed = false;
    let failed = false;
    let reveal;
    const timeout = setTimeout(fail, slideDuration);

    function removePlayer() {
      clearTimeout(timeout);
      clearTimeout(reveal);
      player?.destroy();
      player = null;
      iframe.remove();
    }

    function fail() {
      if (disposed || failed) return;
      failed = true;
      setPlaying(false);
      clearTimeout(timeout);
      clearTimeout(reveal);
      player?.stopVideo();
    }

    loadPlayerApi().then((YT) => {
      if (disposed || failed) return;
      player = new YT.Player(iframe, {
        events: {
          onReady: ({ target }) => {
            if (!disposed && !failed) {
              target.mute();
              target.playVideo();
            }
          },
          onStateChange: ({ data }) => {
            if (disposed || failed) return;
            clearTimeout(reveal);
            if (data === YT.PlayerState.PLAYING) {
              clearTimeout(timeout);
              reveal = setTimeout(() => setPlaying(true), 200);
            } else {
              setPlaying(false);
            }
          },
          onError: fail,
          onAutoplayBlocked: fail,
        },
      });
    }).catch(fail);

    return () => {
      disposed = true;
      removePlayer();
    };
  }, [src, title]);

  return <div className="hero-player" data-playing={playing} ref={slot} aria-hidden="true" />;
}

function readPageVisibility() {
  return !document.hidden && document.visibilityState !== 'hidden';
}

function usePageVisible() {
  const [visible, setVisible] = useState(readPageVisibility);

  useEffect(() => {
    let frame;
    const update = () => setVisible(readPageVisibility());
    const recheck = () => {
      update();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };

    document.addEventListener('visibilitychange', recheck);
    window.addEventListener('focus', recheck);
    window.addEventListener('pageshow', recheck);
    recheck();

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', recheck);
      window.removeEventListener('focus', recheck);
      window.removeEventListener('pageshow', recheck);
    };
  }, []);

  return visible;
}

function HeroPosters({ game }) {
  const [layers, setLayers] = useState(null);

  useEffect(() => {
    if (!game) return;
    let active = true;
    function show(poster) {
      if (!active) return;
      setLayers((current) => (
        current?.front.id === poster.id && current.front.coverImageUrl === poster.coverImageUrl
          ? current
          : { front: poster, back: current?.front }
      ));
    }
    if (!game.coverImageUrl) {
      show(game);
      return;
    }
    const image = new Image();
    image.src = game.coverImageUrl;
    image.decode().then(() => show(game), () => show({ ...game, coverImageUrl: null }));
    return () => { active = false; };
  }, [game]);

  const front = layers?.front || game;
  return (
    <div className="hero-art" aria-hidden="true">
      {layers?.back && <Cover key={'previous-' + layers.back.id} game={layers.back} className="hero-poster" eager />}
      <Cover key={'poster-' + front?.id} game={front} className="hero-poster hero-poster-front" eager />
    </div>
  );
}

export default function HeroCarousel({ games, fallback, blocked, onGame }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const pageVisible = usePageVisible();
  const pendingActivation = useRef(null);
  const swipe = useRef(null);
  const reducedMotion = useMedia('(prefers-reduced-motion: reduce)');
  const count = games.length;
  const active = count > 0 ? index % count : 0;
  const game = games[active] || fallback;
  const upcomingCover = count > 1 ? games[(active + 1) % count].coverImageUrl : null;
  const rotating = count > 1 && !paused && !hovered && !focused && pageVisible && !reducedMotion && !blocked;
  const embed = count > 0 && pageVisible && !reducedMotion && !blocked
    ? heroEmbedUrl(game?.trailerUrl, { loop: false })
    : null;

  useEffect(() => {
    if (!rotating) return;
    const timeout = setTimeout(() => setIndex((current) => (current + 1) % count), slideDuration);
    return () => clearTimeout(timeout);
  }, [active, count, rotating]);

  useEffect(() => {
    if (!upcomingCover || !/^https?:\/\//i.test(upcomingCover)) return;
    const poster = new Image();
    poster.src = upcomingCover;
  }, [upcomingCover]);

  function openGame(event) {
    const input = event.detail > 0 || event.nativeEvent.pointerType ? 'pointer' : 'keyboard';
    const pending = pendingActivation.current;
    pendingActivation.current = null;
    onGame(pending?.input === input ? pending.id : game.id);
  }

  function move(direction) {
    if (count > 1) setIndex((current) => (current + direction + count) % count);
  }

  return (
    <section
      className="hero"
      aria-label="주요 게임 트레일러"
      aria-roledescription={count > 1 ? '캐러셀' : undefined}
      tabIndex={count > 1 ? 0 : undefined}
      onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHovered(true); }}
      onPointerLeave={(event) => { if (event.pointerType === 'mouse') setHovered(false); }}
      onFocus={() => setFocused(true)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
      onKeyDown={(event) => {
        if (count < 2 || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
        event.preventDefault();
        move(event.key === 'ArrowLeft' ? -1 : 1);
      }}
      onTouchStart={(event) => {
        const touch = event.touches[0];
        swipe.current = event.touches.length === 1 ? [touch.clientX, touch.clientY] : null;
      }}
      onTouchCancel={() => { swipe.current = null; }}
      onTouchEnd={(event) => {
        if (!swipe.current) return;
        const [x, y] = swipe.current;
        const touch = event.changedTouches[0];
        const distance = touch.clientX - x;
        swipe.current = null;
        if (Math.abs(distance) > 45 && Math.abs(distance) > Math.abs(touch.clientY - y)) move(distance > 0 ? -1 : 1);
      }}
    >
      <HeroPosters game={game} />
      {embed && <TrailerBackground key={'trailer-' + game.id} src={embed} title={game.title} />}
      <div className="hero-copy" aria-live={rotating ? 'off' : 'polite'}>
        <div className="hero-slide-copy" key={game?.id}>
          <h1>{game?.title || 'ProjectFriday'}</h1>
          {game && (
            <p className="hero-meta">
              {game.releaseDate && <time dateTime={game.releaseDate}>{dateLabel(game.releaseDate)}</time>}
              <span>{game.platforms?.join(' · ') || '플랫폼 미정'}</span>
            </p>
          )}
        </div>
        {game && (
          <button
            type="button"
            className="button button-accent"
            onPointerDown={(event) => {
              if (event.button === 0 && event.isPrimary) pendingActivation.current = { input: 'pointer', id: game.id };
            }}
            onPointerCancel={() => { pendingActivation.current = null; }}
            onKeyDown={(event) => {
              if (!event.repeat && (event.key === 'Enter' || event.key === ' ')) {
                pendingActivation.current = { input: 'keyboard', id: game.id };
              }
            }}
            onBlur={() => {
              if (pendingActivation.current?.input === 'keyboard') pendingActivation.current = null;
            }}
            onClick={openGame}
          >
            게임 정보 보기
          </button>
        )}
      </div>
      {count > 1 && (
        <div className="hero-controls" aria-label="슬라이드 탐색">
          <button type="button" className="hero-control" aria-label="이전 슬라이드" onClick={() => move(-1)}><ChevronLeft size={19} /></button>
          <div className="hero-dots">
            {games.map((slide, position) => (
              <button type="button" key={slide.id} aria-label={(position + 1) + '번 슬라이드 · ' + slide.title} aria-current={position === active ? 'true' : undefined} onClick={() => setIndex(position)}><span /></button>
            ))}
          </div>
          <button type="button" className="hero-control" aria-label="다음 슬라이드" onClick={() => move(1)}><ChevronRight size={19} /></button>
          {!reducedMotion && (
            <button type="button" className="hero-control hero-pause" aria-label={paused ? '슬라이드 자동 넘김 켜기' : '슬라이드 자동 넘김 끄기'} onClick={() => setPaused(!paused)}>
              {paused ? <Play size={15} /> : <Pause size={15} />}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
