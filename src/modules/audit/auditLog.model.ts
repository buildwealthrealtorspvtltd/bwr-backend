import mongoose, { Schema, Document } from 'mongoose';

/* ======================
   AUDIT LOG ENUMS
====================== */

export enum AuditAction {
  // Auth
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  PASSWORD_RESET = 'PASSWORD_RESET',

  // Property
  PROPERTY_CREATE = 'PROPERTY_CREATE',
  PROPERTY_UPDATE = 'PROPERTY_UPDATE',
  PROPERTY_DELETE = 'PROPERTY_DELETE',
  PROPERTY_APPROVE = 'PROPERTY_APPROVE',
  PROPERTY_REJECT = 'PROPERTY_REJECT',
  PROPERTY_ASSIGN_AGENT = 'PROPERTY_ASSIGN_AGENT',
  PROPERTY_UNASSIGN_AGENT = 'PROPERTY_UNASSIGN_AGENT',

  // User / Role
  USER_PROMOTE = 'USER_PROMOTE',
  USER_DEMOTE = 'USER_DEMOTE',
  USER_ROLE_CHANGE = 'USER_ROLE_CHANGE',
  USER_DELETED = 'USER_DELETED',

  // Media
  MEDIA_UPLOAD = 'MEDIA_UPLOAD',
  MEDIA_DELETE = 'MEDIA_DELETE',

  // Reel
  REEL_UPLOAD = 'REEL_UPLOAD',
  REEL_DELETE = 'REEL_DELETE',
}

export enum AuditCategory {
  AUTH = 'AUTH',
  PROPERTY = 'PROPERTY',
  USER = 'USER',
  MEDIA = 'MEDIA',
}

export enum AuditTargetType {
  USER = 'User',
  PROPERTY = 'Property',
  IMAGE = 'Image',
  REEL = 'Reel',
}

/* ======================
   AUDIT LOG INTERFACE
====================== */
export interface IAuditLog extends Document {
  action: AuditAction;
  category: AuditCategory;
  performedBy: mongoose.Types.ObjectId;
  performedByName: string;
  performedByRole: string;
  targetType: AuditTargetType;
  targetId?: string;
  targetLabel?: string;
  previousValue?: string;
  newValue?: string;
  metadata?: {
    ip?: string;
    userAgent?: string;
    details?: string;
  };
  createdAt: Date;
}

/* ======================
   AUDIT LOG SCHEMA
====================== */
const auditLogSchema = new Schema<IAuditLog>(
  {
    action: {
      type: String,
      enum: Object.values(AuditAction),
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: Object.values(AuditCategory),
      required: true,
      index: true,
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    performedByName: {
      type: String,
      required: true,
    },
    performedByRole: {
      type: String,
      required: true,
    },
    targetType: {
      type: String,
      enum: Object.values(AuditTargetType),
      required: true,
    },
    targetId: {
      type: String,
    },
    targetLabel: {
      type: String,
    },
    previousValue: {
      type: String,
    },
    newValue: {
      type: String,
    },
    metadata: {
      ip: String,
      userAgent: String,
      details: String,
    },
  },
  { timestamps: true },
);

/* ── Indexes ── */

// Query by date (default sort)
auditLogSchema.index({ createdAt: -1 });

// Query by performer + date
auditLogSchema.index({ performedBy: 1, createdAt: -1 });

// Query by category + action + date (dashboard filters)
auditLogSchema.index({ category: 1, action: 1, createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
