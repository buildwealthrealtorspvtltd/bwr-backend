import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../../middlewares/auth.middleware';
import { isAdmin } from '../../middlewares/role.middleware';
import { AuditLog } from './auditLog.model';

const router = Router();

/* ======================
   GET AUDIT LOGS (Admin Only)
   Supports: pagination, filtering by action, category, performedBy, date range
====================== */
router.get('/', authenticate, isAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const skip = (page - 1) * limit;

    // Build filter object
    const filter: Record<string, unknown> = {};

    if (req.query.action && typeof req.query.action === 'string') {
      filter.action = req.query.action;
    }

    if (req.query.category && typeof req.query.category === 'string') {
      filter.category = req.query.category;
    }

    if (req.query.performedBy && typeof req.query.performedBy === 'string') {
      filter.performedBy = req.query.performedBy;
    }

    if (req.query.targetId && typeof req.query.targetId === 'string') {
      filter.targetId = req.query.targetId;
    }

    // Date range filter
    if (req.query.from || req.query.to) {
      const dateFilter: Record<string, Date> = {};
      if (req.query.from && typeof req.query.from === 'string') {
        dateFilter.$gte = new Date(req.query.from);
      }
      if (req.query.to && typeof req.query.to === 'string') {
        dateFilter.$lte = new Date(req.query.to);
      }
      if (Object.keys(dateFilter).length > 0) {
        filter.createdAt = dateFilter;
      }
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(filter),
    ]);

    return res.json({
      logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error: any) {
    console.error('Audit Log Query Error:', error);
    return res.status(500).json({ message: 'Failed to fetch audit logs' });
  }
});

export default router;
