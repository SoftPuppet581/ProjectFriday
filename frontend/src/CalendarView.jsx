import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Cover, FlagshipMarker, GameList, WaitState } from './ReleaseViews.jsx';
import { dateLabel, monthDays, monthLabel, weekdays } from './calendar.js';
import { addDays, monthKey, parseIso, weekRange } from './lib/dates.js';
import { useMedia } from './useMedia.js';

export function FilterSelect({ label, value, options, onChange }) {
  return (
    <label className="filter-select">
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{label} 전체</option>
        {options.map(({ name }) => <option key={name} value={name}>{name}</option>)}
      </select>
    </label>
  );
}

export function CalendarControls({ anchor, mode, onMove, onMode, onToday, filters }) {
  const week = weekRange(anchor, 0);
  return (
    <div className="calendar-toolbar">
      <div className="date-navigation">
        <button type="button" className="icon-button" aria-label="이전 기간" onClick={() => onMove(-1)}><ChevronLeft size={19} /></button>
        <h3>{mode === 'week' ? dateLabel(week.from) + ' – ' + dateLabel(week.to) : monthLabel(monthKey(anchor))}</h3>
        <button type="button" className="icon-button" aria-label="다음 기간" onClick={() => onMove(1)}><ChevronRight size={19} /></button>
        <button type="button" className="button button-small today-button" onClick={onToday}>오늘</button>
      </div>
      <div className="filter-row">
        {filters}
        <div className="segmented" aria-label="달력 보기">
          <button type="button" aria-pressed={mode === 'month'} onClick={() => onMode('month')}>월간</button>
          <button type="button" aria-pressed={mode === 'week'} onClick={() => onMode('week')}>주간</button>
        </div>
      </div>
    </div>
  );
}

function MobileAgenda({ days, entries, schedule, results, today, selectedDay, onDay, onGame, onAll }) {
  const selected = useRef(null);
  const releaseDays = days.filter((day) => entries.has(day) || day === selectedDay);
  const selectedGames = results.data?.items ?? [];

  useEffect(() => {
    if (selectedDay && !schedule.loading) selected.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedDay, schedule.loading]);

  return (
    <section className="mobile-agenda" aria-label="날짜별 출시 목록">
      <WaitState request={schedule} empty="이 기간에 등록된 출시작이 없어요.">
        {releaseDays.length > 0 ? (
          <div className="agenda-days">
            {releaseDays.map((day) => {
              const active = selectedDay === day;
              const entry = entries.get(day);
              const preview = entry?.games?.slice(0, 2) ?? [];
              const more = (entry?.count ?? 0) - preview.length;
              const dateId = 'agenda-' + day;

              return (
                <article key={day} ref={active ? selected : null} className="panel agenda-day" data-active={active}>
                  <h3>
                    <button type="button" className="agenda-date" aria-expanded={active} aria-controls={dateId} aria-current={day === today ? 'date' : undefined} onClick={() => onDay(day)}>
                      <time dateTime={day}>{dateLabel(day)} <small>{weekdays[parseIso(day).getDay()]}요일</small></time>
                      <span>{entry?.count ?? 0}개 출시 <ChevronRight size={16} /></span>
                    </button>
                  </h3>
                  <div id={dateId}>
                    {active ? (
                      <WaitState request={results} empty="이날에 등록된 출시작이 없어요.">
                        {selectedGames.length > 0 ? <GameList games={selectedGames} onGame={onGame} /> : null}
                      </WaitState>
                    ) : (
                      <>
                        <ul className="agenda-previews">
                          {preview.map((game) => (
                            <li key={game.id}>
                              <button type="button" className="agenda-game" onClick={() => onGame(game.id)}>
                                <Cover game={game} />
                                <strong><FlagshipMarker game={game} />{game.title}</strong>
                              </button>
                            </li>
                          ))}
                        </ul>
                        {more > 0 && <button className="agenda-more" onClick={() => onDay(day)} type="button">+{more}개 모두 보기</button>}
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </WaitState>
      {releaseDays.length > 0 && <button type="button" className="button" onClick={onAll}>이 기간 게임 모두 보기</button>}
      <p className="calendar-note">출시 정보는 변경될 수 있음</p>
    </section>
  );
}

export default function CalendarView({ anchor, mode, results, schedule, today, selectedDay, onDay, onGame, onAll }) {
  const mobile = useMedia('(max-width: 600px)');
  const month = monthKey(anchor);
  const gridStart = weekRange(anchor, 0).from;
  const days = mode === 'week' ? Array.from({ length: 7 }, (_, index) => addDays(gridStart, index)) : monthDays(month);
  const entries = new Map((schedule.data || []).map((entry) => [entry.date, entry]));
  const games = results.data?.items || [];
  const total = results.data?.total ?? 0;
  const resultsPanel = useRef(null);

  useEffect(() => {
    if (!mobile && selectedDay && matchMedia('(max-width: 800px)').matches) {
      resultsPanel.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [mobile, selectedDay]);

  if (mobile) {
    return (
      <MobileAgenda days={days} entries={entries} schedule={schedule} results={results} today={today} selectedDay={selectedDay} onDay={onDay} onGame={onGame} onAll={onAll} />
    );
  }

  return (
    <div className="calendar-layout">
      <section className={'panel calendar ' + (mode === 'week' ? 'calendar-week' : '')} aria-label="게임 출시 달력">
        {schedule.error && <WaitState request={schedule} />}
        {schedule.loading && <div className="calendar-progress" role="status"><span className="sr-only">일정 불러오는 중…</span></div>}
        <div className="weekday-row" aria-hidden="true">
          {weekdays.map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="calendar-grid" key={mode + (mode === 'week' ? gridStart : month)}>
          {days.map((day) => {
            const entry = entries.get(day);
            const shown = entry?.games ?? [];
            const count = entry?.count ?? 0;
            const otherMonth = mode === 'month' && monthKey(day) !== month;
            const classes = ['calendar-day', otherMonth && 'outside', day === selectedDay && 'selected', day === today && 'current', count >= 10 ? 'very-busy' : count >= 5 ? 'busy' : count >= 2 && 'has-releases'].filter(Boolean).join(' ');
            return (
              <div className={classes} key={day}>
                <button type="button" className="day-hitbox" aria-pressed={day === selectedDay} aria-current={day === today ? 'date' : undefined} aria-label={dateLabel(day, true) + ' ' + count + '개 출시'} onClick={() => onDay(day)}>
                  <time dateTime={day}>{parseIso(day).getDate()}</time>
                </button>
                <div className="day-games">
                  {shown.map((game) => (
                    <button type="button" key={game.id} className="day-game" onClick={() => onGame(game.id)} title={game.title}>
                      <Cover game={game} />
                      <span className="sr-only">{game.title}</span>
                      <FlagshipMarker game={game} />
                    </button>
                  ))}
                  {count > shown.length && <button type="button" className="day-more" onClick={() => onDay(day)}>+{count - shown.length}개</button>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="calendar-note">출시 정보는 변경될 수 있음</div>
      </section>

      <aside ref={resultsPanel} className="panel upcoming">
        <header className="upcoming-header">
          <div>
            <h3>{selectedDay ? dateLabel(selectedDay) + ' 출시작' : mode === 'week' ? '이 주의 출시작' : '이달의 출시작'}</h3>
            {results.data && <p>{total}개 게임</p>}
          </div>
          {selectedDay && <button type="button" className="button button-small clear-day" onClick={() => onDay(null)}>전체</button>}
        </header>
        <WaitState request={results} empty="이 기간에 등록된 출시작이 없어요.">
          {games.length > 0 ? <GameList games={games.slice(0, selectedDay ? 200 : 6)} onGame={onGame} /> : null}
        </WaitState>
        {!selectedDay && total > 6 && <button type="button" className="more-list" onClick={onAll}>이 기간 게임 모두 보기</button>}
      </aside>
    </div>
  );
}
