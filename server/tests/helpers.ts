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
const DEB_COLS = 'id, employee_id, amount, service, date, paid, paid_date, notes, transaction_id';
const TIP_COLS = 'id, timestamp, employee_id, amount, method, week_id, notes';
const CDEBT_COLS = 'id, client_name, customer_phone, description, amount, paid, date, paid_date, notes, created_at';
const WLOG_COLS =
  'id, week_id, start_date, end_date, total_revenue, total_expenses, total_labor_expense, total_profit, data_json';
const CAR_COLS =
  'id, created_at, receiver_id, submitter_id, characteristics, client_name, customer_phone, image_data, expected_price, cash_paid, mpesa_paid, is_washed, status, released_at';
const ARR_COLS =
  'id, created_at, plate_number, category, expected_price, submitter_id, washer_id, cash_paid, mpesa_paid, status, debt_id, transaction_id, settled_at';

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
    tips: await snapshotTable('tips', 'id', TIP_COLS),
    client_debts: await snapshotTable('client_debts', 'id', CDEBT_COLS),
    weekly_logs: await snapshotTable('weekly_logs', 'id', WLOG_COLS),
    carpets: await snapshotTable('carpets', 'id', CAR_COLS),
    vehicle_arrivals: await snapshotTable('vehicle_arrivals', 'id', ARR_COLS),
  };
}

export async function restoreDb(snap: ReturnType<typeof snapshotDb> extends Promise<infer T> ? T : never) {
  const { pool } = await import('../src/db');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const t of ['tips', 'repayments', 'debts', 'client_debts', 'weekly_logs', 'expenses', 'transactions', 'carpets', 'vehicle_arrivals', 'users']) {
      await client.query(`DELETE FROM ${t}`);
    }
    const order = ['users', 'vehicle_arrivals', 'transactions', 'expenses', 'repayments', 'debts', 'tips', 'client_debts', 'weekly_logs', 'carpets'];
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

export async function clearSettlement(weekId: string) {
  const { pool } = await import('../src/db');
  await pool.query('DELETE FROM weekly_logs WHERE week_id = $1', [weekId]);
}

// The suite wipes and re-seeds the configured database, so it must only run
// when explicitly requested (see the `test:db` script).
export function assertDestructiveRunAllowed() {
  if (process.env.ALLOW_DB_WIPE !== '1') {
    throw new Error(
      'Refusing to run: these tests wipe and re-seed the database. Run "npm run test:db" (or set ALLOW_DB_WIPE=1) to confirm.',
    );
  }
}

const SNAPSHOT_FILE = '/tmp/opencode/extremcw-test-snapshot.json';

// Safety net: keep a copy of the live data on disk before the suite wipes it,
// so the data can be recovered even if the in-memory restore fails.
export async function saveSnapshotFile(snap: any) {
  const fs = await import('fs/promises');
  await fs.writeFile(SNAPSHOT_FILE, JSON.stringify(snap, null, 1));
}

export async function restoreFromFile(): Promise<number> {
  const fs = await import('fs/promises');
  const raw = await fs.readFile(SNAPSHOT_FILE, 'utf8');
  const snap = JSON.parse(raw);
  await restoreDb(snap);
  let n = 0;
  for (const t of Object.keys(snap)) n += snap[t].rows.length;
  return n;
}

// Build the deterministic demo state the suite expects (the migration-seed
// users with known logins), regardless of what is currently in the DB. The
// suite calls this AFTER snapshotting, and afterAll restores the snapshot.
export async function seedDemoUsers() {
  const { pool } = await import('../src/db');
  const { getPasswordHash } = await import('../src/auth');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const t of ['tips', 'repayments', 'debts', 'client_debts', 'weekly_logs', 'expenses', 'transactions', 'carpets', 'vehicle_arrivals', 'users']) {
      await client.query(`DELETE FROM ${t}`);
    }
    const users = [
      [1, 'Business Manager', 'manager', getPasswordHash('manager'), 'MANAGER'],
      [2, 'Administrator', 'admin', getPasswordHash('admin'), 'ADMIN'],
      [3, 'Jeophrey', 'J', getPasswordHash('JJJJ'), 'EMPLOYEE'],
      [4, 'Abel', 'A', getPasswordHash('AAAA'), 'EMPLOYEE'],
      [5, 'Levis', 'L', getPasswordHash('LLLL'), 'EMPLOYEE'],
      [6, 'Derrick', 'D', getPasswordHash('DDDD'), 'EMPLOYEE'],
    ];
    for (const [id, full_name, abbreviation, hashed_password, role] of users) {
      await client.query(
        'INSERT INTO users (id, full_name, abbreviation, hashed_password, role, is_active, payable_balance, debt_balance) VALUES ($1,$2,$3,$4,$5,true,0,0)',
        [id, full_name, abbreviation, hashed_password, role],
      );
    }
    await client.query(`SELECT setval(pg_get_serial_sequence('users', 'id'), 6, true)`);
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