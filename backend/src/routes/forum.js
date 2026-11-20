import { Router } from 'express';
import * as controller from '../controllers/forumController.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { parseForumQuery, validatePost, validateComment, validateForumIds } from '../middleware/validateForum.js';

// /api/forum : 글 목록/상세는 누구나, 쓰기/좋아요/삭제는 로그인 필요
const router = Router();

router.get('/posts', optionalAuth, parseForumQuery, controller.list);
router.post('/posts', requireAuth, validatePost, controller.create);
router.get('/posts/:postId', optionalAuth, validateForumIds, controller.get);
router.delete('/posts/:postId', requireAuth, validateForumIds, controller.remove);
router.post('/posts/:postId/comments', requireAuth, validateForumIds, validateComment, controller.addComment);
router.delete('/posts/:postId/comments/:commentId', requireAuth, validateForumIds, controller.removeComment);
router.put('/posts/:postId/like', requireAuth, validateForumIds, controller.like);
router.delete('/posts/:postId/like', requireAuth, validateForumIds, controller.unlike);

export default router;
