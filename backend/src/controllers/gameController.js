import * as Game from '../models/Game.js';
import HttpError from '../utils/HttpError.js';

const notFound = (id) => new HttpError(404, `id ${id} 게임을 찾을 수 없습니다.`);

const str = (v) => (typeof v === 'string' ? v : undefined);

export async function list(req, res) {
  const { month, platform, genre, q, sort } = req.query;
  const games = await Game.findAll({
    month: str(month),
    platform: str(platform),
    genre: str(genre),
    q: str(q),
    sort: str(sort),
  });
  res.json(games);
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
