import dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { env } from '../config/env.js';
import { schema } from './schema/schema.js';

dotenv.config();

const pool = new Pool({
  host: env.DB_HOST,
  user: env.DB_USER,
  password: env.DB_PASS,
  database: env.DB_NAME,
  port: 5432,
});

export const db = drizzle(pool, { schema, logger: env.NODE_ENV === 'development' });
