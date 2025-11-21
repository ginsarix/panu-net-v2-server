import z from 'zod';

import {
  emailInvalidMessage,
  phoneInvalidMessage,
  updateAtleast1FieldMessage,
} from '../../constants/messages.js';

export const CreateSubscriptionCustomerSchema = z.object({
  customerCode: z.string().nullish(),
  title: z.string().min(1, 'Ünvan gereklidir.'),
  phone: z
    .string()
    .nullish()
    .refine((val) => val === undefined || val === null || val.length === 0 || val.length >= 1, {
      message: phoneInvalidMessage,
    }),
  email: z.string().email(emailInvalidMessage),
  remindExpiryWithEmail: z.boolean(),
  remindExpiryWithSms: z.boolean(),
  address: z.string().nullish(),
  status: z.boolean(),
  manager: z.string().nullish(),
  subscriptionIds: z.array(z.number().int().positive()).optional(),
});

export const UpdateSubscriptionCustomerSchema = CreateSubscriptionCustomerSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  {
    message: updateAtleast1FieldMessage,
  },
);
