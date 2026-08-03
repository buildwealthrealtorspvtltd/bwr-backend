import { Response } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { Favorite } from './favorite.model';
import { Property } from '../properties/property.model';
import { PropertyStatus } from '../properties/property.enums';
import { z } from 'zod';

/* ======================
   ADD FAVORITE
====================== */
export const addFavorite = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const schema = z.object({ propertyId: z.string().min(1) });
    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid Property ID' });
    }

    const { propertyId } = parsed.data;

    const property = await Property.findOne({
      _id: propertyId,
      status: PropertyStatus.APPROVED,
      isDeleted: false,
    });

    if (!property) {
      return res.status(404).json({ message: 'Property not found' });
    }

    await Favorite.create({
      user: req.user._id,
      property: propertyId,
    });

    return res.status(201).json({ message: 'Added to favorites' });
  } catch (error: unknown) {
    // Duplicate favorite (Code 11000)
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: number }).code === 11000
    ) {
      return res.status(200).json({ message: 'Already favorited' });
    }
    return res.status(500).json({ message: 'Failed to add favorite' });
  }
};

/* ======================
   REMOVE FAVORITE
====================== */
export const removeFavorite = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { propertyId } = req.params;

    await Favorite.findOneAndDelete({
      user: req.user._id,
      property: propertyId,
    });

    return res.json({ message: 'Removed from favorites' });
  } catch {
    return res.status(500).json({ message: 'Failed to remove favorite' });
  }
};

/* ======================
   FAVORITE IDS ONLY (For UI State)
====================== */
export const getFavoritePropertyIds = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const favorites = await Favorite.find({ user: req.user._id }, { property: 1, _id: 0 });

    // Convert ObjectIds to strings for frontend comparison
    const propertyIds = favorites.map((fav) => fav.property.toString());

    return res.json(propertyIds);
  } catch {
    return res.status(500).json({ message: 'Failed to fetch favorites' });
  }
};

/* ======================
   FULL FAVORITE PROPERTIES (For Wishlist Page)
====================== */
export const getFavoriteProperties = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const favorites = await Favorite.find({
      user: req.user._id,
    }).populate({
      path: 'property',
      // Fix 6: Only show APPROVED properties in favorites — reject/pending listings are excluded
      match: { isDeleted: false, status: 'APPROVED' },
      select: 'title price location images propertyType listingType specs status',
    });

    // Filter out nulls (properties that were deleted)
    const properties = favorites.map((fav) => fav.property).filter(Boolean);

    return res.json(properties);
  } catch {
    return res.status(500).json({ message: 'Failed to fetch favorites' });
  }
};
