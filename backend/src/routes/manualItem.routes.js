import { Router } from 'express';
import {
  getManualItems,
  getManualItemById,
  getManualItemHistory,
  addManualStock,
  convertManualItem,
  lookupManualItems,
  syncHistoricalManualInvoices,
} from '../controllers/manualItemController.js';

const router = Router();

// Ensure manual stock responses are never cached
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

router.get('/lookup', lookupManualItems);
router.post('/add-stock', addManualStock);
router.post('/convert', convertManualItem);
router.post('/sync-history', syncHistoricalManualInvoices);
router.get('/', getManualItems);
router.get('/:id/history', getManualItemHistory);
router.get('/:id', getManualItemById);

export default router;

