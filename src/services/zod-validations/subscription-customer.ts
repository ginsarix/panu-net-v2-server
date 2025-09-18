import z from 'zod';

import {
  emailInvalidMessage,
  phoneInvalidMessage,
  updateAtleast1FieldMessage,
} from '../../constants/messages';

export const CreateSubscriptionCustomerSchema = z.object({
  customerCode: z.number().int().positive(),
  title: z.string().min(1, 'Ünvan gereklidir.'),
  phone: z
    .string()
    .optional()
    .refine((val) => val === undefined || val.length === 0 || val.length >= 1, {
      message: phoneInvalidMessage,
    }),
  email: z.string().email(emailInvalidMessage),
  remindExpiryWithEmail: z.boolean(),
  remindExpiryWithSms: z.boolean(),
  address: z.string().min(1, 'Adres gereklidir.'),
  status: z.boolean(),
  manager: z.string().min(1, 'Yetkili ismi gereklidir.'),
});

export const UpdateSubscriptionCustomerSchema = CreateSubscriptionCustomerSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  {
    message: updateAtleast1FieldMessage,
  },
);
