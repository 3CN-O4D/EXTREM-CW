import { Router } from 'express';
import { pool, queryOne } from '../db';
import { HttpError, wrap } from '../utils';
import { asInt, asOptInt, asOptStr, asBool } from '../finance';
import { getPasswordHash, verifyPassword, createAccessToken, getCurrentUser, requireRole, AuthRequest } from '../auth';
import { ROLES } from '../types';
import type { UserRow } from '../types';
import { serializeUser } from '../serialize';

const router = Router();

// POST /auth/token  (OAuth2PasswordRequestForm -> form-urlencoded)
router.post(
  '/token',
  wrap(async (req, res) => {
    const body = req.body || {};
    const username = body.username;
    const password = body.password;
    const user = await queryOne<UserRow>('SELECT * FROM users WHERE abbreviation = $1', [
      username ?? '',
    ]);
    if (!user || !verifyPassword(String(password ?? ''), user.hashed_password)) {
      throw new HttpError(401, 'Incorrect username or password', { 'WWW-Authenticate': 'Bearer' });
    }
    if (!user.is_active) {
      throw new HttpError(403, 'Account is deactivated');
    }
    const token = createAccessToken({
      sub: user.abbreviation,
      role: user.role.toLowerCase(),
    });
    res.json({ access_token: token, token_type: 'bearer' });
  }),
);

// POST /auth/change-password
router.post(
  '/change-password',
  wrap(async (req: AuthRequest, res) => {
    const user = await getCurrentUser(req);
    const body = req.body || {};
    const current = body.current_password;
    const next = body.new_password;
    if (!verifyPassword(String(current ?? ''), user.hashed_password)) {
      throw new HttpError(400, 'Current password is incorrect');
    }
    if (String(next ?? '').length < 4) {
      throw new HttpError(400, 'New password must be at least 4 characters');
    }
    await pool.query('UPDATE users SET hashed_password = $1 WHERE id = $2', [
      getPasswordHash(String(next)),
      user.id,
    ]);
    res.json({ message: 'Password changed successfully' });
  }),
);

// GET /auth/users  (admin)
router.get(
  '/users',
  wrap(async (req: AuthRequest, res) => {
    await requireRole(req, ROLES.slice(0, 1)); // ADMIN
    const rows = (await pool.query('SELECT * FROM users ORDER BY id')).rows as UserRow[];
    res.json(rows.map((u) => serializeUser(u, true)));
  }),
);

// POST /auth/users  (admin)
router.post(
  '/users',
  wrap(async (req: AuthRequest, res) => {
    await requireRole(req, ROLES.slice(0, 1));
    const body = req.body || {};
    const fullName = asOptStr(body.full_name);
    if (fullName === null || fullName === '') throw new HttpError(422, 'full_name is required');
    const abbreviation = asOptStr(body.abbreviation);
    if (abbreviation === null || abbreviation === '') throw new HttpError(422, 'abbreviation is required');
    const password = asOptStr(body.password);
    if (password === null || password === '') throw new HttpError(422, 'password is required');
    const role = asOptStr(body.role) ?? 'employee';
    if (!ROLES.includes(role)) throw new HttpError(422, 'value is not a valid enumeration member for role');

    const existing = await queryOne<UserRow>('SELECT * FROM users WHERE abbreviation = $1', [abbreviation]);
    if (existing) throw new HttpError(400, 'User with this abbreviation already exists');

    const row = (
      await pool.query(
        `INSERT INTO users (full_name, abbreviation, role, hashed_password, is_active, payable_balance, debt_balance)
         VALUES ($1,$2,$3,$4,true,0,0) RETURNING *`,
        [fullName, abbreviation, role.toUpperCase(), getPasswordHash(password)],
      )
    ).rows[0] as UserRow;
    res.status(200).json(serializeUser(row, true));
  }),
);

// PUT /auth/users/:id  (admin)
router.put(
  '/users/:id',
  wrap(async (req: AuthRequest, res) => {
    await requireRole(req, ROLES.slice(0, 1));
    const id = asInt(req.params.id, 'user_id');
    const user = await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
    if (!user) throw new HttpError(404, 'User not found');

    const body = req.body || {};
    const maybeStr = (k: string): string | undefined => {
      if (body[k] === undefined || body[k] === null) return undefined;
      return asOptStr(body[k]) ?? undefined;
    };
    const fullName = maybeStr('full_name');
    const abbreviation = maybeStr('abbreviation');
    const role = maybeStr('role');
    const password = maybeStr('password');
    const isActive = body.is_active !== undefined ? asBool(body.is_active, 'is_active') : undefined;
    if (role !== undefined && !ROLES.includes(role)) {
      throw new HttpError(422, 'value is not a valid enumeration member for role');
    }

    const sets: string[] = [];
    const params: any[] = [];
    if (fullName !== undefined) { params.push(fullName); sets.push(`full_name = $${params.length}`); }
    if (abbreviation !== undefined) { params.push(abbreviation); sets.push(`abbreviation = $${params.length}`); }
    if (role !== undefined) { params.push(role.toUpperCase()); sets.push(`role = $${params.length}`); }
    if (isActive !== undefined) { params.push(isActive); sets.push(`is_active = $${params.length}`); }
    if (password !== undefined) { params.push(getPasswordHash(password)); sets.push(`hashed_password = $${params.length}`); }
    params.push(id);
    if (sets.length) {
      await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
    }
    const updated = await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
    res.json(serializeUser(updated!, true));
  }),
);

// DELETE /auth/users/:id  (admin)
router.delete(
  '/users/:id',
  wrap(async (req: AuthRequest, res) => {
    await requireRole(req, ROLES.slice(0, 1));
    const id = asInt(req.params.id, 'user_id');
    const user = await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
    if (!user) throw new HttpError(404, 'User not found');
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'User deleted' });
  }),
);

export default router;