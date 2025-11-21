import { z } from 'zod';

import { updateAtleast1FieldMessage } from '../../constants/messages.js';

const isoDateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid ISO date (YYYY-MM-DD expected)');

export const CreateSubscriptionSchema = z.object({
  startDate: isoDateOnly,
  endDate: isoDateOnly,
  subscriptionType: z.enum(['domain', 'ssl', 'hosting', 'mail']),
  customerIds: z.array(z.number().int().positive()).default([]),
});

export const UpdateSubscriptionSchema = CreateSubscriptionSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  {
    message: updateAtleast1FieldMessage,
  },
);
