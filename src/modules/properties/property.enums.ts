export enum PropertyStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SOLD = 'SOLD',
}

export enum PropertyType {
  RESIDENTIAL = 'RESIDENTIAL',
  COMMERCIAL = 'COMMERCIAL',
  LAND = 'LAND',
  WAREHOUSE = 'WAREHOUSE',
  INDUSTRIAL = 'INDUSTRIAL',
  AGRICULTURAL = 'AGRICULTURAL',
}

export enum ListingType {
  SALE = 'SALE',
  RENT = 'RENT',
}

/* ---------- SUB-CATEGORIES ---------- */

export const ResidentialCategories = [
  'FLAT_APARTMENT',
  'INDEPENDENT_HOUSE_VILLA',
  'FARMHOUSE',
  'OTHER',
] as const;

export const CommercialCategories = [
  'OFFICE',
  'SHOWROOM',
  'SHOP',
  'FACTORY',
  'MANUFACTURING',
  'HOTEL',
  'RESORT',
  'OTHER',
] as const;

export const LandCategories = ['RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL', 'AGRICULTURAL'] as const;

export const WarehouseCategories = ['GODOWN', 'COLD_STORAGE', 'GENERAL_WAREHOUSE'] as const;
