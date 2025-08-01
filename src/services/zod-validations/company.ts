import { z } from 'zod';

import { nameRequiredMessage, requiredFieldMessage } from '../../constants/messages.ts';

export const CreateCompanySchema = z.object({
  name: z.string().min(1, nameRequiredMessage),
  code: z.number().int().positive(),
  manager: z.string().min(1, 'Yönetici isimi gereklidir.'),
  phone: z.string().nullable().optional(),
  licenseDate: z.preprocess(
    (val) => {
      const date = new Date(String(val));
      return isNaN(date.getTime()) ? undefined : date;
    },
    z.date({ message: 'Lisans tarihi geçersiz.' }),
  ),
  status: z.boolean({
    required_error: requiredFieldMessage,
  }),
  webServiceSource: z.string().min(1, 'Web Service kaynağı gereklidir.').url(),
  webServiceUsername: z.string().min(1, 'Web Service kullanıcı adı gereklidir.'),
  serverName: z.string().min(1, 'Sunucu isimi gereklidir.'),
  apiKey: z.string().min(1, 'API Key gereklidir.'),
  apiSecret: z.string().min(1, 'API Şifresi gereklidir.'),
});

export const UpdateCompanySchema = CreateCompanySchema.partial();
