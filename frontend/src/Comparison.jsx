import { X } from 'lucide-react';
import { api } from './api/client.js';
import { dateLabel } from './calendar.js';
import { Cover, Dialog, WaitState } from './ReleaseViews.jsx';
import { GamePrice, PriceNote, StoreActions } from './StoreViews.jsx';
import { useRequest } from './useRequest.js';

const facts = [
  ['가격', (game) => <><GamePrice game={game} /><PriceNote price={game.price} /></>],
  ['바로 가기', (game) => <StoreActions game={game} />],
  ['출시일', (game) => dateLabel(game.releaseDate, true)],
  ['플랫폼', (game) => game.platforms?.join(', ') || '미정'],
  ['장르', (game) => game.genres?.join(', ') || game.genre || '—'],
  ['RAWG 평점', (game) => game.rating > 0 ? Number(game.rating).toFixed(2) + ' / 5' : '—'],
  ['Metacritic', (game) => game.metacritic > 0 ? game.metacritic : '—'],
];

export default function Comparison({ ids, onRemove, onClose }) {
  const request = useRequest(ids.length ? api.listGames : null, { ids, limit: 2 });
  const games = ids.map((id) => request.data?.items.find((game) => game.id === id)).filter(Boolean);

  return (
    <Dialog label="게임 비교" onClose={onClose}>
      <div className="comparison">
        <h2>게임 비교</h2>
        <WaitState request={request} empty="비교할 게임을 찾을 수 없어요.">
          {games.length > 0 ? (
            <>
              {games.length === 1 && <p className="comparison-hint">다른 게임을 비교에 담아 주세요.</p>}
              <table>
                <thead>
                  <tr>
                    <th scope="col">항목</th>
                    {games.map((game) => (
                      <th key={game.id} scope="col">
                        <Cover game={game} />
                        <span>{game.title}</span>
                        <button type="button" className="icon-button" aria-label={game.title + ' 비교에서 빼기'} onClick={() => onRemove(game.id)}><X size={15} /></button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {facts.map(([label, read]) => (
                    <tr key={label}><th scope="row">{label}</th>{games.map((game) => <td key={game.id}>{read(game)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}
        </WaitState>
      </div>
    </Dialog>
  );
}
