import { Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { Property } from '../properties/property.model';
import { Inquiry } from '../inquiries/inquiry.model';
import { PropertyStatus } from '../properties/property.enums';
import { User, UserRole } from '../users/user.model';
import mongoose from 'mongoose';
import { logAudit, AuditAction, AuditCategory, AuditTargetType } from '../audit/auditLog.service';

/* ======================
   ADMIN DASHBOARD STATS
====================== */
export const getAdminDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    /* Parallel Execution: Run all queries at once for speed */
    const [
      totalUsers,
      totalProperties,
      totalInquiries,
      pendingProperties,
      rejectedProperties,
      recentUsers,
      recentInquiries,
      unreadInquiriesCount,
    ] = await Promise.all([
      User.countDocuments(),
      Property.countDocuments({ isDeleted: false }),
      Inquiry.countDocuments(),
      Property.countDocuments({
        status: PropertyStatus.PENDING,
        isDeleted: false,
      }),
      Property.countDocuments({
        $or: [{ status: PropertyStatus.REJECTED }, { isDeleted: true }],
      }),
      User.find().sort({ createdAt: -1 }).limit(5).select('name email role createdAt').lean(),
      Inquiry.find()
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('property', 'title')
        .populate('agent', 'name')
        .lean(),
      Inquiry.countDocuments({ isRead: false }),
    ]);

    return res.json({
      stats: {
        totalUsers,
        totalProperties,
        totalInquiries,
        unreadInquiriesCount,
        pendingProperties,
        rejectedProperties,
      },
      recentUsers,
      recentInquiries,
    });
  } catch (error: any) {
    console.error('Admin Dashboard Error:', error);
    return res.status(500).json({ message: 'Failed to load admin dashboard' });
  }
};

/* ======================
   GET PENDING PROPERTIES
====================== */
export const getPendingProperties = async (req: AuthRequest, res: Response) => {
  try {
    const properties = await Property.find({
      status: PropertyStatus.PENDING,
      isDeleted: false,
    })
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: 1 }) // FIFO: Oldest first
      .lean();

    return res.json(properties);
  } catch (error: any) {
    console.error('Fetch Pending Error:', error);
    return res.status(500).json({ message: 'Failed to fetch pending properties' });
  }
};

/* ======================
   REVIEW PROPERTY
====================== */
export const reviewProperty = async (req: AuthRequest, res: Response) => {
  try {
    const { propertyId, action } = req.body as {
      propertyId: string;
      action: 'APPROVE' | 'REJECT';
    };

    if (!propertyId || !['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ message: 'Invalid request' });
    }

    // HIGH-007: Validate propertyId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(propertyId)) {
      return res.status(400).json({ message: 'Invalid property ID' });
    }

    const property = await Property.findById(propertyId);
    if (!property || property.isDeleted) {
      return res.status(404).json({ message: 'Property not found' });
    }

    // Update Status
    const previousStatus = property.status;
    if (action === 'APPROVE') property.status = PropertyStatus.APPROVED;
    if (action === 'REJECT') property.status = PropertyStatus.REJECTED;

    await property.save();

    // Audit: Record property review action
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    logAudit({
      action: action === 'APPROVE' ? AuditAction.PROPERTY_APPROVE : AuditAction.PROPERTY_REJECT,
      category: AuditCategory.PROPERTY,
      performedBy: req.user,
      targetType: AuditTargetType.PROPERTY,
      targetId: propertyId,
      targetLabel: property.title,
      previousValue: previousStatus,
      newValue: property.status,
      req,
    });

    return res.json({ message: `Property ${action.toLowerCase()}d successfully` });
  } catch (error: any) {
    console.error('Review Error:', error);
    return res.status(500).json({ message: 'Failed to review property' });
  }
};

/* ======================
   PROMOTE USER TO AGENT
====================== */
export const promoteUserToAgent = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.body;

    // HIGH-008: Validate userId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Idempotency Check: Don't promote if already agent
    if (user.role === UserRole.AGENT || user.role === UserRole.ADMIN) {
      return res.json({ message: 'User is already an Agent or Admin' });
    }

    const previousRole = user.role;
    user.role = UserRole.AGENT;
    await user.save();

    // Audit: Record user promotion
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    logAudit({
      action: AuditAction.USER_PROMOTE,
      category: AuditCategory.USER,
      performedBy: req.user,
      targetType: AuditTargetType.USER,
      targetId: userId,
      targetLabel: `${user.name} (${user.email})`,
      previousValue: previousRole,
      newValue: UserRole.AGENT,
      req,
    });

    return res.json({ message: `${user.name} is now an Agent` });
  } catch (_error: any) {
    return res.status(500).json({ message: 'Promotion failed' });
  }
};

/* ======================
   DEMOTE AGENT → USER
====================== */
export const demoteAgentToUser = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.body;

    // HIGH-008: Validate userId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // 1. Validation: Can only demote Agents
    if (user.role !== UserRole.AGENT) {
      return res.status(400).json({ message: 'User is not an Agent' });
    }

    // 2. Change Role
    const previousRole = user.role;
    user.role = UserRole.USER;
    await user.save();

    // 3. CRITICAL: Unassign their properties
    const unassignResult = await Property.updateMany(
      { assignedAgent: userId },
      { $unset: { assignedAgent: 1 } },
    );

    // Audit: Record user demotion (includes property unassignment count)
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    logAudit({
      action: AuditAction.USER_DEMOTE,
      category: AuditCategory.USER,
      performedBy: req.user,
      targetType: AuditTargetType.USER,
      targetId: userId,
      targetLabel: `${user.name} (${user.email})`,
      previousValue: previousRole,
      newValue: UserRole.USER,
      req,
      details: `${unassignResult.modifiedCount} properties unassigned`,
    });

    return res.json({
      message: `${user.name} demoted. Properties are now unassigned.`,
    });
  } catch (error: any) {
    console.error('Demotion Error:', error);
    return res.status(500).json({ message: 'Demotion failed' });
  }
};
