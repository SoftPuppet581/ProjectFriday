import { useState } from 'react';
import { api } from './api/client.js';
import { useRequest } from './useRequest.js';

const relativeTime = new Intl.RelativeTimeFormat('ko-KR', { numeric: 'auto' });
const timestamp = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });

function httpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value) ? value : undefined;
}

export function PublishedTime({ value }) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const minutes = (date.getTime() - Date.now()) / 60_000;
  const label = Math.abs(minutes) < 1
    ? '방금 전'
    : Math.abs(minutes) < 60
      ? relativeTime.format(Math.round(minutes), 'minute')
      : Math.abs(minutes) < 1440
        ? relativeTime.format(Math.round(minutes / 60), 'hour')
        : relativeTime.format(Math.round(minutes / 1440), 'day');
  return <time dateTime={date.toISOString()} title={timestamp.format(date)}>{label}</time>;
}

export function NewsCard({ article }) {
  const [imageState, setImageState] = useState('loading');
  const image = imageState === 'failed' ? undefined : httpUrl(article.imageUrl);
  return (
    <article className={'news-card' + (image ? '' : ' news-card-text')}>
      <a href={httpUrl(article.url)} target="_blank" rel="noopener noreferrer">
        {image && (
          <div className="news-photo" data-state={imageState}>
            <img className="news-thumb" src={image} alt="" loading="lazy" onLoad={() => setImageState('ready')} onError={() => setImageState('failed')} />
            {imageState === 'loading' && <span className="cover-shimmer" aria-hidden="true" />}
          </div>
        )}
        <div className="news-card-copy">
          <p className="news-meta"><span>{article.source}</span><PublishedTime value={article.publishedAt} /></p>
          <h2>{article.title}</h2>
          {article.excerpt && <p className="news-excerpt">{article.excerpt}</p>}
        </div>
      </a>
    </article>
  );
}

export function RelatedNews({ title }) {
  const request = useRequest(api.listNews, { q: title, limit: 5 });
  const articles = request.data?.items?.filter((article) => httpUrl(article.url)) ?? [];
  if (!articles.length) return null;
  return (
    <section className="related-news">
      <h3>관련 뉴스</h3>
      <ul>
        {articles.map((article) => (
          <li key={article.id}>
            <a href={httpUrl(article.url)} target="_blank" rel="noopener noreferrer">
              <strong>{article.title}</strong>
              <span className="news-meta"><span>{article.source}</span><PublishedTime value={article.publishedAt} /></span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
