import { Router } from 'express';
import {
  getClosingStockReport,
  getReportFilterOptions,
  getMostUsedProducts,
  getDailySalesReport,
  getInvoiceReturnsReport,
  getGrnReport,
} from '../controllers/reportController.js';

const router = Router();

/**
 * Report Routes
 * - GET /api/reports/closing-stock
 * - GET /api/reports/daily-sales
 * - GET /api/reports/invoice-returns
 * - GET /api/reports/grn
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
router.get('/filter-options', getReportFilterOptions);
router.get('/most-used-products', getMostUsedProducts);

export default router;


