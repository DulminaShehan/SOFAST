import { Router } from 'express';
import {
  getGrns,
  getGrnById,
  getNextGrnNumber,
  createGrn,
  updateGrn,
  postGrn,
  reverseGrn,
  deleteGrn,
  getItemGrnHistory,
} from '../controllers/grnController.js';

const router = Router();

// Routes
router.get('/next-number', getNextGrnNumber);
router.get('/item-history/:code', getItemGrnHistory);
router.get('/', getGrns);
router.get('/:id', getGrnById);
router.post('/', createGrn);
router.put('/:id', updateGrn);
router.post('/:id/post', postGrn);
router.post('/:id/cancel', reverseGrn);
router.post('/:id/reverse', reverseGrn);
router.delete('/:id', deleteGrn);

export default router;
