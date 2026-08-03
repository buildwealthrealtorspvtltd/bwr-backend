import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { Property, IProperty } from '../properties/property.model';
import { Inquiry } from '../inquiries/inquiry.model';
import { logger } from '../../utils/logger';

/* ======================
   GET AGENT DASHBOARD STATS & LISTINGS
====================== */
export const getAgentDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    const agentId = req.user._id;
    const agentObjectId = mongoose.Types.ObjectId.isValid(agentId)
      ? new mongoose.Types.ObjectId(agentId)
      : agentId;

    // 1. Fetch the actual LIST of properties uploaded by OR assigned to this agent
    const properties = await Property.find({
      isDeleted: false,
      $or: [{ uploadedBy: agentObjectId }, { assignedAgent: agentObjectId }],
    })
      .populate('uploadedBy', 'name email role')
      .populate('assignedAgent', 'name email role')
      .sort({ createdAt: -1 })
      .lean();

    // 2. Calculate Stats based on the list
    const totalProperties = properties.length;
    const liveProperties = properties.filter(
      (p: unknown) => (p as IProperty).status === 'APPROVED',
    ).length;
    const pendingProperties = properties.filter(
      (p: unknown) => (p as IProperty).status === 'PENDING',
    ).length;
    const totalViews = properties.reduce(
      (acc, curr: unknown) => acc + ((curr as IProperty).views || 0),
      0,
    );

    // 3. Fetch Total Inquiries assigned to this agent
    const totalInquiries = await Inquiry.countDocuments({
      agent: agentObjectId,
    });

    // 4. Send Response strictly matching Frontend Interfaces
    return res.json({
      stats: {
        totalProperties,
        liveProperties,
        pendingProperties,
        totalViews,
        totalInquiries,
      },
      properties,
    });
  } catch (error: unknown) {
    logger.error('Agent Dashboard Stats Error', { error: String(error) });
    return res.status(500).json({ message: 'Failed to load dashboard' });
  }
};
