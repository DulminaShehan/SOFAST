import { Router } from 'express';
import {
  getNextReceiptNumber,
  getBanks,
  getSettlements,
  getSettlementsByInvoice,
  createSettlement,
  deleteSettlement,
} from '../controllers/settlementController.js';

const router = Router();

router.get('/next-receipt', getNextReceiptNumber);
router.get('/banks', getBanks);
router.get('/invoice/:invoiceNumber', getSettlementsByInvoice);
router.get('/', getSettlements);
router.post('/', createSettlement);
router.delete('/:id', deleteSettlement);

export default router;
