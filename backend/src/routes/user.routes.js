import { Router } from 'express';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  loginUser,
  getPermissionsList,
} from '../controllers/userController.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

// Authentication
router.post('/login', loginUser);

// Permissions metadata
router.get('/permissions-list', getPermissionsList);

// User CRUD - Strictly Admin only
router.get('/', requireAdmin, getUsers);
router.post('/', requireAdmin, createUser);
router.put('/:id', requireAdmin, updateUser);
router.delete('/:id', requireAdmin, deleteUser);

export default router;
