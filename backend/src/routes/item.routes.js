import { Router } from 'express';
import {
  getItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  getLookupOptions,
} from '../controllers/itemController.js';

const router = Router();

/**
 * Item Master Routes
 */
router.get('/lookup-options', getLookupOptions);
router.get('/', getItems);
router.get('/:id', getItemById);
router.post('/', createItem);
router.put('/:id', updateItem);
router.delete('/:id', deleteItem);

export default router;
