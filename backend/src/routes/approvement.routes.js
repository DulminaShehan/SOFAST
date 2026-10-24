import { Router } from 'express';
import {
  getPaymentVouchers,
  createPaymentVoucher,
  updatePaymentVoucherStatus,
  getPettyCash,
  createPettyCash,
  updatePettyCashStatus,
  getLeaveRequests,
  createLeaveRequest,
  updateLeaveRequestStatus,
} from '../controllers/approvementController.js';

const router = Router();

// Payment Vouchers
router.get('/payment-vouchers', getPaymentVouchers);
router.post('/payment-vouchers', createPaymentVoucher);
router.put('/payment-vouchers/:id/status', updatePaymentVoucherStatus);

// Petty Cash
router.get('/petty-cash', getPettyCash);
router.post('/petty-cash', createPettyCash);
router.put('/petty-cash/:id/status', updatePettyCashStatus);

// Leave Requests
router.get('/leave-requests', getLeaveRequests);
router.post('/leave-requests', createLeaveRequest);
router.put('/leave-requests/:id/status', updateLeaveRequestStatus);

export default router;
