import { Router } from 'express';
import {
  getNextDamageNumber,
  getItemPurchaseCost,
  getDamages,
  getDamageByNumber,
  createDamage,
  updateDamage,
} from '../controllers/damageController.js';

const router = Router();

// Sequence generation for new damage records
router.get('/next-number', getNextDamageNumber);

// Purchase cost lookup preferring latest GRN, strictly not selling price
router.get('/item-cost/:itemCode', getItemPurchaseCost);

// List damages with search, pagination, and dropdown selection
router.get('/', getDamages);

// Get single damage record by damage number or ID
router.get('/:damageNumber', getDamageByNumber);

// Save new damage record
router.post('/', createDamage);

// Update existing damage record
router.put('/:damageNumber', updateDamage);

export default router;
