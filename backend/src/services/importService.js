import { mapRawgGame } from './rawgMapper.js';

// 목록을 pages 쪽까지 읽고, 인기 상위 details개는 상세 정보와 트레일러까지 가져와 저장한다.
export async function importGames({ client, upsert, from, to, pages = 10, pageSize = 40, details = 100, movies = true, log = () => {} }) {
  const stats = { fetched: 0, inserted: 0, updated: 0, unchanged: 0, skipped: 0 };

  const collected = [];
  for (let page = 1; page <= pages; page += 1) {
    const data = await client.listGames({ from, to, page, pageSize });
    collected.push(...(data.results ?? []));
    log(`목록 ${page}쪽: ${collected.length}개 읽음 (전체 ${data.count ?? '?'}개)`);
    if (!data.next) break;
  }
  stats.fetched = collected.length;

  for (const [index, listItem] of collected.entries()) {
    let detail = null;
    let clips = null;

    if (index < details) {
      detail = await optional(() => client.getGame(listItem.id), log);
      if (movies) clips = await optional(() => client.getMovies(listItem.id), log);
    }

    const game = mapRawgGame(listItem, detail, clips);
    if (!game) {
      stats.skipped += 1;
      continue;
    }

    try {
      const { action } = await upsert(game);
      stats[action] += 1;
    } catch (error) {
      if (error.code !== 'ER_DUP_ENTRY') throw error;
      stats.skipped += 1; // 같은 제목과 출시일의 다른 게임이 이미 있음
    }

    if ((index + 1) % 25 === 0) log(`저장 ${index + 1}/${collected.length}`);
  }

  return stats;
}

// 상세/영상 호출 실패는 그 게임만 건너뛰고 계속한다. 키 오류나 한도 초과(fatal)는 멈춘다.
async function optional(call, log) {
  try {
    return await call();
  } catch (error) {
    if (error.fatal) throw error;
    log(`  건너뜀: ${error.message}`);
    return null;
  }
}
