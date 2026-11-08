import { Router } from 'express';
import {
  getManualItems,
  getManualItemById,
  getManualItemHistory,
  addManualStock,
  convertManualItem,
  lookupManualItems,
  syncHistoricalManualInvoices,
  computeNextManualItemCode,
  getIssuedManualInvoices,
} from '../controllers/manualItemController.js';
import { getNextManualInvoiceNumber } from '../controllers/invoiceController.js';

const router = Router();

// Ensure manual stock responses are never cached
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

router.get('/lookup', lookupManualItems);
router.get('/invoices', getIssuedManualInvoices);
router.get('/next-code', async (req, res, next) => {
  try {
    const code = await computeNextManualItemCode();
    res.json({ success: true, nextCode: code, code });
  } catch (e) {
    next(e);
  }
});
router.get('/next-number', async (req, res, next) => {
  try {
    const code = await computeNextManualItemCode();
    res.json({ success: true, nextCode: code, code });
  } catch (e) {
    next(e);
  }
});
router.get('/next-manual-number', getNextManualInvoiceNumber);
router.post('/add-stock', addManualStock);
router.post('/convert', convertManualItem);
router.post('/sync-history', syncHistoricalManualInvoices);
router.get('/', getManualItems);
router.get('/:id/history', getManualItemHistory);
router.get('/:id', getManualItemById);

export default router;

