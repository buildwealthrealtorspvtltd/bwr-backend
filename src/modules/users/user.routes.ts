import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { isAdmin } from '../../middlewares/role.middleware';
import { getAllUsers, updateUserRole, deleteUser } from './user.controller';

const router = Router();

/* ======================
   ADMIN ROUTES
====================== */
// GET all users for the dashboard table
router.get('/', authenticate, isAdmin, getAllUsers);

// PATCH role (Promote/Demote)
router.patch('/:id/role', authenticate, isAdmin, updateUserRole);

// DELETE user
router.delete('/:id', authenticate, isAdmin, deleteUser);

export default router;
