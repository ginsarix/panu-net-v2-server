import crypto from 'node:crypto';

export const generateRandomHex = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');
