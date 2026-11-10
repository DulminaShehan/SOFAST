import { Router } from 'express';
import {
  getNextReceiptNumber,
  getBanks,
  getSettlements,
  getSettlementsByInvoice,
  createSettlement,
  updateSettlement,
  deleteSettlement,
} from '../controllers/settlementController.js';

const router = Router();

router.get('/next-receipt', getNextReceiptNumber);
router.get('/banks', getBanks);
router.get('/invoice/:invoiceNumber', getSettlementsByInvoice);
router.get('/', getSettlements);
router.post('/', createSettlement);
router.put('/:id', updateSettlement);
router.delete('/:id', deleteSettlement);

export default router;
