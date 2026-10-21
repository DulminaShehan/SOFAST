import { Router } from 'express';
import {
  getInvoices,
  getInvoiceById,
  getNextInvoiceNumber,
  getRemainingBalances,
  createInvoice,
  updateInvoice,
  cancelInvoice,
  deleteInvoice,
} from '../controllers/invoiceController.js';

const router = Router();

router.get('/next-number', getNextInvoiceNumber);
router.get('/remaining-balances', getRemainingBalances);
router.get('/', getInvoices);
router.get('/:id', getInvoiceById);
router.post('/', createInvoice);
router.put('/:id', updateInvoice);
router.post('/:id/cancel', cancelInvoice);
router.delete('/:id', deleteInvoice);

export default router;
