import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from './api/client.js';
import { NewsCard } from './NewsCards.jsx';
import { GameGrid, WaitState } from './ReleaseViews.jsx';
import { useRequest } from './useRequest.js';

// 가로로 넘겨 보는 게임 레일. 결과가 없으면 섹션 자체를 숨긴다.
function GameRail({ title, subtitle, request, onGame, favorites, onFavorite }) {
  const scroller = useRef(null);
  const games = request.data?.items;
  if (!request.error && request.data && !games?.length) return null;

  const scroll = (direction) => scroller.current?.scrollBy({ left: direction * scroller.current.clientWidth * 0.85, behavior: 'smooth' });
  return (
    <section className="home-section" aria-label={title}>
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="rail-controls">
          <button type="button" className="icon-button" aria-label={title + ' 이전'} onClick={() => scroll(-1)}><ChevronLeft size={18} /></button>
          <button type="button" className="icon-button" aria-label={title + ' 다음'} onClick={() => scroll(1)}><ChevronRight size={18} /></button>
        </div>
      </div>
      <WaitState request={request} empty="표시할 게임이 없어요.">
        {games?.length > 0 ? (
          <div className="rail-scroller" ref={scroller}>
            <GameGrid games={games} onGame={onGame} favorites={favorites} onFavorite={onFavorite} />
          </div>
        ) : null}
      </WaitState>
    </section>
  );
}

export function ThisWeekRail({ week, platform, genre, ...props }) {
  const request = useRequest(api.listGames, { from: week.from, to: week.to, platform, genre, sort: '-popularity', limit: 12 });
  return <GameRail title="이번 주 출시" subtitle="일요일부터 토요일까지 나오는 게임" request={request} {...props} />;
}

export function TopRatedRail({ platform, genre, ...props }) {
  const request = useRequest(api.listGames, { minRating: 4, platform, genre, sort: '-rating', limit: 12 });
  return <GameRail title="평점 높은 게임" subtitle="평점 4.0 이상" request={request} {...props} />;
}

export function NewsStrip({ onNews }) {
  const request = useRequest(api.listNews, { limit: 3, lang: 'ko' });
  const articles = request.data?.items;
  if (!request.error && request.data && !articles?.length) return null;
  return (
    <section className="home-section" aria-label="최신 뉴스">
      <div className="section-heading">
        <h2>최신 게임 뉴스</h2>
        <button type="button" className="button button-small" onClick={onNews}>뉴스 더 보기</button>
      </div>
      <WaitState request={request} empty="뉴스가 아직 없어요.">
        {articles?.length > 0 ? <div className="home-news">{articles.map((article) => <NewsCard key={article.id} article={article} />)}</div> : null}
      </WaitState>
    </section>
  );
}
