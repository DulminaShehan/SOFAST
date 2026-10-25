import { Router } from 'express';
import {
  getClosingStockReport,
  getReportFilterOptions,
  getMostUsedProducts,
  getDailySalesReport,
  getInvoiceReturnsReport,
  getGrnReport,
  getDailySettlementsReport,
  getSupplierWisePurchasesReport,
  getTopSellingItemsReport,
  getNonMovingReport,
  getGoodsReturnNotes,
} from '../controllers/reportController.js';

const router = Router();

// Ensure all report responses are never cached by browsers, proxies, or intermediate caches,
// guaranteeing that any time database data is inserted, updated, or deleted, fresh data is served.
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
});

/**
 * Report Routes
 * - GET /api/reports/closing-stock
 * - GET /api/reports/daily-sales
 * - GET /api/reports/invoice-returns
 * - GET /api/reports/grn
 * - GET /api/reports/daily-settlements
 * - GET /api/reports/supplier-purchases
 * - GET /api/reports/top-selling
 * - GET /api/reports/non-moving
 * - GET /api/reports/goods-return-notes
 * - GET /api/reports/filter-options
 * - GET /api/reports/most-used-products
 */
router.get('/closing-stock', getClosingStockReport);
router.get('/stock', getClosingStockReport);
router.get('/daily-sales', getDailySalesReport);
router.get('/sales', getDailySalesReport);
router.get('/invoice-returns', getInvoiceReturnsReport);
router.get('/returns', getInvoiceReturnsReport);
router.get('/grn', getGrnReport);
router.get('/goods-received-notes', getGrnReport);
router.get('/daily-settlements', getDailySettlementsReport);
router.get('/settlements', getDailySettlementsReport);
router.get('/supplier-purchases', getSupplierWisePurchasesReport);
router.get('/supplier-wise-purchases', getSupplierWisePurchasesReport);
router.get('/top-selling', getTopSellingItemsReport);
router.get('/top-selling-items', getTopSellingItemsReport);
router.get('/non-moving', getNonMovingReport);
router.get('/non-moving-items', getNonMovingReport);
router.get('/dead-stock', getNonMovingReport);
router.get('/goods-return-notes', getGoodsReturnNotes);
router.get('/gren', getGoodsReturnNotes);
router.get('/goods-returns', getGoodsReturnNotes);
router.get('/filter-options', getReportFilterOptions);
router.get('/most-used-products', getMostUsedProducts);

export default router;


