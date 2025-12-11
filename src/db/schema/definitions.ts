import { jsonb, pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core';

export const definitions = pgTable('definitions', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull().default('Tanım'),
  socialLinks: jsonb('social_links')
    .notNull()
    .default({
      facebook: true,
      facebookLink: 'https://www.facebook.com/panuteknolojii/',
      twitter: true,
      twitterLink: 'https://twitter.com/panuteknoloji',
      linkedin: true,
      linkedinLink: 'https://www.linkedin.com/company/panu-teknoloji-ltd-sti/?originalSubdomain=tr',
      instagram: true,
      instagramLink: 'https://www.instagram.com/panuteknoloji/?hl=tr',
      youtube: true,
      youtubeLink: 'https://www.youtube.com/channel/UCy1M15JA5g_zMuBh_-fu5mw',
    })
    .$type<{
      facebook: boolean;
      facebookLink: string;
      twitter: boolean;
      twitterLink: string;
      linkedin: boolean;
      linkedinLink: string;
      instagram: boolean;
      instagramLink: string;
      youtube: boolean;
      youtubeLink: string;
    }>(),
  paymentLink: varchar('payment_link', { length: 2048 })
    .notNull()
    .default(
      'https://pos.param.com.tr/Tahsilat/Default-v2.aspx?k=95452986-9df4-4d45-8417-fded07a485ef',
    ),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).$onUpdate(() => new Date()),
});
