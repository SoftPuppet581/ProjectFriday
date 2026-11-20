import * as Game from '../models/Game.js';
import HttpError from '../utils/HttpError.js';
import { buildGameIcs } from '../utils/ics.js';

const notFound = (id) => new HttpError(404, `id ${id} 게임을 찾을 수 없습니다.`);

// 전체 개수는 X-Total-Count 헤더로 알려 준다 (본문은 계속 배열)
export async function list(req, res) {
  const { items, total } = await Game.findAll(req.filters);
  res.set('X-Total-Count', String(total)).json(items);
}

export async function get(req, res) {
  const game = await Game.findById(req.params.id);
  if (!game) throw notFound(req.params.id);
  res.json(game);
}

export async function create(req, res) {
  const game = await Game.create(req.body);
  res.status(201).location(`/api/games/${game.id}`).json(game);
}

export async function replace(req, res) {
  const game = await Game.replace(req.params.id, req.body);
  if (!game) throw notFound(req.params.id);
  res.json(game);
}

export async function patch(req, res) {
  const game = await Game.patch(req.params.id, req.body);
  if (!game) throw notFound(req.params.id);
  res.json(game);
}

export async function remove(req, res) {
  const deleted = await Game.remove(req.params.id);
  if (!deleted) throw notFound(req.params.id);
  res.status(204).end();
}

export async function similar(req, res) {
  const games = await Game.findSimilar(req.params.id, req.filters.limit ?? 6);
  if (!games) throw notFound(req.params.id);
  res.json(games);
}

export async function calendarIcs(req, res) {
  const game = await Game.findById(req.params.id);
  if (!game) throw notFound(req.params.id);
  res
    .type('text/calendar; charset=utf-8')
    .set('Content-Disposition', `attachment; filename="game-${game.id}.ics"`)
    .send(buildGameIcs(game));
}

export async function calendar(req, res) {
  res.json(await Game.calendarSummary(req.filters));
}

export async function genres(req, res) {
  res.json(await Game.countByGenre());
}

export async function platforms(req, res) {
  res.json(await Game.countByPlatform());
}
