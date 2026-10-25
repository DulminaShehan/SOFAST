import { Router } from 'express';
import healthRoutes from './health.routes.js';
import supplierRoutes from './supplier.routes.js';
import itemRoutes from './item.routes.js';
import grnRoutes from './grn.routes.js';
import customerRoutes from './customer.routes.js';
import invoiceRoutes from './invoice.routes.js';
import alternativeProductRoutes from './alternativeProduct.routes.js';
import settlementRoutes from './settlement.routes.js';
import damageReturnRoutes from './damageReturn.routes.js';
import damageItemRoutes from './damageItem.routes.js';
import supplierClaimRoutes from './supplierClaim.routes.js';
import damageStockRoutes from './damageStock.routes.js';
import damageRoutes from './damage.routes.js';
import goodReturnRoutes from './goodReturn.routes.js';
import userRoutes from './user.routes.js';
import approvementRoutes from './approvement.routes.js';
import reportRoutes from './report.routes.js';

const router = Router();

// Mount API routes
router.use('/health', healthRoutes);
router.use('/users', userRoutes);
router.use('/user', userRoutes);
router.use('/approvement', approvementRoutes);
router.use('/approvements', approvementRoutes);
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
router.use('/damage-returns', damageReturnRoutes);
router.use('/customer-damage-returns', damageReturnRoutes);
router.use('/customer-damage-return', damageReturnRoutes);
router.use('/damage-claims', damageReturnRoutes);
router.use('/damage-claim', damageReturnRoutes);
router.use('/damage-items', damageItemRoutes);


router.use('/supplier-claims', supplierClaimRoutes);
router.use('/supplier-damage-claims', supplierClaimRoutes);
router.use('/supplier-damage-claim', supplierClaimRoutes);
router.use('/damage-stock', damageStockRoutes);
router.use('/damaged-stock', damageStockRoutes);
router.use('/damages', damageRoutes);
router.use('/damage', damageRoutes);

// Good Return Note (GREN) routes
router.use('/good-returns', goodReturnRoutes);
router.use('/good-return-notes', goodReturnRoutes);
router.use('/gren', goodReturnRoutes);
router.use('/supplier-returns', goodReturnRoutes);

// Reports Module routes
router.use('/reports', reportRoutes);
router.use('/report', reportRoutes);

export default router;

