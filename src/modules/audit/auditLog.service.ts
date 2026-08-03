import { Request } from 'express';
import { IUser } from '../users/user.model';
import { AuditLog, AuditAction, AuditCategory, AuditTargetType } from './auditLog.model';

/* ======================
   TYPES
====================== */
interface AuditLogEntry {
  action: AuditAction;
  category: AuditCategory;
  performedBy: IUser;
  targetType: AuditTargetType;
  targetId?: string;
  targetLabel?: string;
  previousValue?: string;
  newValue?: string;
  req?: Request;
  details?: string;
}

/* ======================
   REQUEST METADATA EXTRACTOR
====================== */
const extractRequestMetadata = (req?: Request) => {
  if (!req) return {};

  // Extract real client IP (respects trust proxy / X-Forwarded-For)
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    'unknown';

  const userAgent = req.headers['user-agent'] || 'unknown';

  return { ip, userAgent };
};

/* ======================
   FIRE-AND-FORGET AUDIT LOGGER

   Design: This function NEVER throws. If the audit write fails,
   it logs to console.error and moves on. The primary business
   action must never be blocked or crashed by audit logging.
====================== */
export const logAudit = (entry: AuditLogEntry): void => {
  // Extract metadata from request if provided
  const { ip, userAgent } = extractRequestMetadata(entry.req);

  const doc = {
    action: entry.action,
    category: entry.category,
    performedBy: entry.performedBy._id,
    performedByName: entry.performedBy.name,
    performedByRole: entry.performedBy.role,
    targetType: entry.targetType,
    targetId: entry.targetId,
    targetLabel: entry.targetLabel,
    previousValue: entry.previousValue,
    newValue: entry.newValue,
    metadata: {
      ip,
      userAgent,
      details: entry.details,
    },
  };

  // Fire-and-forget: Don't await, don't block the caller
  AuditLog.create(doc).catch((err) => {
    console.error('[AuditLog] Failed to write audit entry:', err.message);
  });
};

/* ======================
   RE-EXPORTS for convenient imports
====================== */
export { AuditAction, AuditCategory, AuditTargetType } from './auditLog.model';
