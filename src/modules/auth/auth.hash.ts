import bcrypt from 'bcrypt';

export const hashRefreshToken = async (token: string) => {
  return bcrypt.hash(token, 10);
};

export const compareRefreshToken = async (token: string, hashedToken: string) => {
  return bcrypt.compare(token, hashedToken);
};
