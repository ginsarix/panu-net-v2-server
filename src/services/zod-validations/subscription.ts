import z from 'zod/v4';

import { updateAtleast1FieldMessage } from '../../constants/messages.js';

export const CreateSubscriptionSchema = z.object({
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  subscriptionType: z.enum(['domain', 'ssl', 'hosting', 'mail']),
  userId: z.number().int().positive(),
});

export const UpdateSubscriptionSchema = CreateSubscriptionSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  {
    message: updateAtleast1FieldMessage,
  },
);
