import { Router } from 'express';
import {
  getNextReturnNumber,
  getInvoiceForReturn,
  getItemSupplierTraceability,
  createCustomerDamageReturn,
  getCustomerDamageReturns,
  getCustomerDamageReturnById,
  updateReturnInspectionAndStatus,
} from '../controllers/damageReturnController.js';

const router = Router();

router.get('/next-number', getNextReturnNumber);
router.get('/invoice/:invoiceNumber', getInvoiceForReturn);
router.get('/traceability/:itemCode', getItemSupplierTraceability);
router.get('/', getCustomerDamageReturns);
router.post('/', createCustomerDamageReturn);
router.get('/:id', getCustomerDamageReturnById);
router.patch('/:id/inspection', updateReturnInspectionAndStatus);
router.put('/:id/inspection', updateReturnInspectionAndStatus);

export default router;
