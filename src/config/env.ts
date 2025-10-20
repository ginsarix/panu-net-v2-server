import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)).default('3000'),
  CORS_ORIGIN: z.string().url().optional(),
  REDIS_URI: z.string().url().optional(),

  SESSION_KEY: z.string().base64(),
  DB_HOST: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASS: z.string().min(1),
  DB_NAME: z.string().min(1),
  SMTP_USER: z.string().email(),
  SMTP_PASS: z.string().min(1),
  // for production only
  SSL_KEY: z.string().optional(),
  SSL_CERT: z.string().optional(),
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
