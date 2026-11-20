import * as Forum from '../models/Forum.js';
import * as User from '../models/User.js';
import HttpError from '../utils/HttpError.js';

const notFound = (id) => new HttpError(404, `id ${id} 글을 찾을 수 없습니다.`);
const requireOwner = (result) => {
  if (result === 'forbidden') throw new HttpError(403, '내가 쓴 글/댓글만 지울 수 있습니다.');
};

export async function list(req, res) {
  const { items, total } = await Forum.findAll({ ...req.forumFilters, viewerId: req.user?.id ?? null });
  res.set('X-Total-Count', String(total)).json(items);
}

export async function get(req, res) {
  const post = await Forum.findById(req.postId, req.user?.id ?? null);
  if (!post) throw notFound(req.postId);
  res.json(post);
}

export async function create(req, res) {
  const { gameId } = req.postInput;
  if (gameId && !(await User.gameExists(gameId))) throw new HttpError(400, '입력값이 올바르지 않습니다.', [{ field: 'gameId', message: '없는 게임입니다.' }]);
  const post = await Forum.create({ userId: req.user.id, ...req.postInput });
  res.status(201).location(`/api/forum/posts/${post.id}`).json(post);
}

export async function remove(req, res) {
  const result = await Forum.removePost(req.postId, req.user.id);
  if (result === 'notfound') throw notFound(req.postId);
  requireOwner(result);
  res.status(204).end();
}

export async function addComment(req, res) {
  if (!(await Forum.postExists(req.postId))) throw notFound(req.postId);
  const comment = await Forum.addComment({ postId: req.postId, userId: req.user.id, ...req.commentInput });
  res.status(201).json(comment);
}

export async function removeComment(req, res) {
  const result = await Forum.removeComment(req.postId, req.commentId, req.user.id);
  if (result === 'notfound') throw new HttpError(404, `id ${req.commentId} 댓글을 찾을 수 없습니다.`);
  requireOwner(result);
  res.status(204).end();
}

export async function like(req, res) {
  if (!(await Forum.postExists(req.postId))) throw notFound(req.postId);
  await Forum.like(req.postId, req.user.id);
  res.status(204).end();
}

export async function unlike(req, res) {
  await Forum.unlike(req.postId, req.user.id);
  res.status(204).end();
}
