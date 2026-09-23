import { AddressInfo } from 'net';
import { createApp } from '../src/app';

export interface Resp {
  status: number;
  json: any;
}

export class Api {
  base: string;
  token?: string;

  constructor(base: string) {
    this.base = base;
  }

  auth(token: string): Api {
    this.token = token;
    return this;
  }

  async req(method: string, path: string, body?: any, form = false): Promise<Resp> {
    const headers: Record<string, string> = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    let payload: string | undefined;
    if (body !== undefined) {
      if (form) {
        payload = new URLSearchParams(body).toString();
        headers['content-type'] = 'application/x-www-form-urlencoded';
      } else {
        payload = JSON.stringify(body);
        headers['content-type'] = 'application/json';
      }
    }
    const res = await fetch(this.base + path, { method, headers, body: payload });
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      // no body
    }
    return { status: res.status, json };
  }

  get(path: string) {
    return this.req('GET', path);
  }
  post(path: string, body?: any, form = false) {
    return this.req('POST', path, body, form);
  }
  put(path: string, body?: any) {
    return this.req('PUT', path, body);
  }
  patch(path: string, body?: any) {
    return this.req('PATCH', path, body);
  }
  delete(path: string) {
    return this.req('DELETE', path);
  }
}

const USER_COLS = 'id, full_name, abbreviation, hashed_password, role, is_active, payable_balance, debt_balance';
const TX_COLS =
  'id, timestamp, washer_id, category, expected_price, cash_paid, mpesa_paid, mpesa_transaction_id, mpesa_sender_name, manual_tip, tip_method, misc_amount, misc_description, has_car_wash, has_vacuum, has_engine_wash, plate_number, customer_phone, custom_category, carpet_characteristics, receiver_id, total_paid, isolated_tip, net_business_remittance, shortfall, calculated_commission, net_wage_before_tip, final_payout, week_id';
const EXP_COLS = 'id, timestamp, description, amount, category, week_id, transaction_id';
const REP_COLS = 'id, timestamp, employee_id, amount, week_id';
const DEB_COLS = 'id, employee_id, amount, service, date, paid, paid_date, notes';
const CAR_COLS =
  'id, created_at, receiver_id, characteristics, client_name, customer_phone, image_data, expected_price, cash_paid, mpesa_paid, is_washed, status, released_at';

interface Snapshot {
  table: string;
  cols: string[];
  rows: any[][];
}

async function snapshotTable(table: string, idCol: string, cols: string): Promise<Snapshot> {
  const { rows } = await import('../src/db').then((m) => m.pool.query(`SELECT ${cols} FROM ${table} ORDER BY ${idCol}`));
  return { table, cols: cols.split(', ').map((c) => c.trim()), rows: rows.map((r: any) => cols.split(', ').map((c: string) => r[c.trim()])) };
}

export async function snapshotDb() {
  return {
    users: await snapshotTable('users', 'id', USER_COLS),
    transactions: await snapshotTable('transactions', 'id', TX_COLS),
    expenses: await snapshotTable('expenses', 'id', EXP_COLS),
    repayments: await snapshotTable('repayments', 'id', REP_COLS),
    debts: await snapshotTable('debts', 'id', DEB_COLS),
    carpets: await snapshotTable('carpets', 'id', CAR_COLS),
  };
}

export async function restoreDb(snap: ReturnType<typeof snapshotDb> extends Promise<infer T> ? T : never) {
  const { pool } = await import('../src/db');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const t of ['repayments', 'debts', 'expenses', 'transactions', 'carpets', 'users']) {
      await client.query(`DELETE FROM ${t}`);
    }
    const order = ['users', 'transactions', 'expenses', 'repayments', 'debts', 'carpets'];
    for (const table of order) {
      const s = (snap as any)[table] as Snapshot;
      if (!s || !s.rows.length) continue;
      const placeholder = s.cols.map((_, i) => `$${i + 1}`).join(', ');
      for (const raw of s.rows) {
        const row = raw.map((v: any) =>
          v instanceof Date ? v.toISOString().replace('T', ' ').replace('Z', '') : v,
        );
        await client.query(`INSERT INTO ${s.table} (${s.cols.join(', ')}) VALUES (${placeholder})`, row);
      }
      // Realign sequences so new SERIAL ids do not collide.
      const max = await client.query(`SELECT COALESCE(MAX(id),0) AS m FROM ${s.table}`);
      const seq = await client.query(
        `SELECT pg_get_serial_sequence('${s.table}', 'id') AS s`,
      );
      if (seq.rows[0]?.s) {
        await client.query(`SELECT setval($1, $2, true)`, [seq.rows[0].s, Number(max.rows[0].m)]);
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function startServer() {
  const app = createApp();
  const server = await new Promise<import('http').Server>((resolve) => {
    const srv = app.listen(0, () => resolve(srv));
  });
  const addr = server.address() as AddressInfo;
  return {
    base: `http://127.0.0.1:${addr.port}/api/v1`,
    close: () =>
      new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

export async function makeApi(): Promise<{ api: Api; close: () => Promise<void> }> {
  const srv = await startServer();
  return { api: new Api(srv.base + ''), close: srv.close };
}