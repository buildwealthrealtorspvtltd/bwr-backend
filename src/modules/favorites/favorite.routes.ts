import { Router } from 'express';
import {
  addFavorite,
  removeFavorite,
  getFavoritePropertyIds,
  getFavoriteProperties,
} from './favorite.controller';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();

router.post('/', authenticate, addFavorite);
router.delete('/:propertyId', authenticate, removeFavorite);

router.get('/ids', authenticate, getFavoritePropertyIds);
router.get('/', authenticate, getFavoriteProperties);

export default router;
