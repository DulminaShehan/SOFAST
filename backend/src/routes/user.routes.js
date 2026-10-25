import { Router } from 'express';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  loginUser,
  getPermissionsList,
} from '../controllers/userController.js';

const router = Router();

// Authentication
router.post('/login', loginUser);

// Permissions metadata
router.get('/permissions-list', getPermissionsList);

// User CRUD
router.get('/', getUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
