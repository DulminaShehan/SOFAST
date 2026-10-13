import { Router } from 'express';
import {
  getDamageStockSummary,
  getDamageStockMovements,
  recordShopDamage,
  writeOffDamagedStock,
} from '../controllers/damageStockController.js';

const router = Router();

router.get('/summary', getDamageStockSummary);
router.get('/movements', getDamageStockMovements);
router.post('/record-damage', recordShopDamage);
router.post('/shop-damage', recordShopDamage);
router.post('/write-off', writeOffDamagedStock);

export default router;
