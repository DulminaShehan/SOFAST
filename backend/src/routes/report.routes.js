import { Router } from 'express';
import {
  getClosingStockReport,
  getReportFilterOptions,
  getMostUsedProducts,
} from '../controllers/reportController.js';

const router = Router();

/**
 * Report Routes
 * - GET /api/reports/closing-stock
 * - GET /api/reports/filter-options
 * - GET /api/reports/most-used-products
 */
router.get('/closing-stock', getClosingStockReport);
router.get('/stock', getClosingStockReport);
router.get('/filter-options', getReportFilterOptions);
router.get('/most-used-products', getMostUsedProducts);

export default router;
