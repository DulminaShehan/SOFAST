import { Router } from 'express';
import {
  getNextClaimNumber,
  getSupplierDamageClaims,
  createSupplierDamageClaim,
  updateClaimStatus,
  receiveClaimReplacement,
  resolveClaimWithoutReplacement,
} from '../controllers/supplierClaimController.js';

const router = Router();

router.get('/next-number', getNextClaimNumber);
router.get('/', getSupplierDamageClaims);
router.post('/', createSupplierDamageClaim);
router.patch('/:id/status', updateClaimStatus);
router.put('/:id/status', updateClaimStatus);
router.post('/:id/receive-replacement', receiveClaimReplacement);
router.post('/:id/resolve', resolveClaimWithoutReplacement);

export default router;
