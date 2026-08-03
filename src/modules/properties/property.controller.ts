import mongoose from 'mongoose';
import { Response } from 'express';
import { Property, IProperty } from './property.model';
import { PropertyStatus } from './property.enums';
import { Inquiry } from '../inquiries/inquiry.model';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { User, UserRole } from '../users/user.model';
import { z } from 'zod';
import { deleteImageFromCloudinary } from './property.media';
import { logAudit, AuditAction, AuditCategory, AuditTargetType } from '../audit/auditLog.service';
import { env } from '../../config/env';
import apicache from 'apicache';
import { toNum } from '../../utils/parse';
import { logger } from '../../utils/logger';

// Zod schema for validating required fields on property creation
const createPropertySchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(300),
  description: z.string().min(10, 'Description is too short').max(5000),
  listingType: z.enum(['SALE', 'RENT']),
  propertyType: z.enum([
    'RESIDENTIAL',
    'COMMERCIAL',
    'LAND',
    'INDUSTRIAL',
    'AGRICULTURAL',
    'WAREHOUSE',
  ]),
  propertySubType: z.string().min(1),
  price: z.coerce.number().positive('Price must be a positive number'),
  pricePerSqFt: z.coerce.number().min(0).optional(),
  priceUnit: z.string().optional(),
  area: z.coerce.number().positive('Area must be a positive number'),
  city: z.string().min(1, 'City is required'),
  locality: z.string().min(1, 'Locality is required'),
  ownerName: z.string().optional(),
  ownerContact: z.string().optional(),
});

const updatePropertySchema = createPropertySchema.partial();

/* ======================
   1. CREATE PROPERTY (Admin Auto-Approve included)
====================== */
export const createProperty = async (req: AuthRequest, res: Response) => {
  try {
    // Fix 4: Explicit null guard instead of req.user!
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const user = req.user;
    // Fix 3: Validate required fields with Zod before touching the DB
    const validation = createPropertySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: validation.error.flatten().fieldErrors,
      });
    }

    if (user.role === UserRole.USER) {
      if (!req.body.ownerName || req.body.ownerName.trim() === '') {
        return res.status(400).json({
          message: 'Validation failed',
          errors: { ownerName: ['Owner name is required for regular users'] },
        });
      }
      if (!req.body.ownerContact || req.body.ownerContact.trim().length < 10) {
        return res.status(400).json({
          message: 'Validation failed',
          errors: { ownerContact: ['Valid contact number required for regular users'] },
        });
      }
    }

    // --- IMAGE HANDLING ---
    const uploadedImages: { url: string; publicId: string }[] = req.body.images || [];
    if (uploadedImages.length === 0) {
      return res.status(400).json({ message: 'At least one image is required' });
    }

    // Validate images belong to our Cloudinary account and have valid publicIds
    for (const img of uploadedImages) {
      if (
        !img.url ||
        !img.url.startsWith(`https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/`)
      ) {
        return res.status(400).json({ message: 'Invalid image URL' });
      }
      if (!img.publicId || !img.publicId.startsWith('properties/')) {
        return res.status(400).json({ message: 'Invalid image public ID' });
      }
    }

    // --- BROCHURE HANDLING ---
    const brochureUrl = req.body.brochureUrl || undefined;
    if (
      brochureUrl &&
      !brochureUrl.startsWith(`https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/`)
    ) {
      return res.status(400).json({ message: 'Invalid brochure URL' });
    }

    // Handle Amenities (Multer can send string or array)
    let amenities = req.body['amenities[]'] || req.body.amenities || [];
    if (typeof amenities === 'string') amenities = [amenities];

    // --- ADMIN AUTO-APPROVE LOGIC ---
    const initialStatus =
      user.role === UserRole.ADMIN ? PropertyStatus.APPROVED : PropertyStatus.PENDING;

    // --- CONSTRUCT DATA ---
    const propertyData = {
      // 1. Basic Info
      title: req.body.title,
      description: req.body.description,
      listingType: req.body.listingType,
      propertyType: req.body.propertyType,
      propertySubType: req.body.propertySubType,

      // 2. Pricing
      price: toNum(req.body.price) || 0,
      pricePerSqFt: toNum(req.body.pricePerSqFt) ?? (toNum(req.body.price) || 1),
      priceUnit: req.body.priceUnit || (req.body.listingType === 'RENT' ? 'per Month' : 'per SQFT'),
      maintenanceCharges: toNum(req.body.maintenanceCharges),
      securityDeposit: toNum(req.body.securityDeposit),
      ownershipType: req.body.ownershipType || undefined,

      // 3. Owner (Private)
      ownerDetails: {
        name: req.body.ownerName,
        contact: req.body.ownerContact,
      },

      // 4. Location
      location: {
        city: req.body.city,
        locality: req.body.locality,
        sublocality: req.body.sublocality,
        address: req.body.address,
        googleMapLink: req.body.googleMapLink,
      },

      // 4.5 Pricing Checkboxes
      pricingDetails: {
        allInclusive: req.body.allInclusive === true || req.body.allInclusive === 'true',
        taxExcluded: req.body.taxExcluded === true || req.body.taxExcluded === 'true',
        negotiable: req.body.negotiable === true || req.body.negotiable === 'true',
        utilitiesIncluded:
          req.body.utilitiesIncluded === true || req.body.utilitiesIncluded === 'true',
        maintenanceExtra:
          req.body.maintenanceExtra === true || req.body.maintenanceExtra === 'true',
        electricityDgExtra:
          req.body.electricityDgExtra === true || req.body.electricityDgExtra === 'true',
      },

      // 5. Nearby Places
      nearbyPlaces: {
        school: req.body.nearbySchool,
        hospital: req.body.nearbyHospital,
        market: req.body.nearbyMarket,
        railway: req.body.nearbyRailway,
        airport: req.body.nearbyAirport,
        busStop: req.body.nearbyBusStop,
      },

      // 6. Commercial Features
      commercialFeatures: {
        approachRoadWidth: toNum(req.body.approachRoadWidth),
        facingRoadWidth: toNum(req.body.facingRoadWidth),
        nearbyBusinesses: req.body.nearbyBusinesses,
        frontage: toNum(req.body.frontage),
        ceilingHeight: toNum(req.body.ceilingHeight),
        washroomType: req.body.washroomType || undefined,
        securityGuard: req.body.securityGuard === true || req.body.securityGuard === 'true',
        sprinklerSystem: req.body.sprinklerSystem === true || req.body.sprinklerSystem === 'true',
        canteenOrPantry: req.body.canteenOrPantry === true || req.body.canteenOrPantry === 'true',
        officeSpaceAttached:
          req.body.officeSpaceAttached === true || req.body.officeSpaceAttached === 'true',
        staffQuarters: req.body.staffQuarters === true || req.body.staffQuarters === 'true',
        weighbridge: req.body.weighbridge === true || req.body.weighbridge === 'true',
      },

      // 6b. Land / Plot Features
      landFeatures: (() => {
        let townshipAmenities = req.body['townshipAmenities[]'] || req.body.townshipAmenities || [];
        if (typeof townshipAmenities === 'string') townshipAmenities = [townshipAmenities];
        return {
          isInTownship: req.body.isInTownship === true || req.body.isInTownship === 'true',
          waterSource: req.body.waterSource || undefined,
          electricityProvision: req.body.electricityProvision || undefined,
          drainageSystem: req.body.drainageSystem || undefined,
          wasteManagement: req.body.wasteManagement || undefined,
          roadWidthFacing: toNum(req.body.roadWidthFacing),
          roadWidthUnit: req.body.roadWidthUnit || 'FEET',
          isCornerPlot: req.body.isCornerPlot === true || req.body.isCornerPlot === 'true',
          openSides: toNum(req.body.openSides),
          boundaryInfrastructure: req.body.boundaryInfrastructure || undefined,
          maxFloorsAllowed: toNum(req.body.maxFloorsAllowed),
          townshipAmenities,
        };
      })(),

      // 7. Specs
      specs: {
        area: toNum(req.body.area),
        areaUnit: req.body.areaUnit || 'SQFT',
        carpetArea: toNum(req.body.carpetArea),
        superBuildUpArea: toNum(req.body.superBuildUpArea),
        buildUpArea: toNum(req.body.buildUpArea),

        bedrooms: toNum(req.body.bedrooms),
        bathrooms: toNum(req.body.bathrooms),
        balconies: toNum(req.body.balconies),
        floorNumber: toNum(req.body.floorNumber),
        totalFloors: toNum(req.body.totalFloors),
      },

      // 8. Transaction Details
      transaction: {
        type: req.body.transactionType || 'RESALE',
        possessionStatus: req.body.possessionStatus || 'READY',
        possessionDate: req.body.possessionDate ? new Date(req.body.possessionDate) : undefined,
      },

      // 9. Features
      furnishing: req.body.furnishing || 'UNFURNISHED',
      facing: req.body.facing || undefined,
      amenities: amenities,
      parking: {
        open: toNum(req.body.parkingOpen) || 0,
        covered: toNum(req.body.parkingCovered) || 0,
      },

      images: uploadedImages,
      brochureUrl: brochureUrl,

      // 10. System Fields
      uploadedBy: user._id,
      uploadedByRole: user.role,
      status: initialStatus,
      isHot:
        user.role === UserRole.ADMIN ? req.body.isHot === true || req.body.isHot === 'true' : false,

      // If Agent uploads -> Assign to Self
      // If Admin uploads -> Check if specific agent assigned, else undefined
      // If User uploads -> Auto-assign to an Admin
      assignedAgent: await (async () => {
        if (user.role === UserRole.AGENT) return user._id;
        if (user.role === UserRole.ADMIN) {
          return req.body.assignedAgentId &&
            mongoose.Types.ObjectId.isValid(req.body.assignedAgentId)
            ? req.body.assignedAgentId
            : undefined;
        }
        if (user.role === UserRole.USER) {
          const admin = await User.findOne({ role: UserRole.ADMIN });
          return admin ? admin._id : undefined;
        }
        return undefined;
      })(),
    };

    const property = await Property.create(propertyData);

    // Audit: Record property creation
    logAudit({
      action: AuditAction.PROPERTY_CREATE,
      category: AuditCategory.PROPERTY,
      performedBy: user,
      targetType: AuditTargetType.PROPERTY,
      targetId: property._id.toString(),
      targetLabel: property.title,
      newValue: initialStatus,
      req,
      details: user.role === UserRole.ADMIN ? 'Auto-approved (admin)' : 'Pending review',
    });

    apicache.clear(); // Clear global property cache

    return res.status(201).json({ message: 'Property created', property });
  } catch (error: any) {
    console.error('Create Property Failed:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val: any) => val.message);
      return res.status(400).json({ message: 'Validation Error', errors: messages });
    }
    return res.status(500).json({ message: 'Failed to create property' });
  }
};

/* ======================
   2. UPDATE PROPERTY
====================== */
export const updateProperty = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    // Fix 4: Explicit null guard
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const user = req.user;

    const property = await Property.findById(id);
    if (!property) return res.status(404).json({ message: 'Property not found' });

    // Validate update fields with Zod
    const validation = updatePropertySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const propData = property as unknown as IProperty;

    const isOwner = propData.uploadedBy.toString() === user._id.toString();
    const isAssigned = propData.assignedAgent?.toString() === user._id.toString();
    const isAdminUser = user.role === UserRole.ADMIN;

    if (!isAdminUser && !isOwner && !isAssigned) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // --- HANDLE IMAGE DELETION ---
    const rawDeleteIds = req.body.deleteImageIds;
    if (rawDeleteIds) {
      const deleteIds: string[] = Array.isArray(rawDeleteIds) ? rawDeleteIds : [rawDeleteIds];

      if (deleteIds.length > 0) {
        // Validate that the images being deleted actually belong to this property
        const existingPublicIds = property.images.map((img: any) => img.publicId);
        const invalidDeletes = deleteIds.filter((id) => !existingPublicIds.includes(id));
        if (invalidDeletes.length > 0) {
          return res
            .status(400)
            .json({ message: 'Cannot delete images that do not belong to this property' });
        }

        await Promise.all(deleteIds.map((publicId: string) => deleteImageFromCloudinary(publicId)));
      }
    }

    // --- HANDLE NEW IMAGES ---
    if (req.body.images && Array.isArray(req.body.images)) {
      const uploadedImages: { url: string; publicId: string }[] = req.body.images;

      // Validate images belong to our Cloudinary account and have valid publicIds
      for (const img of uploadedImages) {
        if (
          !img.url ||
          !img.url.startsWith(`https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/`)
        ) {
          return res.status(400).json({ message: 'Invalid image URL' });
        }
        if (!img.publicId || !img.publicId.startsWith('properties/')) {
          return res.status(400).json({ message: 'Invalid image public ID' });
        }
      }

      property.images = uploadedImages;
    }

    // --- HANDLE BROCHURE ---
    if (req.body.brochureUrl !== undefined) {
      const brochureUrl = req.body.brochureUrl;
      if (
        brochureUrl &&
        !brochureUrl.startsWith(`https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/`)
      ) {
        return res.status(400).json({ message: 'Invalid brochure URL' });
      }
      property.brochureUrl = brochureUrl;
    }

    // --- HANDLE AMENITIES (Form sends "amenities[]") ---
    let amenities = req.body['amenities[]'] || req.body.amenities;
    if (amenities) {
      if (typeof amenities === 'string') amenities = [amenities];
      property.amenities = amenities;
    }

    // --- HANDLE ASSIGNED AGENT ---
    if (isAdminUser && req.body.assignedAgentId !== undefined) {
      if (req.body.assignedAgentId === '' || req.body.assignedAgentId === 'null') {
        property.assignedAgent = undefined;
      } else if (mongoose.Types.ObjectId.isValid(req.body.assignedAgentId)) {
        property.assignedAgent = new mongoose.Types.ObjectId(req.body.assignedAgentId);
      }
    }

    // --- UPDATE FLAT TOP-LEVEL FIELDS ---
    if (req.body.title) property.title = req.body.title;
    if (req.body.description) property.description = req.body.description;
    if (req.body.listingType) property.listingType = req.body.listingType;
    if (req.body.propertyType) property.propertyType = req.body.propertyType;
    if (req.body.propertySubType) property.propertySubType = req.body.propertySubType;
    if (req.body.price) property.price = toNum(req.body.price) ?? property.price;
    if (req.body.pricePerSqFt !== undefined)
      property.pricePerSqFt = toNum(req.body.pricePerSqFt) ?? property.pricePerSqFt;
    if (req.body.priceUnit !== undefined) property.priceUnit = req.body.priceUnit;
    if (req.body.maintenanceCharges !== undefined)
      property.maintenanceCharges = toNum(req.body.maintenanceCharges);
    if (req.body.securityDeposit !== undefined)
      property.securityDeposit = toNum(req.body.securityDeposit);
    if (req.body.ownershipType) property.ownershipType = req.body.ownershipType;
    if (req.body.furnishing) property.furnishing = req.body.furnishing;
    if (req.body.facing) property.facing = req.body.facing;

    // --- UPDATE NESTED: OWNER DETAILS ---
    if (req.body.ownerName || req.body.ownerContact) {
      property.ownerDetails = {
        name: req.body.ownerName || property.ownerDetails?.name,
        contact: req.body.ownerContact || property.ownerDetails?.contact,
      };
    }

    // --- UPDATE NESTED: LOCATION ---
    if (
      req.body.city ||
      req.body.locality ||
      req.body.sublocality ||
      req.body.address ||
      req.body.googleMapLink
    ) {
      property.location = {
        city: req.body.city || property.location?.city,
        locality: req.body.locality || property.location?.locality,
        sublocality: req.body.sublocality ?? property.location?.sublocality,
        address: req.body.address ?? property.location?.address,
        googleMapLink: req.body.googleMapLink ?? property.location?.googleMapLink,
      };
    }

    // --- UPDATE NESTED: PRICING DETAILS ---
    if (
      req.body.allInclusive !== undefined ||
      req.body.taxExcluded !== undefined ||
      req.body.negotiable !== undefined ||
      req.body.utilitiesIncluded !== undefined ||
      req.body.maintenanceExtra !== undefined ||
      req.body.electricityDgExtra !== undefined
    ) {
      property.pricingDetails = {
        allInclusive: req.body.allInclusive === true || req.body.allInclusive === 'true' || false,
        taxExcluded: req.body.taxExcluded === true || req.body.taxExcluded === 'true' || false,
        negotiable: req.body.negotiable === true || req.body.negotiable === 'true' || false,
        utilitiesIncluded:
          req.body.utilitiesIncluded === true || req.body.utilitiesIncluded === 'true' || false,
        maintenanceExtra:
          req.body.maintenanceExtra === true || req.body.maintenanceExtra === 'true' || false,
        electricityDgExtra:
          req.body.electricityDgExtra === true || req.body.electricityDgExtra === 'true' || false,
      };
    }

    // --- UPDATE NESTED: NEARBY PLACES ---
    property.nearbyPlaces = {
      school: req.body.nearbySchool ?? property.nearbyPlaces?.school,
      hospital: req.body.nearbyHospital ?? property.nearbyPlaces?.hospital,
      market: req.body.nearbyMarket ?? property.nearbyPlaces?.market,
      railway: req.body.nearbyRailway ?? property.nearbyPlaces?.railway,
      airport: req.body.nearbyAirport ?? property.nearbyPlaces?.airport,
      busStop: req.body.nearbyBusStop ?? property.nearbyPlaces?.busStop,
    };

    // --- UPDATE NESTED: COMMERCIAL FEATURES ---
    if (
      req.body.approachRoadWidth !== undefined ||
      req.body.facingRoadWidth !== undefined ||
      req.body.nearbyBusinesses !== undefined ||
      req.body.frontage !== undefined ||
      req.body.ceilingHeight !== undefined ||
      req.body.washroomType !== undefined ||
      req.body.securityGuard !== undefined ||
      req.body.sprinklerSystem !== undefined ||
      req.body.canteenOrPantry !== undefined ||
      req.body.officeSpaceAttached !== undefined ||
      req.body.staffQuarters !== undefined ||
      req.body.weighbridge !== undefined
    ) {
      property.commercialFeatures = {
        ...property.commercialFeatures,
        approachRoadWidth:
          toNum(req.body.approachRoadWidth) ?? property.commercialFeatures?.approachRoadWidth,
        facingRoadWidth:
          toNum(req.body.facingRoadWidth) ?? property.commercialFeatures?.facingRoadWidth,
        nearbyBusinesses:
          req.body.nearbyBusinesses ?? property.commercialFeatures?.nearbyBusinesses,
        frontage: toNum(req.body.frontage) ?? property.commercialFeatures?.frontage,
        ceilingHeight: toNum(req.body.ceilingHeight) ?? property.commercialFeatures?.ceilingHeight,
        washroomType: req.body.washroomType ?? property.commercialFeatures?.washroomType,
        securityGuard:
          req.body.securityGuard !== undefined
            ? req.body.securityGuard === true || req.body.securityGuard === 'true'
            : property.commercialFeatures?.securityGuard,
        sprinklerSystem:
          req.body.sprinklerSystem !== undefined
            ? req.body.sprinklerSystem === true || req.body.sprinklerSystem === 'true'
            : property.commercialFeatures?.sprinklerSystem,
        canteenOrPantry:
          req.body.canteenOrPantry !== undefined
            ? req.body.canteenOrPantry === true || req.body.canteenOrPantry === 'true'
            : property.commercialFeatures?.canteenOrPantry,
        officeSpaceAttached:
          req.body.officeSpaceAttached !== undefined
            ? req.body.officeSpaceAttached === true || req.body.officeSpaceAttached === 'true'
            : property.commercialFeatures?.officeSpaceAttached,
        staffQuarters:
          req.body.staffQuarters !== undefined
            ? req.body.staffQuarters === true || req.body.staffQuarters === 'true'
            : property.commercialFeatures?.staffQuarters,
        weighbridge:
          req.body.weighbridge !== undefined
            ? req.body.weighbridge === true || req.body.weighbridge === 'true'
            : property.commercialFeatures?.weighbridge,
      };
    }

    // --- UPDATE NESTED: LAND FEATURES ---
    if (req.body.waterSource !== undefined || req.body.isInTownship !== undefined) {
      let townshipAmenities = req.body['townshipAmenities[]'] || req.body.townshipAmenities;
      if (townshipAmenities) {
        if (typeof townshipAmenities === 'string') townshipAmenities = [townshipAmenities];
      } else {
        townshipAmenities = property.landFeatures?.townshipAmenities || [];
      }
      property.landFeatures = {
        isInTownship: req.body.isInTownship === true || req.body.isInTownship === 'true',
        waterSource: req.body.waterSource ?? property.landFeatures?.waterSource,
        electricityProvision:
          req.body.electricityProvision ?? property.landFeatures?.electricityProvision,
        drainageSystem: req.body.drainageSystem ?? property.landFeatures?.drainageSystem,
        wasteManagement: req.body.wasteManagement ?? property.landFeatures?.wasteManagement,
        roadWidthFacing: toNum(req.body.roadWidthFacing) ?? property.landFeatures?.roadWidthFacing,
        roadWidthUnit: req.body.roadWidthUnit ?? property.landFeatures?.roadWidthUnit ?? 'FEET',
        isCornerPlot: req.body.isCornerPlot === true || req.body.isCornerPlot === 'true',
        openSides: toNum(req.body.openSides) ?? property.landFeatures?.openSides,
        boundaryInfrastructure:
          req.body.boundaryInfrastructure ?? property.landFeatures?.boundaryInfrastructure,
        maxFloorsAllowed:
          toNum(req.body.maxFloorsAllowed) ?? property.landFeatures?.maxFloorsAllowed,
        townshipAmenities,
      };
    }

    // --- UPDATE NESTED: SPECS ---
    property.specs = {
      area: toNum(req.body.area) ?? property.specs?.area,
      areaUnit: req.body.areaUnit || property.specs?.areaUnit || 'SQFT',
      carpetArea: toNum(req.body.carpetArea) ?? property.specs?.carpetArea,
      superBuildUpArea: toNum(req.body.superBuildUpArea) ?? property.specs?.superBuildUpArea,
      buildUpArea: toNum(req.body.buildUpArea) ?? property.specs?.buildUpArea,
      bedrooms: toNum(req.body.bedrooms) ?? property.specs?.bedrooms,
      bathrooms: toNum(req.body.bathrooms) ?? property.specs?.bathrooms,
      balconies: toNum(req.body.balconies) ?? property.specs?.balconies,
      floorNumber: toNum(req.body.floorNumber) ?? property.specs?.floorNumber,
      totalFloors: toNum(req.body.totalFloors) ?? property.specs?.totalFloors,
    };

    // --- UPDATE NESTED: TRANSACTION ---
    property.transaction = {
      type: req.body.transactionType || property.transaction?.type || 'RESALE',
      possessionStatus:
        req.body.possessionStatus || property.transaction?.possessionStatus || 'READY',
      possessionDate:
        req.body.possessionDate && !isNaN(Date.parse(req.body.possessionDate))
          ? new Date(req.body.possessionDate)
          : property.transaction?.possessionDate,
    };

    // --- UPDATE NESTED: PARKING ---
    if (req.body.parkingOpen !== undefined || req.body.parkingCovered !== undefined) {
      property.parking = {
        open: toNum(req.body.parkingOpen) ?? property.parking?.open ?? 0,
        covered: toNum(req.body.parkingCovered) ?? property.parking?.covered ?? 0,
      };
    }

    // Fix 7: Any edit by an agent immediately unpublishes the property (sends it to PENDING)
    // to ensure the Admin can review the new changes before they go live on the public site.
    if (user.role === UserRole.ADMIN) {
      property.status = PropertyStatus.APPROVED;
      if (req.body.isHot !== undefined)
        property.isHot = req.body.isHot === true || req.body.isHot === 'true';
    } else {
      property.status = PropertyStatus.PENDING;
    }

    await property.save();

    // Audit: Record property update
    logAudit({
      action: AuditAction.PROPERTY_UPDATE,
      category: AuditCategory.PROPERTY,
      performedBy: user,
      targetType: AuditTargetType.PROPERTY,
      targetId: id,
      targetLabel: property.title,
      newValue: property.status,
      req,
      details:
        user.role === UserRole.ADMIN
          ? 'Admin edit (auto-approved)'
          : 'Agent edit (reset to PENDING)',
    });

    apicache.clear(); // Clear global property cache

    return res.json({ message: 'Property updated', property });
  } catch (error: any) {
    console.error('Update Error:', error);
    return res.status(500).json({ message: 'Failed to update property' });
  }
};

/* ======================
   3. DELETE PROPERTY
====================== */
export const deleteProperty = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    const user = req.user;

    const property = await Property.findById(id);
    if (!property) return res.status(404).json({ message: 'Property not found' });

    const propData = property as unknown as IProperty;

    const isAdmin = user.role === UserRole.ADMIN;
    const isOwner = propData.uploadedBy
      ? propData.uploadedBy.toString() === user._id.toString()
      : false;

    // Only Admin or the Original Uploader can delete
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Rule: Non-admin agents cannot delete Live properties, must ask Admin
    if (!isAdmin && property.status === PropertyStatus.APPROVED) {
      return res.status(403).json({
        message: 'Agents cannot delete Live properties. Contact Admin.',
      });
    }

    // CLOUDINARY CLEANUP — await to ensure cleanup completes (CRIT-005)
    if (propData.images && Array.isArray(propData.images) && propData.images.length > 0) {
      await Promise.allSettled(
        propData.images.map((img) => {
          if (img && typeof img === 'object' && 'publicId' in img && img.publicId) {
            return deleteImageFromCloudinary(img.publicId as string);
          }
          return Promise.resolve();
        }),
      );
    }

    // SOFT DELETE instead of hard delete (CRIT-006)
    property.isDeleted = true;
    property.status = PropertyStatus.REJECTED;
    if (typeof property.pricePerSqFt !== 'number') {
      property.pricePerSqFt = 0;
    }
    await property.save({ validateBeforeSave: false });

    // Audit: Record property deletion
    try {
      logAudit({
        action: AuditAction.PROPERTY_DELETE,
        category: AuditCategory.PROPERTY,
        performedBy: user,
        targetType: AuditTargetType.PROPERTY,
        targetId: id,
        targetLabel: property.title || 'Untitled Property',
        previousValue: property.status || PropertyStatus.APPROVED,
        newValue: 'DELETED (soft)',
        req,
      });
    } catch (auditErr) {
      logger.warn('Failed to record audit log for property deletion:', { error: String(auditErr) });
    }

    try {
      apicache.clear(); // Clear global property cache
    } catch {
      /* ignore cache clear error */
    }

    return res.json({ success: true, message: 'Property archived successfully' });
  } catch (err: unknown) {
    logger.error('Failed to delete property:', { error: String(err) });
    return res.status(500).json({
      message: err instanceof Error ? err.message : 'Failed to delete property',
    });
  }
};

/* ======================
   4. APPROVE PROPERTY (Admin Only)
====================== */
export const approveProperty = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const property = await Property.findById(id);
    if (!property) return res.status(404).json({ message: 'Property not found' });

    property.status = PropertyStatus.APPROVED;
    await property.save();

    // Audit: Record property approval
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    logAudit({
      action: AuditAction.PROPERTY_APPROVE,
      category: AuditCategory.PROPERTY,
      performedBy: req.user,
      targetType: AuditTargetType.PROPERTY,
      targetId: id,
      targetLabel: property.title,
      previousValue: PropertyStatus.PENDING,
      newValue: PropertyStatus.APPROVED,
      req,
    });

    apicache.clear(); // Clear global property cache

    return res.json({ message: 'Property approved' });
  } catch {
    return res.status(500).json({ message: 'Approval failed' });
  }
};

/* ======================
   5. ASSIGN AGENT (Admin Only)
====================== */
export const assignAgent = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { agentId } = req.body;

    const property = await Property.findById(id);
    if (!property) return res.status(404).json({ message: 'Property not found' });

    if (agentId) {
      // Fix 8: Validate the assigned user actually has AGENT role
      if (!mongoose.Types.ObjectId.isValid(agentId)) {
        return res.status(400).json({ message: 'Invalid agent ID' });
      }
      const agent = await User.findById(agentId).select('role');
      if (!agent || agent.role !== UserRole.AGENT) {
        return res.status(400).json({ message: 'Assigned user must be an Agent' });
      }
      property.set('assignedAgent', agentId);
      await property.save();

      // Audit: Record agent assignment
      if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
      logAudit({
        action: AuditAction.PROPERTY_ASSIGN_AGENT,
        category: AuditCategory.PROPERTY,
        performedBy: req.user,
        targetType: AuditTargetType.PROPERTY,
        targetId: id,
        targetLabel: property.title,
        newValue: `Agent: ${agent.role} (${agentId})`,
        req,
      });

      apicache.clear();
      return res.json({ message: 'Agent assigned' });
    }

    // HIGH-017: Empty agentId — unassign the agent explicitly
    const previousAgent = property.assignedAgent?.toString() || 'none';
    property.set('assignedAgent', undefined);
    await property.save();

    // Audit: Record agent unassignment
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    logAudit({
      action: AuditAction.PROPERTY_UNASSIGN_AGENT,
      category: AuditCategory.PROPERTY,
      performedBy: req.user,
      targetType: AuditTargetType.PROPERTY,
      targetId: id,
      targetLabel: property.title,
      previousValue: `Agent: ${previousAgent}`,
      newValue: 'Unassigned',
      req,
    });

    apicache.clear();
    return res.json({ message: 'Agent unassigned' });
  } catch {
    return res.status(500).json({ message: 'Assignment failed' });
  }
};

/* ======================
   6. TRACK WHATSAPP CLICK
====================== */
export const trackWhatsAppClick = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid property ID' });
    }

    const property = await Property.findById(id).select(
      'title location price assignedAgent uploadedBy',
    );
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    // Optionally record a lead inquiry entry with source: 'WHATSAPP' if user contact details provided,
    // or log analytics metric
    const agentId = property.assignedAgent || property.uploadedBy;

    if (req.body?.name && req.body?.phone) {
      await Inquiry.create({
        property: property._id,
        agent: agentId,
        name: req.body.name,
        email: req.body.email || 'whatsapp@lead.bwr',
        phone: req.body.phone,
        message: req.body.message || `WhatsApp click for ${property.title}`,
        source: 'WHATSAPP',
      });
    }

    return res.json({
      success: true,
      message: 'WhatsApp click tracked',
      data: {
        propertyId: property._id,
        title: property.title,
      },
    });
  } catch {
    return res.status(500).json({ success: false, message: 'Failed to track WhatsApp click' });
  }
};
