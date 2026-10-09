import { Router } from 'express';
import healthRoutes from './health.routes.js';
import supplierRoutes from './supplier.routes.js';
import itemRoutes from './item.routes.js';
import grnRoutes from './grn.routes.js';

const router = Router();

// Mount API routes
router.use('/health', healthRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/items', itemRoutes);
router.use('/grn', grnRoutes);
router.use('/grns', grnRoutes);

export default router;

