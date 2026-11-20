import { Router } from 'express';
import * as controller from '../controllers/newsController.js';
import { parseNewsQuery } from '../middleware/validateNews.js';

const router = Router();

router.get('/', parseNewsQuery, controller.list);
router.get('/sources', controller.sources);

export default router;
