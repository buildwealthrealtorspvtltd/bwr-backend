import { Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { User, UserRole } from './user.model';
import { logAudit, AuditAction, AuditCategory, AuditTargetType } from '../audit/auditLog.service';

/* ======================
   GET ALL USERS (Admin Only)
====================== */
export const getAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    // Prevent NoSQL injection by ensuring role is a primitive string and a valid enum value
    const validRoles = ['USER', 'AGENT', 'ADMIN'];
    const filter =
      typeof role === 'string' && validRoles.includes(role.toUpperCase())
        ? { role: role.toUpperCase() }
        : {};

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password -refreshToken')
        .sort({ role: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    return res.json({
      users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch {
    return res.status(500).json({ message: 'Failed to fetch users' });
  }
};

/* ======================
   UPDATE USER ROLE (Admin Only)
====================== */
export const updateUserRole = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { role } = req.body;

    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    if (!['USER', 'AGENT', 'ADMIN'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    // Guard: Prevent admin from changing their own role (self-lockout protection)
    if (id === req.user._id.toString()) {
      return res.status(403).json({ message: 'You cannot change your own role' });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Guard: Prevent demotion of other admins
    if (user.role === UserRole.ADMIN && role !== UserRole.ADMIN) {
      return res.status(403).json({ message: 'Cannot demote another Admin. Contact super-admin.' });
    }

    const previousRole = user.role;
    user.role = role;
    await user.save();

    // Audit: Record role change
    logAudit({
      action: AuditAction.USER_ROLE_CHANGE,
      category: AuditCategory.USER,
      performedBy: req.user,
      targetType: AuditTargetType.USER,
      targetId: id,
      targetLabel: `${user.name} (${user.email})`,
      previousValue: previousRole,
      newValue: role,
      req,
    });

    return res.json({
      message: `Role updated to ${role}`,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch {
    return res.status(500).json({ message: 'Failed to update role' });
  }
};

/* ======================
   DELETE USER (Admin Only)
====================== */
export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    // Guard: Prevent admin from deleting themselves
    if (id === req.user._id.toString()) {
      return res.status(403).json({ message: 'You cannot delete your own account' });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Guard: Prevent deletion of other admins
    if (user.role === UserRole.ADMIN) {
      return res.status(403).json({ message: 'Cannot delete another Admin. Contact super-admin.' });
    }

    await User.findByIdAndDelete(id);

    // Audit: Record user deletion
    logAudit({
      action: AuditAction.USER_DELETED,
      category: AuditCategory.USER,
      performedBy: req.user,
      targetType: AuditTargetType.USER,
      targetId: id,
      targetLabel: `${user.name} (${user.email})`,
      req,
      details: `User with role ${user.role} deleted by Admin`,
    });

    return res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete User Error:', error);
    return res.status(500).json({ message: 'Failed to delete user' });
  }
};
