import { Router } from 'express';
import {
  getDamageItems,
  getCustomerDamageReturnById,
} from '../controllers/damageReturnController.js';

const router = Router();

// GET /api/damage-items - List all damaged items with search, filters, pagination
router.get('/', getDamageItems);
router.get('/items', getDamageItems);
router.get('/:id', getCustomerDamageReturnById);

export default router;
