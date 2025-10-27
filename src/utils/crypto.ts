import crypto from 'node:crypto';

export const generateRandomBase64 = (bytes = 32) => {
  return crypto.randomBytes(bytes).toString('base64');
};
