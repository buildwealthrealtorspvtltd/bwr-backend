import mongoose from 'mongoose';
import { UserRole } from '../users/user.model';
import { PropertyStatus } from './property.enums';

export interface IProperty extends mongoose.Document {
  // 1. Basic Info
  title: string;
  description: string;
  listingType: 'SALE' | 'RENT';
  propertyType: 'RESIDENTIAL' | 'COMMERCIAL' | 'LAND' | 'INDUSTRIAL' | 'AGRICULTURAL' | 'WAREHOUSE';
  propertySubType: string;

  // 2. Owner Details (Private)
  ownerDetails: {
    name: string;
    contact: string;
  };

  // 3. Location & Nearby
  location: {
    city: string;
    locality: string;
    sublocality?: string;
    address?: string;
    pincode?: string;
    googleMapLink?: string;
  };

  nearbyPlaces?: {
    school?: string;
    hospital?: string;
    market?: string;
    railway?: string;
    airport?: string;
    busStop?: string;
  };

  // 4. Commercial Specifics
  commercialFeatures?: {
    approachRoadWidth?: number; // in feet
    facingRoadWidth?: number; // in feet
    nearbyBusinesses?: string; // e.g. "Near TCS Office"
    frontage?: number; // in feet
    ceilingHeight?: number; // in feet
    washroomType?: 'ATTACHED' | 'SHARED' | 'NOT_AVAILABLE';
    securityGuard?: boolean;
    sprinklerSystem?: boolean;
    canteenOrPantry?: boolean;
    officeSpaceAttached?: boolean;
    staffQuarters?: boolean;
    weighbridge?: boolean;
  };

  // 4b. Land / Plot Features
  landFeatures?: {
    isInTownship: boolean;
    waterSource?: string;
    electricityProvision?: string;
    drainageSystem?: string;
    wasteManagement?: string;
    roadWidthFacing?: number;
    roadWidthUnit?: 'FEET' | 'METRES';
    isCornerPlot?: boolean;
    openSides?: number;
    boundaryInfrastructure?: string;
    maxFloorsAllowed?: number;
    townshipAmenities?: string[];
  };

  // 5. Specs (Dynamic)
  specs: {
    bedrooms?: number;
    bathrooms?: number;
    balconies?: number;
    floorNumber?: number;
    totalFloors?: number;
    area: number;
    areaUnit: string;
    carpetArea?: number;
    superBuildUpArea?: number;
    buildUpArea?: number;
  };

  // 6. Pricing & Transaction
  price: number; // Represents "Total Price" for Sale OR "Monthly Rent" for Rent
  pricePerSqFt: number;
  priceUnit?: string;
  maintenanceCharges?: number;
  securityDeposit?: number;

  pricingDetails?: {
    allInclusive: boolean;
    taxExcluded: boolean;
    negotiable: boolean;
    utilitiesIncluded: boolean;
    maintenanceExtra: boolean;
    electricityDgExtra?: boolean;
  };

  transaction?: {
    type?: 'RESALE' | 'NEW_BOOKING';
    possessionStatus?: 'READY' | 'UNDER_CONSTRUCTION';
    possessionDate?: Date;
  };

  ownershipType?: 'FREEHOLD' | 'LEASEHOLD';
  furnishing?: 'UNFURNISHED' | 'SEMI' | 'FULLY';
  facing?:
    | 'NORTH'
    | 'SOUTH'
    | 'EAST'
    | 'WEST'
    | 'NORTH_EAST'
    | 'NORTH_WEST'
    | 'SOUTH_EAST'
    | 'SOUTH_WEST'
    | 'CORNER';
  parking?: { open: number; covered: number };
  amenities: string[];

  images: { url: string; publicId: string }[];
  brochureUrl?: string;

  // 7. System & User Fields
  uploadedBy: mongoose.Types.ObjectId;
  uploadedByRole: UserRole;
  assignedAgent?: mongoose.Types.ObjectId;
  isHot?: boolean;

  status: PropertyStatus;
  isDeleted: boolean;
  views: number;
  createdAt: Date;
  updatedAt: Date;
}

const propertySchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    listingType: { type: String, enum: ['SALE', 'RENT'], default: 'SALE' },
    propertyType: { type: String, required: true },
    propertySubType: { type: String, required: true },

    ownerDetails: {
      name: { type: String, required: true },
      contact: { type: String, required: true },
    },

    location: {
      city: { type: String, required: true },
      locality: { type: String, required: true },
      sublocality: String,
      address: String,
      pincode: String,
      googleMapLink: String,
    },

    nearbyPlaces: {
      school: String,
      hospital: String,
      market: String,
      railway: String,
      airport: String,
      busStop: String,
    },

    commercialFeatures: {
      approachRoadWidth: Number,
      facingRoadWidth: Number,
      nearbyBusinesses: String,
      frontage: Number,
      ceilingHeight: Number,
      washroomType: { type: String, enum: ['ATTACHED', 'SHARED', 'NOT_AVAILABLE'] },
      securityGuard: { type: Boolean, default: false },
      sprinklerSystem: { type: Boolean, default: false },
      canteenOrPantry: { type: Boolean, default: false },
      officeSpaceAttached: { type: Boolean, default: false },
      staffQuarters: { type: Boolean, default: false },
      weighbridge: { type: Boolean, default: false },
    },

    landFeatures: {
      isInTownship: { type: Boolean, default: false },
      waterSource: String,
      electricityProvision: String,
      drainageSystem: String,
      wasteManagement: String,
      roadWidthFacing: Number,
      roadWidthUnit: { type: String, enum: ['FEET', 'METRES'], default: 'FEET' },
      isCornerPlot: { type: Boolean, default: false },
      openSides: Number,
      boundaryInfrastructure: String,
      maxFloorsAllowed: Number,
      townshipAmenities: [String],
    },

    specs: {
      bedrooms: Number,
      bathrooms: Number,
      balconies: Number,
      floorNumber: Number,
      totalFloors: Number,
      area: { type: Number, required: true },
      areaUnit: { type: String, default: 'SQFT' },
      carpetArea: Number,
      superBuildUpArea: Number,
      buildUpArea: Number,
    },

    price: { type: Number, required: true },
    pricePerSqFt: { type: Number, default: 0 },
    priceUnit: { type: String, default: 'per SQFT' },
    maintenanceCharges: Number,
    securityDeposit: { type: Number },

    pricingDetails: {
      allInclusive: { type: Boolean, default: false },
      taxExcluded: { type: Boolean, default: false },
      negotiable: { type: Boolean, default: false },
      utilitiesIncluded: { type: Boolean, default: false },
      maintenanceExtra: { type: Boolean, default: false },
      electricityDgExtra: { type: Boolean, default: false },
    },

    transaction: {
      type: { type: String, default: 'RESALE' },
      possessionStatus: { type: String, default: 'READY' },
      possessionDate: Date,
    },
    ownershipType: { type: String, enum: ['FREEHOLD', 'LEASEHOLD'] },

    furnishing: { type: String, default: 'UNFURNISHED' },
    facing: {
      type: String,
      enum: [
        'NORTH',
        'SOUTH',
        'EAST',
        'WEST',
        'NORTH_EAST',
        'NORTH_WEST',
        'SOUTH_EAST',
        'SOUTH_WEST',
        'CORNER',
      ],
    },
    parking: {
      open: { type: Number, default: 0 },
      covered: { type: Number, default: 0 },
    },

    amenities: [String],
    brochureUrl: String,
    images: [{ url: String, publicId: String }],

    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedByRole: { type: String, default: 'ADMIN' },

    assignedAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    isHot: { type: Boolean, default: false },

    status: { type: String, default: PropertyStatus.PENDING },
    isDeleted: { type: Boolean, default: false },
    views: { type: Number, default: 0 },
  },
  { timestamps: true },
);

/* ── ESR Compound Indexes ── */

// Primary: Equality (status, isDeleted, propertyType) → Sort (createdAt) → Range (price)
propertySchema.index(
  { status: 1, isDeleted: 1, propertyType: 1, createdAt: -1, price: 1 },
  { name: 'idx_search_esr' },
);

// Default browsing sort: Equality (status, isDeleted) → Sort (isHot, createdAt)
propertySchema.index(
  { status: 1, isDeleted: 1, isHot: -1, createdAt: -1 },
  { name: 'idx_browse_default' },
);

// Text search index for $text queries
propertySchema.index(
  { title: 'text', 'location.city': 'text', 'location.locality': 'text' },
  { name: 'idx_text_search' },
);

// Agent dashboard query optimization: Equality (uploadedBy, isDeleted) → Sort (createdAt)
propertySchema.index(
  { uploadedBy: 1, isDeleted: 1, createdAt: -1 },
  { name: 'idx_agent_properties' },
);

// Listing type filtering: Equality (status, isDeleted, listingType) → Sort (createdAt)
propertySchema.index(
  { status: 1, isDeleted: 1, listingType: 1, createdAt: -1 },
  { name: 'idx_listing_type' },
);

export const Property = mongoose.model<IProperty>('Property', propertySchema);
