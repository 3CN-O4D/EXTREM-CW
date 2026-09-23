// HTTPError and validation helpers mirroring FastAPI behaviour.

export class HttpError extends Error {
  statusCode: number;
  headers?: Record<string, string>;
  constructor(statusCode: number, detail: string, headers?: Record<string, string>) {
    super(detail);
    this.statusCode = statusCode;
    this.headers = headers;
  }
}

// Python datetime.utcnow().isocalendar() equivalent (ISO week, Monday-start).
export function isocalendar(d: Date): { year: number; week: number; weekday: number } {
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const weekday = (utc.getUTCDay() + 6) % 7; // 0=Mon .. 6=Sun
  const nearestThursday = new Date(utc);
  nearestThursday.setUTCDate(utc.getUTCDate() - weekday + 3);
  const isoYear = nearestThursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstWeekday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstWeekday + 3);
  const week = 1 + Math.round((nearestThursday.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return { year: isoYear, week, weekday };
}

export function getCurrentWeekId(): string {
  const { year, week } = isocalendar(new Date());
  return `${year}-${String(week).padStart(2, '0')}`;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// Strict YYYY-MM-DD validation (rejects 2026-02-30 etc.), mirrors Python
// datetime.strptime and returns a FastAPI-style 400 detail.
export function validateDay(day: unknown): void {
  if (day === null || day === undefined) return;
  const s = String(day);
  if (!DAY_RE.test(s)) {
    throw new HttpError(400, 'Invalid date. Use YYYY-MM-DD format.');
  }
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    throw new HttpError(400, 'Invalid date. Use YYYY-MM-DD format.');
  }
}

export function toNum(v: any, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// Reject negative money in the same places Pydantic's ge=0 did, returning 422.
export function requireNonNegative(fields: Record<string, any>): void {
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    if (Number(v) < 0) {
      throw new HttpError(422, `${k} must be >= 0`);
    }
  }
}

export function weekdayName(dayIso: string): string {
  if (!DAY_RE.test(dayIso)) return '';
  const [y, m, d] = dayIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return '';
  return dt.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
}

// Python's datetime.strptime(day, "%Y-%m-%d").strftime("%A") equivalent.
export function weekdayNameFromDate(d: Date): string {
  const iso = d.toISOString().slice(0, 10);
  const [y, m, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
}

// Format a Date as naive-UTC "YYYY-MM-DD HH:MM:SS.mmm" for TIMESTAMP columns,
// matching Python's datetime.utcnow() storage.
export function toUtcTimestamp(d: Date): string {
  return d.toISOString().replace('T', ' ').replace('Z', '');
}

import { Request, Response, NextFunction } from 'express';

// Async express handler wrapper that forwards rejections to the error middleware.
export function wrap<TReq = Request>(
  fn: (req: TReq, res: Response, next: NextFunction) => any,
) {
  return (req: any, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}