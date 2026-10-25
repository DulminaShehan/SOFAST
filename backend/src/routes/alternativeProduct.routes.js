import { Router } from 'express';
import {
  getAlternativeProducts,
  getAlternativeProductByCode,
  saveAlternativeProduct,
  deleteAlternativeProduct,
} from '../controllers/alternativeProductController.js';

const router = Router();

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

/**
 * Alternative Product Master Routes
 */
router.get('/', getAlternativeProducts);
router.get('/:code', getAlternativeProductByCode);
router.post('/', saveAlternativeProduct);
router.put('/:code', saveAlternativeProduct);
router.delete('/:code', deleteAlternativeProduct);

export default router;
