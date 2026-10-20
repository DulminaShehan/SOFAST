import { Router } from 'express';
import {
  getSuppliers,
  getSupplierById,
  getNextSupplierCode,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../controllers/supplierController.js';

const router = Router();

router.get('/next-code', getNextSupplierCode);

router.route('/')
  .get(getSuppliers)
  .post(createSupplier);

router.route('/:id')
  .get(getSupplierById)
  .put(updateSupplier)
  .delete(deleteSupplier);

export default router;
