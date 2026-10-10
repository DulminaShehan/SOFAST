import { Router } from 'express';
import {
  getAlternativeProducts,
  getAlternativeProductByCode,
  saveAlternativeProduct,
  deleteAlternativeProduct,
} from '../controllers/alternativeProductController.js';

const router = Router();

/**
 * Alternative Product Master Routes
 */
router.get('/', getAlternativeProducts);
router.get('/:code', getAlternativeProductByCode);
router.post('/', saveAlternativeProduct);
router.put('/:code', saveAlternativeProduct);
router.delete('/:code', deleteAlternativeProduct);

export default router;
