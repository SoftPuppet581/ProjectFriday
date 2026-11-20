import { Router } from 'express';
import * as controller from '../controllers/gameController.js';
import {
  validateCreateOrReplace,
  validatePatch,
  parseListQuery,
  requireDateRange,
  validateId,
} from '../middleware/validateGame.js';

const router = Router();

router.get('/', parseListQuery, controller.list);
router.post('/', validateCreateOrReplace, controller.create);
router.get('/:id', validateId, controller.get);
router.put('/:id', validateId, validateCreateOrReplace, controller.replace);
router.patch('/:id', validateId, validatePatch, controller.patch);
router.delete('/:id', validateId, controller.remove);
router.get('/:id/similar', validateId, parseListQuery, controller.similar);
router.get('/:id/calendar.ics', validateId, controller.calendarIcs);

export const calendarRouter = Router();
calendarRouter.get('/', parseListQuery, requireDateRange, controller.calendar);

export const metaRouter = Router();
metaRouter.get('/genres', controller.genres);
metaRouter.get('/platforms', controller.platforms);

export default router;
