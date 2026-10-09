import { Router } from 'express';
import {
  getGrns,
  getGrnById,
  getNextGrnNumber,
  createGrn,
  updateGrn,
  deleteGrn,
} from '../controllers/grnController.js';

const router = Router();

// Routes
router.get('/next-number', getNextGrnNumber);
router.get('/', getGrns);
router.get('/:id', getGrnById);
router.post('/', createGrn);
router.put('/:id', updateGrn);
router.delete('/:id', deleteGrn);

export default router;
