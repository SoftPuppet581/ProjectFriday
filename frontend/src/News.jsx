import { useState } from 'react';
import { Search } from 'lucide-react';
import { api } from './api/client.js';
import { FilterSelect } from './CalendarView.jsx';
import { NewsCard } from './NewsCards.jsx';
import { WaitState } from './ReleaseViews.jsx';
import { useRequest } from './useRequest.js';

const pageSize = 12;

function NewsResults({ lang, source, q }) {
  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState([]);
  const request = useRequest(api.listNews, { lang, source, q, page, limit: pageSize });
  const incoming = request.data?.items ?? [];
  const items = [...new Map([...loaded, ...incoming].map((article) => [article.id, article])).values()];
  const more = incoming.length > 0 && page * pageSize < request.data.total;

  return (
    <>
      {items.length > 0 && (
        <div className="news-grid">
          {items.map((article) => <NewsCard key={article.id} article={article} />)}
        </div>
      )}
      {(request.loading || request.error || !items.length) && (
        <WaitState request={request} empty="검색 조건에 맞는 기사가 없어요." />
      )}
      {more && (
        <div className="news-more">
          <button type="button" className="button" onClick={() => { setLoaded(items); setPage(page + 1); }}>더 보기</button>
        </div>
      )}
    </>
  );
}

export default function News() {
  const sources = useRequest(api.newsSources);
  const [lang, setLang] = useState('ko');
  const [source, setSource] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQuery] = useState('');
  const options = sources.data?.filter(({ language }) => language === lang) ?? [];

  return (
    <section className="news" aria-labelledby="news-heading">
      <header className="section-heading">
        <h1 id="news-heading">게임 뉴스</h1>
      </header>
      <div className="news-toolbar">
        <div className="segmented" aria-label="뉴스 언어">
          {[['ko', '한국어'], ['en', 'English']].map(([value, label]) => (
            <button type="button" key={value} aria-pressed={lang === value} onClick={() => {
              if (value !== lang) { setLang(value); setSource(''); }
            }}>{label}</button>
          ))}
        </div>
        <FilterSelect label="매체" value={source} options={options} onChange={setSource} />
        <form className="global-search news-search" role="search" onSubmit={(event) => {
          event.preventDefault();
          setQuery(search.trim());
        }}>
          <input aria-label="뉴스 검색" placeholder="뉴스 검색" value={search} onChange={(event) => {
            setSearch(event.target.value);
            if (!event.target.value) setQuery('');
          }} />
          <button type="submit" aria-label="뉴스 검색 실행"><Search size={17} /></button>
        </form>
      </div>
      {sources.error && <WaitState request={sources} />}
      <NewsResults key={JSON.stringify([lang, source, q])} lang={lang} source={source} q={q} />
      <p className="news-notice">기사 출처는 각 언론사입니다. 제목과 요약만 보여 주며 원문은 해당 사이트에서 확인하세요.</p>
    </section>
  );
}
