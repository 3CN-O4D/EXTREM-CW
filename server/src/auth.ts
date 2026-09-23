import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from './config';
import { queryOne } from './db';
import { HttpError } from './utils';
import type { UserRow } from './types';

export interface AuthRequest extends Request {
  user?: UserRow;
}

export function getPasswordHash(password: string): string {
  return bcrypt.hashSync(password, 12);
}

export function verifyPassword(password: string, hashed: string): boolean {
  try {
    return bcrypt.compareSync(password, hashed);
  } catch {
    return false;
  }
}

// exp is integer epoch seconds (python-jose encodes datetime the same way).
export function createAccessToken(data: Record<string, unknown>): string {
  const now = Date.now();
  const exp = Math.floor(now / 1000) + config.accessTokenExpireMinutes * 60;
  return jwt.sign({ ...data, exp }, config.secretKey, { algorithm: config.algorithm });
}

export function decodeToken(token: string): { sub?: string } | null {
  try {
    const payload = jwt.verify(token, config.secretKey, { algorithms: [config.algorithm] });
    return payload as { sub?: string };
  } catch {
    return null;
  }
}

const unauthorized = (detail: string) =>
  new HttpError(401, detail, { 'WWW-Authenticate': 'Bearer' });

export function parseBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

// Mirrors get_current_user in deps.py.
export async function getCurrentUser(req: Request): Promise<UserRow> {
  const token = parseBearer(req);
  if (!token) throw unauthorized('Not authenticated');
  const payload = decodeToken(token);
  if (!payload || !payload.sub) throw unauthorized('Could not validate credentials');
  const user = await queryOne<UserRow>('SELECT * FROM users WHERE abbreviation = $1', [payload.sub]);
  if (!user) throw unauthorized('Could not validate credentials');
  if (!user.is_active) throw new HttpError(403, 'Account is deactivated');
  return user;
}

// Mirrors check_role([...]) in deps.py.
export async function requireRole(req: Request, roles: string[]): Promise<UserRow> {
  const user = await getCurrentUser(req);
  if (!roles.includes(user.role.toLowerCase())) {
    throw new HttpError(403, 'Not enough permissions');
  }
  return user;
}

export async function authOrRole(req: Request, roles?: string[]): Promise<UserRow> {
  if (roles) return requireRole(req, roles);
  return getCurrentUser(req);
}

export function bearerAuth(options: { required?: boolean } = {}) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Middleware no longer needed; auth handled by per-route helpers.
    next();
  };
}