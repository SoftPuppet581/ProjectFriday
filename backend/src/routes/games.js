import { Router } from 'express';
import * as controller from '../controllers/gameController.js';
import {
  validateCreateOrReplace,
  validatePatch,
  validateListQuery,
  validateId,
} from '../middleware/validateGame.js';

const router = Router();

router.get('/', validateListQuery, controller.list);
router.post('/', validateCreateOrReplace, controller.create);
router.get('/:id', validateId, controller.get);
router.put('/:id', validateId, validateCreateOrReplace, controller.replace);
router.patch('/:id', validateId, validatePatch, controller.patch);
router.delete('/:id', validateId, controller.remove);

export default router;
