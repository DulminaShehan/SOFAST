import { Router } from 'express';
import healthRoutes from './health.routes.js';
import supplierRoutes from './supplier.routes.js';
import itemRoutes from './item.routes.js';
import grnRoutes from './grn.routes.js';
import customerRoutes from './customer.routes.js';
import invoiceRoutes from './invoice.routes.js';
import alternativeProductRoutes from './alternativeProduct.routes.js';
import settlementRoutes from './settlement.routes.js';

const router = Router();

// Mount API routes
router.use('/health', healthRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/items', itemRoutes);
router.use('/grn', grnRoutes);
router.use('/grns', grnRoutes);
router.use('/customers', customerRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/invoice', invoiceRoutes);
router.use('/alternative-products', alternativeProductRoutes);
router.use('/alternative-product', alternativeProductRoutes);
router.use('/settlements', settlementRoutes);
router.use('/settlement', settlementRoutes);

export default router;

