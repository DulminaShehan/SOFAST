import { Router } from 'express';
import {
  getNextGrenNumber,
  getGrnListForReturn,
  getGrnDetailsForReturn,
  validateGoodReturn,
  createGoodReturn,
  updateGoodReturn,
  deleteGoodReturn,
  getGoodReturns,
  getGoodReturnByNumber,
} from '../controllers/goodReturnController.js';

const router = Router();

// Sequence & metadata routes
router.get('/next-number', getNextGrenNumber);
router.get('/grns', getGrnListForReturn);
router.get('/grn/:grnNumber', getGrnDetailsForReturn);

// Validation
router.post('/validate', validateGoodReturn);

// CRUD routes
router.get('/', getGoodReturns);
router.get('/:grenNumber', getGoodReturnByNumber);
router.post('/', createGoodReturn);
router.put('/:grenNumber', updateGoodReturn);
router.delete('/:grenNumber', deleteGoodReturn);

export default router;
