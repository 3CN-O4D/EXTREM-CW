import { Pool } from 'pg';
import { config } from './config';

// Node-postgres >=8 treats `sslmode=require` as verify-full and can reject the
// Supabase pooler's self-signed chain. We strip the param and force our own TLS.
const raw = config.databaseUrl;
const isLocal = /localhost|127\.0\.0\.1/.test(raw);
const connectionString = raw.replace(/([?&])sslmode=[A-Za-z_-]*/g, '$1').replace(/[?&]$/, '');

export const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 10,
});

export async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

export async function queryOne<T = any>(text: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows.length ? rows[0] : null;
}