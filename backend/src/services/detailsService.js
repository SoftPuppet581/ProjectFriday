import { isAdultGame } from './contentFilter.js';

const names = (arr) => (Array.isArray(arr) ? arr.map((x) => x?.name).filter(Boolean) : []);
const httpOrNull = (v) => (typeof v === 'string' && /^https?:\/\//i.test(v) && v.length <= 500 ? v : null);

// 설명이 없는 게임의 상세(설명, 개발사, 배급사, 공식 사이트)를 RAWG에서 가져와 채운다.
// 설명을 보고서야 성인물로 드러나면 그 게임은 저장하지 않고 삭제한다 (성인 게임은 사이트에 두지 않는다).
// games: [{ id, externalId, title, tags, esrbRating }]. 키 오류나 한도 초과(fatal)는 멈추고, 한 게임의 실패는 건너뛴다.
export async function fillDetails({ client, games, save, remove, log = () => {} }) {
  const stats = { checked: 0, filled: 0, removedAdult: 0, failed: 0 };

  for (const [index, game] of games.entries()) {
    try {
      const detail = await client.getGame(game.externalId);
      const description = detail?.description_raw ? String(detail.description_raw).slice(0, 20000) : null;

      if (isAdultGame({ title: game.title, tags: game.tags, esrbRating: game.esrbRating, description })) {
        await remove(game.id);
        stats.removedAdult += 1;
        log(`  성인물로 판정되어 삭제: ${game.title}`);
      } else {
        await save(game.id, {
          description,
          officialUrl: httpOrNull(detail?.website),
          developers: names(detail?.developers),
          publishers: names(detail?.publishers),
        });
        if (description) stats.filled += 1;
      }
      stats.checked += 1;
    } catch (error) {
      if (error.fatal) throw error;
      stats.failed += 1;
      log(`  건너뜀 (${game.title ?? game.id}): ${error.message}`);
    }
    if ((index + 1) % 50 === 0) log(`상세 확인 ${index + 1}/${games.length}`);
  }
  return stats;
}
