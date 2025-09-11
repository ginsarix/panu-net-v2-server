import { z } from 'zod';

import {
  emailInvalidMessage,
  nameRequiredMessage,
  passwordAtleast8CharactersMessage,
  phoneInvalidMessage,
  roleInvalidMessage,
  updateAtleast1FieldMessage,
} from '../../constants/messages';

export const CreateUserSchema = z.object({
  name: z.string().min(1, nameRequiredMessage),
  email: z.string().email(emailInvalidMessage),
  password: z.string().min(8, passwordAtleast8CharactersMessage),
  phone: z
    .string()
    .optional()
    .refine((val) => val === undefined || val.length === 0 || val.length >= 1, {
      message: phoneInvalidMessage,
    }),
  role: z
    .string()
    .refine((val) => val === undefined || val.length >= 1, {
      message: roleInvalidMessage,
    })
    .default('user'),
  companies: z.array(z.number().int().positive()),
});

export const UpdateUserSchema = CreateUserSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  {
    message: updateAtleast1FieldMessage,
  },
);
