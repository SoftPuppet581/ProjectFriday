import { useEffect, useState } from 'react';
import { Bookmark, Columns2, Gamepad2, Search } from 'lucide-react';
import { api } from './api/client.js';
import CalendarView, { CalendarControls, FilterSelect } from './CalendarView.jsx';
import { monthLabel } from './calendar.js';
import Forum from './Forum.jsx';
import HeroCarousel from './HeroCarousel.jsx';
import News from './News.jsx';
import Comparison from './Comparison.jsx';
import AuthDialog from './AuthDialog.jsx';
import { NewsStrip, ThisWeekRail, TopRatedRail } from './HomeRails.jsx';
import { clearToken, loadToken, saveToken } from './lib/auth.js';
import { DateBadge, GameDetail, GameGrid, WaitState } from './ReleaseViews.jsx';
import { addDays, dDay, monthKey, shiftMonth, toIso, weekRange } from './lib/dates.js';
import { loadFavorites, loadPlatform, saveFavorites, savePlatform, toggleFavorite } from './lib/storage.js';
import { useRequest } from './useRequest.js';

const navigation = [
  ['calendar', '출시 캘린더'],
  ['catalog', '게임 탐색'],
  ['news', '뉴스'],
  ['favorites', '관심 게임'],
  ['forum', '포럼'],
];

function Header({ view, onView, search, onSearch, onSubmit, user, onLogin, onLogout }) {
  const [scrolled, setScrolled] = useState(() => window.scrollY > 8);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', update, { passive: true });
    update();
    return () => window.removeEventListener('scroll', update);
  }, []);
  return (
    <header className="site-header" data-scrolled={scrolled}>
      <div className="shell header-inner">
        <button type="button" className="brand" onClick={() => onView('calendar')} aria-label="ProjectFriday 홈">
          <span className="brand-icon"><Gamepad2 size={23} strokeWidth={2.4} /></span>
          <span>Project<span>Friday</span></span>
        </button>
        <nav className="main-nav" aria-label="주 메뉴">
          {navigation.map(([key, label]) => (
            <button key={key} type="button" aria-current={key === view ? 'page' : undefined} onClick={() => onView(key)}>
              {label}
            </button>
          ))}
        </nav>
        <form className="global-search" role="search" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
          <input aria-label="게임 검색" placeholder="게임 검색" value={search} onChange={(event) => onSearch(event.target.value)} />
          <button type="submit" aria-label="검색 실행"><Search size={18} /></button>
        </form>
        {user ? (
          <div className="account">
            <span className="account-name" title={user.email}>{user.displayName}</span>
            <button type="button" className="button button-small" onClick={onLogout}>로그아웃</button>
          </div>
        ) : (
          <button type="button" className="button button-small button-accent" onClick={onLogin}>로그인</button>
        )}
      </div>
    </header>
  );
}

async function fetchFavorites(ids) {
  const groups = [];
  for (let index = 0; index < ids.length; index += 100) {
    groups.push(api.listGames({ ids: ids.slice(index, index + 100), limit: 100 }));
  }
  const responses = await Promise.all(groups);
  return responses.flatMap(({ items }) => items).sort((first, second) => first.releaseDate.localeCompare(second.releaseDate));
}

function Catalog({ query, period, platform, genre, filters, favorites, onFavorite, onGame, onClear }) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('-popularity');
  const request = useRequest(api.listGames, { ...period, q: query, platform, genre, sort, limit: 24, page });
  const games = request.data?.items;
  const total = request.data?.total ?? 0;
  const pageCount = Math.ceil(total / 24);

  return (
    <section aria-labelledby="catalog-heading">
      <div className="section-heading">
        <div>
          <h2 id="catalog-heading">{query ? '게임 검색 결과' : '게임 탐색'}</h2>
          {request.data && <p>{query ? '“' + query + '” · ' : ''}{period?.month ? monthLabel(period.month) + ' · ' : ''}{total}개 게임</p>}
        </div>
        <div className="filter-row">
          {filters}
          <label className="filter-select">
            <select aria-label="정렬" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}>
              <option value="-popularity">인기순</option>
              <option value="-releaseDate">최근 출시순</option>
              <option value="-rating">평점순</option>
              <option value="title">이름순</option>
            </select>
          </label>
          {(query || period) && <button type="button" className="button button-small" onClick={onClear}>전체 게임</button>}
        </div>
      </div>
      <WaitState request={request} empty="조건에 맞는 게임을 찾지 못했어요.">
        {games?.length > 0 ? <GameGrid games={games} onGame={onGame} favorites={favorites} onFavorite={onFavorite} /> : null}
      </WaitState>
      {pageCount > 1 && (
        <nav className="pagination" aria-label="게임 목록 페이지">
          <button type="button" className="button" disabled={page === 1} onClick={() => setPage(page - 1)}>이전</button>
          <span>{page} / {pageCount}</span>
          <button type="button" className="button" disabled={page === pageCount} onClick={() => setPage(page + 1)}>다음</button>
        </nav>
      )}
    </section>
  );
}

function Favorites({ ids, onGame, user, onLogin }) {
  const request = useRequest(ids.length ? fetchFavorites : null, ids);
  return (
    <section aria-labelledby="favorites-heading">
      <div className="section-heading"><div><h2 id="favorites-heading">관심 게임</h2><p>{ids.length}개 게임</p></div></div>
      {!user && (
        <p className="login-note">
          지금은 이 브라우저에만 저장돼요. 로그인하면 계정에 저장되어 다른 기기에서도 볼 수 있어요.
          <button type="button" className="button button-small" onClick={onLogin}>로그인 / 회원가입</button>
        </p>
      )}
      <WaitState request={request} empty="게임 상세에서 관심 게임을 추가할 수 있어요.">
        {request.data?.length > 0 ? <GameGrid games={request.data} onGame={onGame} /> : null}
      </WaitState>
    </section>
  );
}

export default function App() {
  const today = toIso(new Date());
  const currentMonth = monthKey(today);
  const [anchor, setAnchor] = useState(() => currentMonth >= '2026-03' && currentMonth <= '2026-12' ? today : '2026-11-01');
  const [view, setView] = useState('calendar');
  const [mode, setMode] = useState('month');
  const [selectedDay, setSelectedDay] = useState(null);
  const [gameId, setGameId] = useState(null);
  const [compareIds, setCompareIds] = useState([]);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [platform, setPlatform] = useState(() => loadPlatform() || '');
  const [genre, setGenre] = useState('');
  const [favorites, setFavorites] = useState(loadFavorites);
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [catalogPeriod, setCatalogPeriod] = useState(null);
  const [draftGame, setDraftGame] = useState(null);

  const month = monthKey(anchor);
  const period = mode === 'week' ? weekRange(anchor, 0) : { month };
  const calendarActive = view === 'calendar';
  const schedule = useRequest(calendarActive ? api.calendar : null, { ...period, platform, genre, top: 3 });
  const periodGames = useRequest(calendarActive ? api.listGames : null, {
    ...(selectedDay ? { from: selectedDay, to: selectedDay } : period),
    platform, genre, sort: '-popularity', limit: selectedDay ? 200 : 6,
  });
  const featuredGames = useRequest(calendarActive ? api.featured : null);
  const spotlight = useRequest(calendarActive && !featuredGames.loading && !featuredGames.data?.length ? api.listGames : null, {
    month, sort: '-popularity', limit: 8,
  });
  const weekSummary = useRequest(calendarActive ? api.calendar : null, { ...weekRange(today, 0), platform, genre, top: 1 });
  const savedGames = useRequest(favorites.length && calendarActive ? fetchFavorites : null, favorites);
  const platformOptions = useRequest(api.platforms);
  const genreOptions = useRequest(api.genres);

  const fallback = spotlight.data?.items.find((game) => game.coverImageUrl) ?? spotlight.data?.items[0];
  const upcomingFavorite = savedGames.data?.find((game) => {
    const { days } = dDay(game.releaseDate);
    return days >= 0 && days <= 7;
  });
  const releasedCount = schedule.data?.reduce((total, entry) => total + entry.count, 0);
  const weekCount = weekSummary.data?.reduce((total, entry) => total + entry.count, 0);

  useEffect(() => savePlatform(platform), [platform]);
  // 로그인한 동안에는 관심 게임을 계정(서버)에 저장하므로, 이 브라우저의 비로그인 목록은 건드리지 않는다
  useEffect(() => { if (!user) saveFavorites(favorites); }, [favorites, user]);

  // 새로고침해도 로그인이 유지되게: 저장된 토큰으로 내 정보와 관심 게임을 다시 불러온다
  useEffect(() => {
    if (!loadToken()) return;
    api.me().then((account) => {
      setUser(account);
      if (account.preferredPlatform) setPlatform(account.preferredPlatform);
      return api.myFavoriteIds().then(setFavorites);
    }).catch((error) => { if (error.status === 401) clearToken(); });
  }, []);

  // 로그인한 사용자의 선호 플랫폼을 계정에 저장한다
  const userId = user?.id;
  useEffect(() => {
    if (userId) api.updateMe({ preferredPlatform: platform || null }).catch(() => {});
  }, [platform, userId]);

  function move(direction) {
    setSelectedDay(null);
    setAnchor(mode === 'week' ? addDays(anchor, direction * 7) : shiftMonth(month, direction) + '-01');
  }

  function goToday() {
    setAnchor(today);
    setSelectedDay(null);
  }

  function selectDay(day) {
    if (day === selectedDay || !day) {
      setSelectedDay(null);
      return;
    }
    if (mode === 'month' && monthKey(day) !== month) setAnchor(day);
    setSelectedDay(day);
  }

  function changeMode(next) {
    if (selectedDay) setAnchor(selectedDay);
    setMode(next);
  }

  function openCatalog(searchQuery, range = null) {
    setQuery(searchQuery);
    setCatalogPeriod(range);
    setView('catalog');
  }

  function jump(date) {
    setGameId(null);
    setPlatform('');
    setGenre('');
    setAnchor(date);
    setMode('month');
    setSelectedDay(date);
    setView('calendar');
  }

  function discuss(title) {
    setGameId(null);
    setDraftGame(title);
    setView('forum');
  }

  function updateComparison(id) {
    setCompareIds((current) => current.includes(id) ? current.filter((entry) => entry !== id) : current.length < 2 ? [...current, id] : current);
  }

  // 로그인 성공: 토큰을 저장하고, 로그인 전에 이 브라우저에 담아 둔 관심 게임을 계정에 합친다
  async function handleAuth({ token, user: account }) {
    saveToken(token);
    setUser(account);
    setAuthOpen(false);
    if (account.preferredPlatform) setPlatform(account.preferredPlatform);
    try {
      const local = loadFavorites();
      setFavorites(local.length ? await api.mergeFavorites(local) : await api.myFavoriteIds());
      if (local.length) saveFavorites([]); // 합쳤으니 다음 로그인 때 다시 합쳐지지 않게 비운다
    } catch {
      setFavorites([]);
    }
  }

  function handleLogout() {
    api.logout().catch(() => {}); // 서버 세션 삭제는 실패해도 이 브라우저에서는 로그아웃된다
    clearToken();
    setUser(null);
    setFavorites([]);
  }

  // 관심 게임 토글: 화면은 먼저 바꾸고(빠른 반응), 로그인 상태면 서버에도 저장한다. 실패하면 되돌린다
  const onFavorite = (id) => {
    const adding = !favorites.includes(id);
    setFavorites((current) => toggleFavorite(current, id));
    if (!user) return;
    (adding ? api.addFavorite(id) : api.removeFavorite(id)).catch((error) => {
      setFavorites((current) => (adding ? current.filter((entry) => entry !== id) : [...current, id]));
      if (error.status === 401) handleLogout(); // 로그인이 만료됨
    });
  };
  const filters = (
    <>
      <FilterSelect label="플랫폼" value={platform} options={platformOptions.data || []} onChange={setPlatform} />
      <FilterSelect label="장르" value={genre} options={genreOptions.data || []} onChange={setGenre} />
    </>
  );

  return (
    <div className="app">
      <Header view={view} onView={(next) => next === 'catalog' ? openCatalog('') : setView(next)} search={search} onSearch={setSearch} onSubmit={() => openCatalog(search.trim())} user={user} onLogin={() => setAuthOpen(true)} onLogout={handleLogout} />
      <main className="shell main-content">
        {compareIds.length > 0 && (
          <div className="comparison-bar">
            <button type="button" className="button" onClick={() => setComparisonOpen(true)}><Columns2 size={17} /> 게임 비교 <strong>{compareIds.length}/2</strong></button>
          </div>
        )}
        {calendarActive && (
          <>
            <HeroCarousel games={featuredGames.data ?? []} fallback={fallback} blocked={Boolean(gameId || comparisonOpen)} onGame={setGameId} />
            <ThisWeekRail week={weekRange(today, 0)} platform={platform} genre={genre} onGame={setGameId} favorites={favorites} onFavorite={onFavorite} />
            <section className="calendar-section" aria-labelledby="calendar-heading">
              <div className="section-heading">
                <div className="heading-inline">
                  <h2 id="calendar-heading">출시 캘린더</h2>
                  {releasedCount !== undefined && <span className="section-count">{releasedCount}개 일정</span>}
                </div>
                {weekCount !== undefined && (
                  <button type="button" className="week-summary" onClick={() => { goToday(); setMode('week'); }}>
                    이번 주 <strong>{weekCount}개 출시</strong>
                  </button>
                )}
              </div>
              {upcomingFavorite && (
                <button className="favorite-alert" type="button" onClick={() => setGameId(upcomingFavorite.id)}>
                  <Bookmark size={17} /> {upcomingFavorite.title} <DateBadge date={upcomingFavorite.releaseDate} />
                </button>
              )}
              {(genreOptions.error || platformOptions.error) && <WaitState request={platformOptions.error ? platformOptions : genreOptions} />}
              <CalendarControls anchor={anchor} mode={mode} onMove={move} onMode={changeMode} onToday={goToday} filters={filters} />
              <CalendarView anchor={anchor} mode={mode} results={periodGames} schedule={schedule} today={today} selectedDay={selectedDay} onDay={selectDay} onGame={setGameId} onAll={() => openCatalog('', period)} />
            </section>
            <TopRatedRail platform={platform} genre={genre} onGame={setGameId} favorites={favorites} onFavorite={onFavorite} />
            <NewsStrip onNews={() => setView('news')} />
          </>
        )}
        {view === 'catalog' && <Catalog key={JSON.stringify([query, catalogPeriod, platform, genre])} query={query} period={catalogPeriod} platform={platform} genre={genre} filters={filters} favorites={favorites} onFavorite={onFavorite} onGame={setGameId} onClear={() => { setSearch(''); setPlatform(''); setGenre(''); openCatalog(''); }} />}
        {view === 'news' && <News />}
        {view === 'favorites' && <Favorites ids={favorites} onGame={setGameId} user={user} onLogin={() => setAuthOpen(true)} />}
        {view === 'forum' && <Forum draftGame={draftGame} onClearDraft={() => setDraftGame(null)} />}
      </main>
      <footer className="site-footer">
        <div className="shell footer-inner">
          <span>ProjectFriday</span>
          <a href="https://rawg.io/" target="_blank" rel="noreferrer">Data from RAWG</a>
        </div>
      </footer>
      {authOpen && <AuthDialog onClose={() => setAuthOpen(false)} onAuth={handleAuth} />}
      {gameId && <GameDetail id={gameId} onClose={() => setGameId(null)} onGame={setGameId} onJump={jump} onDiscuss={discuss} favorites={favorites} onFavorite={onFavorite} compareIds={compareIds} onCompare={updateComparison} />}
      {comparisonOpen && <Comparison ids={compareIds} onRemove={updateComparison} onClose={() => setComparisonOpen(false)} />}
    </div>
  );
}
