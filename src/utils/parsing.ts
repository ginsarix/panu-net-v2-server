import type { users } from '../db/schema/user.js';

export const parseIntBase10 = (str: string) => parseInt(str, 10);

export const stripSensitive = (user: typeof users.$inferSelect) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...rest } = user;
  return rest;
};
