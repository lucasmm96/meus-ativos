import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { schema, type DB } from './schema';

const sql = neon(import.meta.env.VITE_DATABASE_URL);

export const db: DB = drizzle(sql, { schema });
