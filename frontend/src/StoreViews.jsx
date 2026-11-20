import { ExternalLink } from 'lucide-react';
import { toIso } from './lib/dates.js';
import { formatPrice, newsSearchLink, steamClientLink, storeLinks } from './lib/stores.js';

const utcFormat = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC',
});

function webLink(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

function hasPcPlatform(game) {
  return game.platforms?.some((platform) => platform.trim().toLowerCase() === 'pc') ?? false;
}

function missingPriceReason(game) {
  if (!game.platforms?.length) return '플랫폼 정보 없음';
  if (!hasPcPlatform(game)) return '등록된 PC 플랫폼 없음';
  if (game.releaseDate && game.releaseDate > toIso(new Date())) return '출시 예정';

  const hasSteamStore = Boolean(game.steamStoreUrl || game.steamAppId || game.stores?.some(({ name }) => name === 'Steam'));
  return hasSteamStore ? 'Steam 가격 정보 없음' : 'Steam 상품 링크 없음';
}

export function GamePrice({ game, large = false }) {
  const { kind, text, originalText, discountText } = formatPrice(game.price);
  return (
    <span className={'game-price price-' + kind + (large ? ' price-large' : '')}>
      <strong>{text}</strong>
      {kind === 'unknown' && <span className="price-reason">· {missingPriceReason(game)}</span>}
      {originalText && <del>{originalText}</del>}
      {discountText && <span className="discount">{discountText}</span>}
    </span>
  );
}

export function PriceNote({ price }) {
  const updated = price?.updatedAt ? new Date(price.updatedAt) : null;
  return (
    <span className="price-note">
      Steam 원화 기준 · 변동될 수 있음
      {updated && !Number.isNaN(updated.valueOf()) && (
        <time dateTime={updated.toISOString()}>기준 {utcFormat.format(updated)} UTC</time>
      )}
    </span>
  );
}

function availableStores(game) {
  return storeLinks(game).filter((link) => webLink(link.url) && (link.key !== 'steam-search' || hasPcPlatform(game)))
    .sort((first, second) => Number(second.key === 'steam') - Number(first.key === 'steam'));
}

export function QuickStore({ game }) {
  const first = availableStores(game)[0];
  if (!first) return null;
  return (
    <a className="quick-store" href={first.url} target="_blank" rel="noopener noreferrer" aria-label={game.title + ' · ' + first.label} title={first.label}>
      <span>{first.label}</span><ExternalLink size={12} aria-hidden="true" />
    </a>
  );
}

export function StoreActions({ game }) {
  const links = availableStores(game);
  const client = steamClientLink(game);
  const news = newsSearchLink(game);
  return (
    <div className="store-actions">
      {links.map(({ key, url, kind, label }) => (
        <a className={'button' + (key === 'steam' && kind === 'store' ? ' button-accent' : '')} href={url} target="_blank" rel="noopener noreferrer" key={key + url}>
          {label}<ExternalLink size={13} aria-hidden="true" />
        </a>
      ))}
      {typeof client === 'string' && /^steam:\/\//i.test(client) && (
        <a className="button" href={client}>Steam 앱으로 열기</a>
      )}
      {webLink(news) && <a className="button" href={news} target="_blank" rel="noopener noreferrer">네이버 뉴스 검색<ExternalLink size={13} aria-hidden="true" /></a>}
    </div>
  );
}
