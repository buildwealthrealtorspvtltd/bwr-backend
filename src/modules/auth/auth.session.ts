import { User } from '../users/user.model';
import { hashRefreshToken } from './auth.hash';

export const saveRefreshToken = async (userId: string, refreshToken: string) => {
  const hashedToken = await hashRefreshToken(refreshToken);

  await User.findByIdAndUpdate(userId, {
    refreshToken: hashedToken,
  });
};

export const removeRefreshToken = async (userId: string) => {
  await User.findByIdAndUpdate(userId, {
    refreshToken: null,
  });
};
