import { Router } from 'express';
import { pool, queryOne } from '../db';
import { HttpError, wrap } from '../utils';
import { asFloat, asOptFloat, asOptStr, asBool, money } from '../finance';
import { requireRole, getCurrentUser } from '../auth';
import { ROLES, SERVICE_CATEGORIES } from '../types';
import type { AuthRequest } from '../auth';
import type { PriceRow } from '../types';
import { serializePrice } from '../serialize';

const router = Router();
const M = ROLES.slice(0, 2); // ADMIN, MANAGER

const ALLOWED_CATEGORIES = SERVICE_CATEGORIES;

// GET /prices — list all pricing config (admin/manager)
router.get(
  '/',
  wrap(async (req: AuthRequest, res) => {
    await requireRole(req, M);
    const rows = (
      await pool.query('SELECT * FROM prices ORDER BY category')
    ).rows as PriceRow[];
    res.json(rows.map(serializePrice));
  }),
);

// PUT /prices/:category — update min/max/commission/is_active (admin only)
router.put(
  '/:category',
  wrap(async (req: AuthRequest, res) => {
    await requireRole(req, ['admin']); // only admin can edit prices
    const category = req.params.category;
    if (!ALLOWED_CATEGORIES.includes(category)) {
      throw new HttpError(404, 'Unknown category');
    }
    const body = req.body || {};
    const min_price_raw = asOptFloat(body.min_price, 'min_price');
    const max_price_raw = asOptFloat(body.max_price, 'max_price');
    const min_price = min_price_raw === undefined ? undefined : money(min_price_raw);
    const max_price = max_price_raw === undefined ? undefined : money(max_price_raw);
    const commission_percent = asOptFloat(body.commission_percent, 'commission_percent');
    const is_active = asBool(body.is_active, 'is_active');

    if (min_price === undefined || max_price === undefined || commission_percent === undefined) {
      throw new HttpError(422, 'min_price, max_price and commission_percent are required');
    }
    if (min_price < 0 || max_price < 0) throw new HttpError(422, 'prices must be >= 0');
    if (commission_percent < 0 || commission_percent > 100) {
      throw new HttpError(422, 'commission_percent must be between 0 and 100');
    }

    const existing = await queryOne<PriceRow>('SELECT * FROM prices WHERE category = $1', [category]);
    if (!existing) throw new HttpError(404, 'Price config not found');

    const now = new Date().toISOString().replace('T', ' ').replace('Z', '');
    const row = (
      await pool.query(
        `UPDATE prices
          SET min_price = $1, max_price = $2, commission_percent = $3, is_active = $4, updated_at = $5
        WHERE category = $6 RETURNING *`,
        [min_price, max_price, commission_percent, is_active, now, category],
      )
    ).rows[0] as PriceRow;
    res.json(serializePrice(row));
  }),
);

export default router;
