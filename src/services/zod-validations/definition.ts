import { z } from 'zod';
import { nameRequiredMessage } from '../../constants/messages.js';

export const CreateDefinitionSchema = z.object({
  name: z.string().min(1, nameRequiredMessage),
  socialLinks: z
    .object({
      facebook: z.boolean(),
      facebookLink: z.string(),
      twitter: z.boolean(),
      twitterLink: z.string(),
      linkedin: z.boolean(),
      linkedinLink: z.string(),
      instagram: z.boolean(),
      instagramLink: z.string(),
      youtube: z.boolean(),
      youtubeLink: z.string(),
    })
    .optional(),
  paymentLink: z.string().optional(),
});

export const UpdateDefinitionSchema = CreateDefinitionSchema.partial().extend({
  id: z.number().int().positive(),
});
