import { Router } from 'express';
import {
  getItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  getLookupOptions,
  getNextItemCode,
  getNextBarcode,
  previewBulkImport,
  bulkImportItems,
} from '../controllers/itemController.js';

const router = Router();

/**
 * Item Master Routes
 */
router.get('/lookup-options', getLookupOptions);
router.get('/next-code', getNextItemCode);
router.get('/next-barcode', getNextBarcode);
router.post('/bulk-import-preview', previewBulkImport);
router.post('/bulk-import', bulkImportItems);
router.get('/', getItems);
router.get('/:id', getItemById);
router.post('/', createItem);
router.put('/:id', updateItem);
router.delete('/:id', deleteItem);

export default router;
