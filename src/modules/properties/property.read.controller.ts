import { Request, Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { Property } from './property.model';
import { PropertyStatus } from './property.enums';

import { z } from 'zod';
import mongoose from 'mongoose';

/* ──────────────────────────────────
   TYPE DEFINITIONS
────────────────────────────────── */

/** Standardized paginated API response */
interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/* ──────────────────────────────────
   ZOD SCHEMAS
────────────────────────────────── */

const searchQuerySchema = z
  .object({
    q: z.string().optional(),
    propertyType: z.string().optional(), // Comma-separated: "RESIDENTIAL,COMMERCIAL"
    propertySubType: z.string().optional(),
    listingType: z.string().optional(),
    city: z.string().optional(), // Exact match (from dropdown)
    isHot: z.string().optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    sort: z.enum(['price_asc', 'price_desc', 'newest']).default('newest'),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(12),
  })
  .passthrough();

/* ──────────────────────────────────
   HELPER: Build filter object
────────────────────────────────── */

function buildPropertyFilter(params: z.infer<typeof searchQuerySchema>): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    status: PropertyStatus.APPROVED,
    isDeleted: false,
  };

  // Full-text search
  if (params.q) {
    filter.$text = { $search: params.q };
  }

  // Property type — supports comma-separated list for multi-select
  if (params.propertyType) {
    const types = params.propertyType
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (types.length === 1) {
      filter.propertyType = types[0];
    } else if (types.length > 1) {
      filter.propertyType = { $in: types };
    }
  }

  if (params.propertySubType) {
    filter.propertySubType = params.propertySubType;
  }

  // Listing type — exact match
  if (params.listingType) {
    filter.listingType = params.listingType;
  }

  // City — exact match from client dropdown
  if (params.city) {
    filter['location.city'] = params.city;
  }

  // isHot match
  if (params.isHot !== undefined) {
    filter.isHot = params.isHot === 'true';
  }

  // Price range
  if (params.minPrice !== undefined || params.maxPrice !== undefined) {
    const priceFilter: { $gte?: number; $lte?: number } = {};
    if (params.minPrice !== undefined) priceFilter.$gte = params.minPrice;
    if (params.maxPrice !== undefined) priceFilter.$lte = params.maxPrice;
    filter.price = priceFilter;
  }

  return filter;
}

/* ──────────────────────────────────
   HELPER: Build sort object
────────────────────────────────── */

function buildSortOption(
  sort: string,
  hasTextQuery: boolean,
): Record<string, 1 | -1 | { $meta: string }> {
  if (hasTextQuery) {
    return { score: { $meta: 'textScore' }, isHot: -1 };
  }

  switch (sort) {
    case 'price_asc':
      return { isHot: -1, price: 1 };
    case 'price_desc':
      return { isHot: -1, price: -1 };
    case 'newest':
    default:
      return { isHot: -1, createdAt: -1 };
  }
}

/* ======================
   PUBLIC SEARCH (Primary endpoint)
   GET /api/v1/properties/search
   Also serves GET /api/v1/properties/
====================== */
export const searchProperties = async (req: Request, res: Response) => {
  try {
    const parsed = searchQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid search parameters',
        errors: parsed.error.format(),
      });
    }

    const { q, sort, page, limit } = parsed.data;
    const filter = buildPropertyFilter(parsed.data);
    const sortOption = buildSortOption(sort, !!q);
    const skip = (page - 1) * limit;

    // Projection for text-score relevance ranking
    const projection = q ? { score: { $meta: 'textScore' } } : {};

    // Parallel execution: fetch page + count total
    const [data, total] = await Promise.all([
      Property.find(filter, projection)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .select('-__v')
        .lean(),
      Property.countDocuments(filter),
    ]);

    const response: PaginatedResponse<(typeof data)[number]> = {
      success: true,
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };

    return res.json(response);
  } catch (_error: any) {
    return res.status(500).json({ success: false, message: 'Search failed' });
  }
};

// In-memory cache to prevent view counter inflation (1 hour cooldown)
const viewCache = new Map<string, number>();

// Cleanup cache periodically (every hour) to prevent memory leaks
setInterval(
  () => {
    const now = Date.now();
    for (const [key, timestamp] of viewCache.entries()) {
      if (now - timestamp > 60 * 60 * 1000) {
        viewCache.delete(key);
      }
    }
  },
  60 * 60 * 1000,
);

/* ======================
   PROPERTY DETAILS (Public)
   GET /api/v1/properties/:id
====================== */
export const getPropertyById = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid Property ID format' });
    }

    // Anti-inflation logic: check if this IP viewed this property recently
    const viewerIp = req.ip || req.socket.remoteAddress || 'unknown';
    const cacheKey = `${id}_${viewerIp}`;
    const now = Date.now();
    const lastViewed = viewCache.get(cacheKey);

    let shouldIncrement = false;
    if (!lastViewed || now - lastViewed > 60 * 60 * 1000) {
      shouldIncrement = true;
      viewCache.set(cacheKey, now);
    }

    const updateQuery = shouldIncrement ? { $inc: { views: 1 } } : {};

    // Role-aware status filtering:
    // - ADMIN: can view any non-deleted property (PENDING, APPROVED, REJECTED)
    // - Authenticated Agent / Uploader: can view APPROVED or properties assigned to/uploaded by them
    // - Public guest: can only view APPROVED properties
    const authReq = req as AuthRequest;
    const reqUser = authReq.user;

    const findFilter: Record<string, any> = { _id: id, isDeleted: false };

    if (reqUser?.role === 'ADMIN') {
      // Admin has full management access to any property status
    } else if (reqUser) {
      findFilter.$or = [
        { status: PropertyStatus.APPROVED },
        { assignedAgent: reqUser._id },
        { uploadedBy: reqUser._id },
      ];
    } else {
      findFilter.status = PropertyStatus.APPROVED;
    }

    const property = await Property.findOneAndUpdate(findFilter, updateQuery, { new: true })
      .populate('assignedAgent', 'name email role')
      .populate('uploadedBy', 'name email')
      .lean();

    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    // Only strip private owner details for anonymous public visitors
    if (!reqUser && property.ownerDetails) {
      delete (property as unknown as Record<string, unknown>).ownerDetails;
    }

    return res.json(property);
  } catch (_error: any) {
    return res.status(500).json({ message: 'Failed to fetch property' });
  }
};

/* ======================
   AGENT DASHBOARD
   GET /api/v1/properties/agent/my-listings
====================== */
export const getAgentProperties = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const agentId = req.user._id;
    const agentObjectId = mongoose.Types.ObjectId.isValid(agentId)
      ? new mongoose.Types.ObjectId(agentId)
      : agentId;

    const filter: Record<string, unknown> = {
      isDeleted: false,
      $or: [{ uploadedBy: agentObjectId }, { assignedAgent: agentObjectId }],
    };

    // Filter by status if provided (e.g., status=APPROVED or status=PENDING)
    if (req.query.status && typeof req.query.status === 'string') {
      filter.status = req.query.status.toUpperCase();
    }

    const properties = await Property.find(filter)
      .populate('uploadedBy', 'name email role')
      .populate('assignedAgent', 'name email role')
      .sort({ updatedAt: -1 })
      .lean();

    return res.json(properties);
  } catch (_error: any) {
    return res.status(500).json({ message: 'Failed to fetch properties' });
  }
};

/* ======================
   ADMIN — ALL PROPERTIES
   GET /api/v1/properties/admin/all
====================== */
export const getAllPropertiesAdmin = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { isDeleted: false };

    // Search parameter (q)
    if (req.query.q && typeof req.query.q === 'string' && req.query.q.trim() !== '') {
      const escaped = req.query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filter.$or = [
        { title: regex },
        { 'location.city': regex },
        { 'location.locality': regex },
        { 'ownerDetails.name': regex },
        { 'ownerDetails.contact': regex },
        { propertyType: regex },
        { propertySubType: regex },
      ];
    }

    // Property Type filter (checks propertyType, propertySubType, & title keywords for sub-categories like WAREHOUSE, GODOWN, etc.)
    if (req.query.propertyType && typeof req.query.propertyType === 'string') {
      const typeStr = req.query.propertyType.toUpperCase();
      const types = typeStr.split(',').map((t) => t.trim());

      const isWarehouse = types.includes('WAREHOUSE');
      const isLand = types.includes('LAND');

      let categoryCond: { $or: Array<Record<string, unknown>> };

      if (isWarehouse) {
        const whRegex = /warehouse|godown|cold storage|general_warehouse/i;
        categoryCond = {
          $or: [
            { propertyType: 'WAREHOUSE' },
            { propertyType: { $in: types } },
            { propertySubType: { $in: types } },
            { propertySubType: whRegex },
            { title: whRegex },
          ],
        };
      } else if (isLand) {
        const landRegex = /land|plot|agricultural/i;
        categoryCond = {
          $or: [
            { propertyType: { $in: types } },
            { propertySubType: { $in: types } },
            { propertySubType: landRegex },
            { title: landRegex },
          ],
        };
      } else {
        categoryCond = {
          $or: [{ propertyType: { $in: types } }, { propertySubType: { $in: types } }],
        };
      }

      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: categoryCond.$or }];
        delete filter.$or;
      } else {
        filter.$or = categoryCond.$or;
      }
    }

    const [properties, total] = await Promise.all([
      Property.find(filter)
        .populate('uploadedBy', 'name email role')
        .populate('assignedAgent', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Property.countDocuments(filter),
    ]);

    return res.json({
      properties,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (_error: unknown) {
    return res.status(500).json({ message: 'Failed to fetch properties' });
  }
};

/* ======================
   ADMIN — STOCKED (PENDING)
   GET /api/v1/properties/admin/stocked
====================== */
export const getStockedProperties = async (req: AuthRequest, res: Response) => {
  try {
    const properties = await Property.find({
      status: PropertyStatus.PENDING,
      isDeleted: false,
    })
      .populate('uploadedBy', 'name email role')
      .sort({ createdAt: -1 })
      .lean();

    return res.json(properties);
  } catch (_error: any) {
    return res.status(500).json({ message: 'Failed to fetch stocked properties' });
  }
};

/* ======================
   ADMIN — REJECTED PROPERTIES
   GET /api/v1/properties/admin/rejected
====================== */
export const getRejectedProperties = async (req: AuthRequest, res: Response) => {
  try {
    const properties = await Property.find({
      $or: [{ status: PropertyStatus.REJECTED }, { isDeleted: true }],
    })
      .populate('uploadedBy', 'name email role')
      .sort({ updatedAt: -1 })
      .lean();

    return res.json(properties);
  } catch (_error: any) {
    return res.status(500).json({ message: 'Failed to fetch rejected properties' });
  }
};

/* ======================
   AUTOSUGGEST
   GET /api/v1/properties/autosuggest
====================== */
export const autosuggestProperties = async (req: Request, res: Response) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.json([]);
    }

    // Escape special regex characters to prevent ReDoS attacks
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');

    const suggestions = await Property.aggregate([
      {
        $match: {
          status: PropertyStatus.APPROVED,
          isDeleted: false,
          $or: [{ 'location.city': regex }, { 'location.locality': regex }, { title: regex }],
        },
      },
      { $limit: 20 },
      {
        $project: {
          _id: 1,
          title: 1,
          location: 1,
          propertyType: 1,
          matchScore: {
            $switch: {
              branches: [
                { case: { $regexMatch: { input: '$location.city', regex: regex } }, then: 3 },
                { case: { $regexMatch: { input: '$location.locality', regex: regex } }, then: 2 },
                { case: { $regexMatch: { input: '$title', regex: regex } }, then: 1 },
              ],
              default: 0,
            },
          },
        },
      },
      { $sort: { matchScore: -1, title: 1 } },
      { $limit: 10 },
    ]);

    const formattedSuggestions = suggestions.map((item) => {
      if (item.matchScore === 3 && item.location.city.match(regex)) {
        return {
          id: `city_${item.location.city}`,
          label: item.location.city,
          type: 'CITY',
          query: { city: item.location.city },
        };
      }
      if (item.matchScore === 2 && item.location.locality.match(regex)) {
        return {
          id: `loc_${item._id}`,
          label: `${item.location.locality}, ${item.location.city}`,
          type: 'LOCALITY',
          query: { q: item.location.locality },
        };
      }
      return {
        id: `prop_${item._id}`,
        label: item.title,
        type: 'PROPERTY',
        query: { q: item.title },
      };
    });

    const uniqueSuggestions = Array.from(
      new Map(formattedSuggestions.map((item) => [item.label, item])).values(),
    );

    return res.json(uniqueSuggestions);
  } catch (error: any) {
    console.error('Autosuggest error:', error);
    return res.status(500).json([]);
  }
};
