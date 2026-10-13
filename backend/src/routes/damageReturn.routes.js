import { Router } from 'express';
import {
  getNextReturnNumber,
  getNextDamageClaimNumber,
  getInvoiceForReturn,
  getItemSupplierTraceability,
  createCustomerDamageReturn,
  getCustomerDamageReturns,
  getCustomerDamageReturnById,
  updateCustomerDamageClaim,
  updateReturnInspectionAndStatus,
  updateReturnSupplierClaimAndResolution,
} from '../controllers/damageReturnController.js';

const router = Router();

router.get('/next-number', getNextReturnNumber);
router.get('/next-claim-number', getNextDamageClaimNumber);
router.get('/invoice/:invoiceNumber', getInvoiceForReturn);
router.get('/traceability/:itemCode', getItemSupplierTraceability);
router.get('/', getCustomerDamageReturns);
router.post('/', createCustomerDamageReturn);
router.get('/:id', getCustomerDamageReturnById);
router.put('/:id', updateCustomerDamageClaim);
router.patch('/:id', updateCustomerDamageClaim);
router.patch('/:id/inspection', updateReturnInspectionAndStatus);
router.put('/:id/inspection', updateReturnInspectionAndStatus);
router.patch('/:id/supplier-claim', updateReturnSupplierClaimAndResolution);
router.put('/:id/supplier-claim', updateReturnSupplierClaimAndResolution);

export default router;

