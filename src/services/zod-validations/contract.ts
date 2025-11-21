import { z } from 'zod';

export const ContractCreateSchema = z.object({
  fileName: z.string().min(1, 'Dosya adı gereklidir.'),
  title: z.string().optional(),
  company: z.number().int().positive().nullish(),
});

export const ContractEditSchema = ContractCreateSchema.partial().extend({
  id: z.number().int().positive(),
});
