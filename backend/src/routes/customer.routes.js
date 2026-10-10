import { Router } from 'express';
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getNextCustomerCode,
} from '../controllers/customerController.js';

const router = Router();

/**
 * Customer Master / Customer Details Routes
 */
router.get('/next-code', getNextCustomerCode);
router.get('/', getCustomers);
router.get('/:id', getCustomerById);
router.post('/', createCustomer);
router.put('/:id', updateCustomer);
router.delete('/:id', deleteCustomer);

export default router;
