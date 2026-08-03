import { Router } from 'express';
import {
  searchProperties,
  getPropertyById,
  getAgentProperties,
  getAllPropertiesAdmin,
  getStockedProperties,
  getRejectedProperties,
  autosuggestProperties,
} from './property.read.controller';
import { authenticate, optionalAuthenticate } from '../../middlewares/auth.middleware';
import { isAdmin, isAgentOrAdmin } from '../../middlewares/role.middleware';
import apicache from 'apicache';

const router = Router();
const cache = apicache.middleware;

/* ⚠️ CRITICAL: Specific routes MUST come before "/:id" */

/* Agent */
router.get('/agent/my-listings', authenticate, isAgentOrAdmin, getAgentProperties);

/* Admin */
router.get('/admin/all', authenticate, isAdmin, getAllPropertiesAdmin);
router.get('/admin/stocked', authenticate, isAdmin, getStockedProperties);
router.get('/admin/rejected', authenticate, isAdmin, getRejectedProperties);

/* Public — Search & Browse (single unified endpoint) */
router.get('/autosuggest', cache('5 minutes'), autosuggestProperties);
router.get('/search', cache('5 minutes'), searchProperties);
router.get('/', cache('5 minutes'), searchProperties); // Delegates to searchProperties with defaults

// This wildcard /:id must be LAST — uses optionalAuthenticate for role-aware property status access
router.get('/:id', optionalAuthenticate, getPropertyById);

export default router;
