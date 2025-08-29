import { z } from 'zod';

import {
  nameRequiredMessage,
  requiredFieldMessage,
  updateAtleast1FieldMessage,
} from '../../constants/messages.js';
import { dateValidation } from './shared.js';

export const CreateCompanySchema = z.object({
  name: z.string().min(1, nameRequiredMessage),
  code: z.string(),
  manager: z.string().min(1, 'Yönetici isimi gereklidir.'),
  phone: z.string().nullable().optional(),
  licenseDate: dateValidation,
  status: z.boolean({
    required_error: requiredFieldMessage,
  }),
  webServiceSource: z.string().min(1, 'Web Service kaynağı gereklidir.').url(),
  webServiceUsername: z.string().min(1, 'Web Service kullanıcı adı gereklidir.'),
  serverName: z.string().min(1, 'Sunucu isimi gereklidir.'),
  apiKey: z.string(),
  apiSecret: z.string().min(1, 'API Şifresi gereklidir.'),
});

export const UpdateCompanySchema = CreateCompanySchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  {
    message: updateAtleast1FieldMessage,
  },
);
