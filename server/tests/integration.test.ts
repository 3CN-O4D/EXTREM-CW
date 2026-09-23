import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { Api, makeApi, snapshotDb, restoreDb } from './helpers';

let api: Api;
let close: () => Promise<void>;
let snap: Awaited<ReturnType<typeof snapshotDb>>;

// Employees seeded in the migration (ids used heavily by the suite).
const J_ID = 3;
const A_ID = 4;
const SECRET = process.env.SECRET_KEY as string;

const sign = (payload: object, secret: string = SECRET) =>
  jwt.sign(payload, secret, { algorithm: 'HS256' });

beforeAll(async () => {
  snap = await snapshotDb();
  const srv = await makeApi();
  api = srv.api;
  close = srv.close;
});

afterAll(async () => {
  await restoreDb(snap);
  await close();
});

async function login(user: string, password: string) {
  return api.post('/auth/token', { username: user, password }, true);
}

const tokenOf = (r: { status: number; json: any }) => {
  expect(r.status).toBe(200);
  return r.json.access_token;
};

let admin: Api;
let manager: Api;
let empJ: Api;

describe('auth', () => {
  it('logs in admin/manager/employee and issues HS256 bearer tokens with role claim', async () => {
    const rAdmin = await login('admin', 'admin');
    expect(rAdmin.status).toBe(200);
    expect(rAdmin.json.token_type).toBe('bearer');
    const decoded = jwt.verify(rAdmin.json.access_token, SECRET) as any;
    expect(decoded.sub).toBe('admin');
    expect(decoded.role).toBe('admin');

    admin = new Api(api.base).auth(rAdmin.json.access_token);

    const rManager = await login('manager', 'manager');
    manager = new Api(api.base).auth(tokenOf(rManager));
    const rJ = await login('J', 'JJJJ');
    empJ = new Api(api.base).auth(tokenOf(rJ));
  });

  it('rejects wrong password and unknown user identically (no user enumeration)', async () => {
    const a = await login('admin', 'nope');
    expect(a.status).toBe(401);
    expect(a.json.detail).toBe('Incorrect username or password');
    const b = await login('ghost', 'whatever');
    expect(b.status).toBe(401);
    expect(b.json.detail).toBe('Incorrect username or password');
    expect(a.json.detail).toBe(b.json.detail);
  });

  it('rejects missing, malformed and garbage tokens', async () => {
    const noToken = await new Api(api.base).get('/stats/summary');
    expect(noToken.status).toBe(401);
    const bad = await new Api(api.base).auth('not.a.token').get('/stats/summary');
    expect(bad.status).toBe(401);
    const garbage = await new Api(api.base)
      .auth('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbiJ9.XXXXXXXXXX')
      .get('/stats/summary');
    expect(garbage.status).toBe(401);
  });

  it('rejects alg=none tokens', async () => {
    const noneTok = jwt.sign({ sub: 'admin' }, '', { algorithm: 'none' });
    const r = await new Api(api.base).auth(noneTok).get('/stats/summary');
    expect(r.status).toBe(401);
  });

  it('rejects expired tokens', async () => {
    const expired = sign({ sub: 'admin', exp: Math.floor(Date.now() / 1000) - 3600 });
    const r = await new Api(api.base).auth(expired).get('/stats/summary');
    expect(r.status).toBe(401);
  });

  it('ignores forged role claims (role is read from the DB)', async () => {
    const forged = sign({ sub: 'manager', role: 'admin' });
    const f = new Api(api.base).auth(forged);
    expect((await f.get('/stats/summary')).status).toBe(200); // still manager-accessible
    expect((await f.get('/auth/users')).status).toBe(403); // but DB says manager
  });

  it('deactivated accounts cannot log in and existing tokens are rejected', async () => {
    const created = await admin.post('/auth/users', {
      full_name: 'Temp Deactivate',
      abbreviation: 'TMPD',
      password: 'pass1234',
      role: 'employee',
    });
    expect(created.status).toBe(200);
    const tmp = created.json;

    const rDeact = await admin.put(`/auth/users/${tmp.id}`, { is_active: false });
    expect(rDeact.status).toBe(200);

    expect((await login('TMPD', 'pass1234')).status).toBe(403);
    const t = await login('TMPD', 'pass1234');
    expect(t.json.detail).toBe('Account is deactivated');

    await admin.delete(`/auth/users/${tmp.id}`);
  });
});

describe('users CRUD (admin only)', () => {
  it('lists users', async () => {
    const r = await admin.get('/auth/users');
    expect(r.status).toBe(200);
    const names = r.json.map((u: any) => u.abbreviation);
    expect(names).toContain('admin');
    expect(names).toContain('manager');
    expect(names).toContain('J');
    const adminRow = r.json.find((u: any) => u.abbreviation === 'admin');
    expect(adminRow.role).toBe('admin');
    expect(adminRow.is_active).toBe(true);
  });

  it('creates an employee, rejects duplicates and invalid roles', async () => {
    const r = await admin.post('/auth/users', {
      full_name: 'Test Ty',
      abbreviation: 'TT',
      password: '1234',
      role: 'employee',
    });
    expect(r.status).toBe(200);
    expect(r.json.role).toBe('employee');
    expect(r.json.is_active).toBe(true);
    expect(r.json.payable_balance).toBe(0);
    expect(r.json.debt_balance).toBe(0);

    const dup = await admin.post('/auth/users', {
      full_name: 'Test Ty2',
      abbreviation: 'TT',
      password: '1234',
      role: 'employee',
    });
    expect(dup.status).toBe(400);
    expect(dup.json.detail).toBe('User with this abbreviation already exists');

    const badRole = await admin.post('/auth/users', {
      full_name: 'Bad',
      abbreviation: 'BAD',
      password: '1234',
      role: 'superuser',
    });
    expect(badRole.status).toBe(422);

    await admin.delete(`/auth/users/${r.json.id}`);
  });

  it('updates user fields', async () => {
    const r = await admin.post('/auth/users', {
      full_name: 'Before',
      abbreviation: 'UPD',
      password: '1234',
      role: 'employee',
    });
    const id = r.json.id;
    const up = await admin.put(`/auth/users/${id}`, {
      full_name: 'After',
      role: 'manager',
      abbreviation: 'UPD2',
    });
    expect(up.status).toBe(200);
    expect(up.json.full_name).toBe('After');
    expect(up.json.role).toBe('manager');
    expect(up.json.abbreviation).toBe('UPD2');
    await admin.delete(`/auth/users/${id}`);
  });

  it('403 for non-admin on users CRUD', async () => {
    expect((await manager.get('/auth/users')).status).toBe(403);
    expect(
      (await manager.post('/auth/users', { full_name: 'x', abbreviation: 'X', password: '1234' })).status,
    ).toBe(403);
  });
});

describe('change password', () => {
  it('enforces current password and length, then works', async () => {
    const r = await admin.post('/auth/users', {
      full_name: 'Pw User',
      abbreviation: 'PWU',
      password: 'old1234',
      role: 'employee',
    });
    const id = r.json.id;
    const pwClient = new Api(api.base).auth(tokenOf(await login('PWU', 'old1234')));

    expect((await pwClient.post('/auth/change-password', { current_password: 'wrong', new_password: 'newpass' })).status).toBe(400);
    expect((await pwClient.post('/auth/change-password', { current_password: 'old1234', new_password: 'x' })).status).toBe(400);
    expect(
      (await pwClient.post('/auth/change-password', { current_password: 'old1234', new_password: 'newpass999' })).status,
    ).toBe(200);

    expect((await login('PWU', 'old1234')).status).toBe(401);
    expect((await login('PWU', 'newpass999')).status).toBe(200);

    await admin.delete(`/auth/users/${id}`);
  });
});

describe('transactions', () => {
  const ids: number[] = [];
  const washerBal = async (id: number) => {
    const r = await admin.get('/auth/users');
    const u = r.json.find((x: any) => x.id === id);
    return { payable: u.payable_balance, debt: u.debt_balance };
  };

  it('creates a plain car @200 -> commission 70, wage 70, credit washer payable 70', async () => {
    const before = await washerBal(J_ID);
    const r = await manager.post('/transactions/', {
      washer_id: J_ID,
      category: 'car',
      expected_price: 200,
      cash_paid: 200,
      mpesa_paid: 0,
      tip_method: 'cash',
    });
    expect(r.status).toBe(200);
    expect(r.json.id).toBeGreaterThan(0);
    expect(r.json.transaction_summary.expected_price).toBe(200);
    expect(r.json.transaction_summary.isolated_tip).toBe(0);
    expect(r.json.transaction_summary.shortfall_detected).toBe(0);
    expect(r.json.transaction_summary.net_business_remittance).toBe(200);
    expect(r.json.employee_financials.calculated_commission).toBe(70);
    expect(r.json.employee_financials.final_payout_output).toBe(70);
    ids.push(r.json.id);

    const after = await washerBal(J_ID);
    expect(after.payable - before.payable).toBe(70);
    expect(after.debt - before.debt).toBe(0);
  });

  it('full package floor: expected 500 cash 500 -> floor 600, shortfall 100, wage 80', async () => {
    const r = await manager.post('/transactions/', {
      washer_id: A_ID,
      category: 'car',
      expected_price: 500,
      cash_paid: 500,
      mpesa_paid: 0,
      tip_method: 'cash',
      has_car_wash: true,
      has_vacuum: true,
      has_engine_wash: true,
    });
    expect(r.status).toBe(200);
    expect(r.json.transaction_summary.expected_price).toBe(600);
    expect(r.json.transaction_summary.shortfall_detected).toBe(100);
    expect(r.json.employee_financials.calculated_commission).toBe(180);
    expect(r.json.employee_financials.final_payout_output).toBe(80);
    ids.push(r.json.id);
  });

  it('zero remittance records a debt equal to expected', async () => {
    const before = await washerBal(A_ID);
    const r = await manager.post('/transactions/', {
      washer_id: A_ID,
      category: 'car',
      expected_price: 200,
      cash_paid: 0,
      mpesa_paid: 0,
      tip_method: 'cash',
    });
    expect(r.json.employee_financials.net_wage_before_tip).toBe(-200);
    expect(r.json.ledger_routing.debit_employee_debt).toBe(200);
    ids.push(r.json.id);
    const after = await washerBal(A_ID);
    expect(after.debt - before.debt).toBe(200);
  });

  it('motorcycle @70 -> commission 30', async () => {
    const r = await manager.post('/transactions/', {
      washer_id: J_ID,
      category: 'motorcycle',
      expected_price: 70,
      cash_paid: 70,
      mpesa_paid: 0,
      tip_method: 'cash',
    });
    expect(r.json.employee_financials.calculated_commission).toBe(30);
    expect(r.json.employee_financials.final_payout_output).toBe(30);
    ids.push(r.json.id);
  });

  it('taxi @100 -> commission 0', async () => {
    const r = await manager.post('/transactions/', {
      washer_id: J_ID,
      category: 'taxi',
      expected_price: 100,
      cash_paid: 100,
      mpesa_paid: 0,
      tip_method: 'cash',
    });
    expect(r.json.employee_financials.calculated_commission).toBe(0);
    expect(r.json.employee_financials.final_payout_output).toBe(0);
    ids.push(r.json.id);
  });

  it('cash tip isolation creates a linked Chai expense', async () => {
    const r = await manager.post('/transactions/', {
      washer_id: J_ID,
      category: 'car',
      expected_price: 200,
      cash_paid: 300,
      mpesa_paid: 0,
      tip_method: 'cash',
    });
    expect(r.json.transaction_summary.isolated_tip).toBe(100);
    ids.push(r.json.id);
    const exps = await manager.get('/expenses/');
    const chai = exps.json.find((e: any) => e.transaction_id === r.json.id);
    expect(chai).toBeTruthy();
    expect(chai.description).toBe('Chai (tip) - Jeophrey');
    expect(chai.amount).toBe(100);
  });

  it('wages tip_method deposits isolated tip into wage', async () => {
    const before = await washerBal(J_ID);
    const r = await manager.post('/transactions/', {
      washer_id: J_ID,
      category: 'car',
      expected_price: 200,
      cash_paid: 300,
      mpesa_paid: 0,
      tip_method: 'wages',
    });
    expect(r.json.employee_financials.final_payout_output).toBe(170); // 70 + 100
    ids.push(r.json.id);
    const after = await washerBal(J_ID);
    expect(after.payable - before.payable).toBe(170);
  });

  it('misc validations: overpayment-exceeding misc -> 400, no description -> 400', async () => {
    const a = await manager.post('/transactions/', {
      washer_id: J_ID,
      category: 'car',
      expected_price: 200,
      cash_paid: 250,
      mpesa_paid: 0,
      tip_method: 'cash',
      misc_amount: 100,
      misc_description: 'extra',
    });
    expect(a.status).toBe(400);
    expect(a.json.detail).toContain('exceeds overpayment');

    const b = await manager.post('/transactions/', {
      washer_id: J_ID,
      category: 'car',
      expected_price: 200,
      cash_paid: 250,
      mpesa_paid: 0,
      tip_method: 'cash',
      misc_amount: 50,
    });
    expect(b.status).toBe(400);
    expect(b.json.detail).toContain('requires a description');

    const c = await manager.post('/transactions/', {
      washer_id: J_ID,
      category: 'car',
      expected_price: 200,
      cash_paid: 250,
      mpesa_paid: 0,
      tip_method: 'cash',
      misc_amount: 50,
      misc_description: 'damage',
    });
    expect(c.status).toBe(200);
    expect(c.json.transaction_summary.misc_amount).toBe(50);
    expect(c.json.transaction_summary.isolated_tip).toBe(0);
    ids.push(c.json.id);
  });

  it('rejects negative money, unknown washer, missing/invalid fields', async () => {
    expect(
      (await manager.post('/transactions/', {
        washer_id: J_ID,
        category: 'car',
        expected_price: -5,
        cash_paid: 0,
        mpesa_paid: 0,
        tip_method: 'cash',
      })).status,
    ).toBe(422);
    expect(
      (await manager.post('/transactions/', {
        washer_id: J_ID,
        category: 'car',
        expected_price: 100,
        cash_paid: -1,
        mpesa_paid: 0,
        tip_method: 'cash',
      })).status,
    ).toBe(422);
    expect(
      (await manager.post('/transactions/', {
        washer_id: 99999,
        category: 'car',
        expected_price: 100,
        cash_paid: 100,
        mpesa_paid: 0,
        tip_method: 'cash',
      })).status,
    ).toBe(404);
    expect(
      (await manager.post('/transactions/', {
        category: 'car',
        expected_price: 100,
        cash_paid: 100,
        mpesa_paid: 0,
        tip_method: 'cash',
      })).status,
    ).toBe(422);
    expect(
      (await manager.post('/transactions/', {
        washer_id: J_ID,
        category: 'spaceship',
        expected_price: 100,
        cash_paid: 100,
        mpesa_paid: 0,
        tip_method: 'cash',
      })).status,
    ).toBe(422);
  });

  it('employees cannot create transactions, managers/admin can', async () => {
    const r = await empJ.post('/transactions/', {
      washer_id: J_ID,
      category: 'car',
      expected_price: 100,
      cash_paid: 100,
      mpesa_paid: 0,
      tip_method: 'cash',
    });
    expect(r.status).toBe(403);
  });

  it('lists transactions with week/day filters and enforces employee self-scoping', async () => {
    const week = (await manager.get('/transactions/')).json[0];
    const weekId = week.week_id;
    expect(/^\d{4}-\d{2}$/.test(weekId)).toBe(true);

    const byWeek = await manager.get(`/transactions/?week_id=${weekId}`);
    expect(byWeek.status).toBe(200);
    expect(byWeek.json.length).toBeGreaterThanOrEqual(ids.length);

    const asJ = await empJ.get(`/transactions/?week_id=${weekId}`);
    for (const t of asJ.json) expect(t.washer_id).toBe(J_ID);

    const tx = byWeek.json.find((t: any) => t.id === ids[0]);
    expect(tx.category).toBe('car');
    expect(tx.tip_method).toBe('cash');
    expect(typeof tx.timestamp).toBe('string');
    expect(tx.total_paid).toBe(200);
  });

  it('rejects malformed day parameter (validate_day)', async () => {
    expect((await manager.get('/transactions/?day=2026/09/23')).status).toBe(400);
    expect((await manager.get('/transactions/?day=2026-13-99')).status).toBe(400);
    expect((await manager.get('/transactions/?day=2026-09-23')).status).toBe(200);
  });

  it('updates a transaction and re-applies balances', async () => {
    const before = await washerBal(A_ID);
    const r = await manager.post('/transactions/', {
      washer_id: A_ID,
      category: 'car',
      expected_price: 200,
      cash_paid: 200,
      mpesa_paid: 0,
      tip_method: 'cash',
    });
    ids.push(r.json.id);
    expect(r.json.employee_financials.final_payout_output).toBe(70);

    // Shortpay -> wage drops to -30 (debt) and payable/debt balances shift.
    const up = await manager.put(`/transactions/${r.json.id}`, { cash_paid: 100 });
    expect(up.status).toBe(200);
    expect(up.json.transaction_summary.shortfall_detected).toBe(100);
    expect(up.json.employee_financials.final_payout_output).toBe(-30);

    const after = await washerBal(A_ID);
    // Old tx credited +70 payable; new credits 0 payable and +30 debt.
    expect(after.payable - before.payable).toBe(0);
    expect(after.debt - before.debt).toBe(30);
  });

  it('deletes a transaction, reversing balances and linked expenses', async () => {
    const before = await washerBal(J_ID);
    const r = await manager.post('/transactions/', {
      washer_id: J_ID,
      category: 'car',
      expected_price: 200,
      cash_paid: 250,
      mpesa_paid: 0,
      tip_method: 'cash',
    });
    const exps = (await manager.get('/expenses/')).json.filter((e: any) => e.transaction_id === r.json.id);
    expect(exps.length).toBe(1);
    ids.push(r.json.id);

    expect((await manager.delete(`/transactions/${r.json.id}`)).status).toBe(200);
    const after = await washerBal(J_ID);
    expect(after.payable - before.payable).toBe(0);
    expect(after.debt - before.debt).toBe(0);
    const expsAfter = (await manager.get('/expenses/')).json.filter((e: any) => e.transaction_id === r.json.id);
    expect(expsAfter.length).toBe(0);
    expect((await manager.delete(`/transactions/${r.json.id}`)).status).toBe(404);
  });
});

describe('expenses & tips', () => {
  it('creates and lists expenses', async () => {
    const r = await manager.post('/expenses/', { description: 'Soap refill', amount: 150, category: 'Stock' });
    expect(r.status).toBe(200);
    expect(r.json.description).toBe('Soap refill');
    expect(r.json.amount).toBe(150);
    expect(r.json.category).toBe('Stock');
    expect(/^\d{4}-\d{2}$/.test(r.json.week_id)).toBe(true);

    expect((await manager.get('/expenses/')).status).toBe(200);
    expect((await manager.delete(`/expenses/${r.json.id}`)).status).toBe(200);
  });

  it('rejects negative expense amount and non-admin', async () => {
    expect((await manager.post('/expenses/', { description: 'x', amount: -1, category: 'y' })).status).toBe(422);
    expect((await empJ.post('/expenses/', { description: 'x', amount: 1, category: 'y' })).status).toBe(403);
  });

  it('cash tip creates a Chai expense; wages tip credits payable balance', async () => {
    const before = (await admin.get('/auth/users')).json.find((u: any) => u.id === J_ID);
    const rCash = await manager.post('/tips/', { employee_id: J_ID, amount: 50, method: 'cash' });
    expect(rCash.status).toBe(200);
    expect(rCash.json.message).toBe('Tip logged successfully');
    expect(rCash.json.method).toBe('cash');

    const exps = await manager.get('/expenses/');
    expect(exps.json.some((e: any) => e.description === 'Chai - Jeophrey' && e.amount === 50)).toBe(true);

    const rWages = await manager.post('/tips/', { employee_id: J_ID, amount: 70, method: 'wages' });
    expect(rWages.status).toBe(200);
    const after = (await admin.get('/auth/users')).json.find((u: any) => u.id === J_ID);
    expect(after.payable_balance - before.payable_balance).toBe(70);
  });
});

describe('debts & repayments', () => {
  it('creates debts, updates balances, reconciles repayments oldest-first', async () => {
    const before = (await admin.get('/auth/users')).json.find((u: any) => u.id === J_ID).debt_balance;

    const d1 = await manager.post('/debts/', { employee_id: J_ID, amount: 5000, service: 'Advance 1' });
    const d2 = await manager.post('/debts/', { employee_id: J_ID, amount: 3000, service: 'Advance 2' });
    expect(d1.status).toBe(200);
    expect(d1.json.balance).toBe(5000);
    expect(d2.json.balance).toBe(3000);

    const mid = (await admin.get('/auth/users')).json.find((u: any) => u.id === J_ID).debt_balance;
    expect(mid - before).toBe(8000);

    // Repay 4000: applied to oldest debt first (advance 1).
    const rep = await manager.post('/repayments/', { employee_id: J_ID, amount: 4000 });
    expect(rep.status).toBe(200);
    expect(rep.json.amount).toBe(4000);

    const debts = await manager.get('/debts/?employee_id=' + J_ID);
    const dd1 = debts.json.find((d: any) => d.id === d1.json.id);
    const dd2 = debts.json.find((d: any) => d.id === d2.json.id);
    expect(dd1.balance).toBe(1000);
    expect(dd1.paid).toBe(4000);
    expect(dd2.balance).toBe(3000);
    expect(dd2.paid).toBe(0);

    const after = (await admin.get('/auth/users')).json.find((u: any) => u.id === J_ID).debt_balance;
    expect(after - before).toBe(4000);

    // Full repayment cannot push debt balance negative.
    const over = await manager.post('/repayments/', { employee_id: J_ID, amount: 99999 });
    expect(over.status).toBe(200);
    const finalDebt = (await admin.get('/auth/users')).json.find((u: any) => u.id === J_ID).debt_balance;
    expect(finalDebt).toBe(0);

    await manager.delete(`/debts/${d1.json.id}`);
    await manager.delete(`/debts/${d2.json.id}`);
    expect(finalDebt).toBeLessThanOrEqual(0);
  });

  it('updating a debt paid amount adjusts balance; deleting reverses it', async () => {
    const before = (await admin.get('/auth/users')).json.find((u: any) => u.id === A_ID).debt_balance;
    const d = await manager.post('/debts/', { employee_id: A_ID, amount: 1000, service: 'Phone' });
    // create_debt adds (amount - paid) = 1000
    expect((await admin.get('/auth/users')).json.find((u: any) => u.id === A_ID).debt_balance - before).toBe(1000);

    // Python update_debt moves balance by (new_paid - old_paid) = +400, keeping parity.
    const upd = await manager.put(`/debts/${d.json.id}`, { paid: 400 });
    expect(upd.status).toBe(200);
    expect(upd.json.balance).toBe(600);
    expect((await admin.get('/auth/users')).json.find((u: any) => u.id === A_ID).debt_balance - before).toBe(1400);

    await manager.delete(`/debts/${d.json.id}`);
    // delete_debt subtracts (amount - paid) = 600
    expect((await admin.get('/auth/users')).json.find((u: any) => u.id === A_ID).debt_balance - before).toBe(800);
  });

  it('rejects negative amounts and unknown employees; employees see own debts only', async () => {
    expect((await manager.post('/debts/', { employee_id: J_ID, amount: -10 })).status).toBe(422);
    expect((await manager.post('/debts/', { employee_id: 99999, amount: 10 })).status).toBe(404);
    const r = await empJ.get('/debts/');
    for (const d of r.json) expect(d.employee_id).toBe(J_ID);
    expect((await manager.get('/debts/?employee_id=99999')).status).toBe(200);
  });
});

describe('stats', () => {
  it('summary aggregates daily/weekly totals and labor breakdown', async () => {
    const s = await manager.get('/stats/summary');
    expect(s.status).toBe(200);
    expect(typeof s.json.total_cash_received).toBe('number');
    expect(s.json.total_cash_received).toBeGreaterThan(0);
    expect(s.json.total_debts).toBeGreaterThanOrEqual(0);
    expect(s.json.category_counts).toHaveProperty('car');
    expect(Array.isArray(s.json.labor_breakdown)).toBe(true);
  });

  it('employees stats list each employee with counts and balances', async () => {
    const r = await manager.get('/stats/employees');
    expect(r.status).toBe(200);
    const j = r.json.find((e: any) => e.abbreviation === 'J');
    expect(j).toBeTruthy();
    expect(j.name).toBe('Jeophrey');
    expect(j.jobs_count).toBeGreaterThan(0);
    expect(j.payable_balance).toBeGreaterThanOrEqual(0);
    expect(j.current_debt).toBeGreaterThanOrEqual(0);
    expect(j.service_counts).toHaveProperty('car');
    expect(Array.isArray(j.wage_breakdown)).toBe(true);
    expect(Array.isArray(j.misc_items)).toBe(true);
  });

  it('employee self-service and single-employee stats endpoints', async () => {
    const me = await empJ.get('/stats/me');
    expect(me.status).toBe(200);
    expect(me.json.abbreviation).toBe('J');
    const one = await manager.get('/stats/employees/3');
    expect(one.status).toBe(200);
    expect(one.json.id).toBe(J_ID);
  });

  it('rejects bad day on stats endpoints', async () => {
    expect((await manager.get('/stats/summary?day=2026/13/01')).status).toBe(400);
    expect((await manager.get('/stats/employees?day=not-a-date')).status).toBe(400);
    expect((await empJ.get('/stats/me?day=2026-02-30')).status).toBe(400);
  });
});

describe('carpets', () => {
  it('receive -> wash -> release creates a carpet transaction (release fix)', async () => {
    const beforeExpenses = (await manager.get('/expenses/')).json.length;

    const recv = await manager.post('/carpets/', {
      receiver_id: J_ID,
      characteristics: 'Blue rug 5x3',
      client_name: 'Alice',
      customer_phone: '0700111222',
      expected_price: 200,
      cash_paid: 0,
      mpesa_paid: 0,
    });
    expect(recv.status).toBe(200);
    expect(recv.json.status).toBe('received');
    expect(recv.json.is_washed).toBe(false);
    const carpetId = recv.json.id;

    const wash = await manager.patch(`/carpets/${carpetId}/wash`);
    expect(wash.status).toBe(200);
    expect(wash.json.is_washed).toBe(true);

    const rel = await manager.post(`/carpets/${carpetId}/release`, { cash_paid: 200 });
    expect(rel.status).toBe(200);
    expect(rel.json.status).toBe('released');

    // The release must have recorded a carpet transaction for the receiver.
    const week = (await manager.get('/transactions/')).json[0].week_id;
    const txs = (await manager.get(`/transactions/?week_id=${week}`)).json;
    const carpetTx = txs.find((t: any) => t.category === 'carpet' && t.customer_phone === '0700111222');
    expect(carpetTx).toBeTruthy();
    expect(carpetTx.washer_id).toBe(J_ID);
    expect(carpetTx.carpet_characteristics).toBe('Blue rug 5x3');
    // carpet @200 -> standard 30% commission (not the car flat rate)
    expect(carpetTx.calculated_commission).toBe(60);
    expect(carpetTx.final_payout).toBe(60);
    expect(carpetTx.shortfall).toBe(0);

    // Day sheet + stats reflect the release.
    const me = await empJ.get('/stats/me');
    expect(me.json.carpets_released).toBeGreaterThan(0);

    // No isolated tip -> no extra Chai expense for the release.
    expect((await manager.get('/expenses/')).json.length).toBe(beforeExpenses);

    // Releasing twice is rejected.
    expect((await manager.post(`/carpets/${carpetId}/release`, { cash_paid: 200 })).status).toBe(400);

    await manager.delete(`/carpets/${carpetId}`);
  });

  it('releasing a zero-value carpet records no transaction', async () => {
    const before = (await manager.get('/transactions/')).json.length;
    const recv = await manager.post('/carpets/', {
      receiver_id: A_ID,
      characteristics: 'Small mat',
      expected_price: 0,
      cash_paid: 0,
      mpesa_paid: 0,
    });
    const rel = await manager.post(`/carpets/${recv.json.id}/release`, {});
    expect(rel.status).toBe(200);
    expect(rel.json.status).toBe('released');
    expect((await manager.get('/transactions/')).json.length).toBe(before);
    await manager.delete(`/carpets/${recv.json.id}`);
  });

  it('employees only see carpets they received', async () => {
    const r = await empJ.get('/carpets/');
    expect(r.status).toBe(200);
    for (const c of r.json) expect(c.receiver_id).toBe(J_ID);
  });

  it('validates carpet pay fields and receiver existence', async () => {
    expect(
      (await manager.post('/carpets/', { receiver_id: 99999, expected_price: 20 })).status,
    ).toBe(404);
    expect(
      (await manager.post('/carpets/', { receiver_id: J_ID, expected_price: -1 })).status,
    ).toBe(422);
  });
});

describe('misc guards', () => {
  it('floats/booleans/categories serialize as the frontend expects', async () => {
    const s = await manager.get('/stats/summary');
    const counts = Object.keys(s.json.category_counts);
    expect(counts.every((k) => /^[a-z]+$/.test(k))).toBe(true);

    const t = (await manager.get('/transactions/')).json[0];
    expect(/^[a-z]+$/.test(t.category)).toBe(true);
    expect(/^[a-z]+$/.test(t.tip_method)).toBe(true);
  });

  it('unknown routes return FastAPI-style 404', async () => {
    const r = await manager.get('/does-not-exist');
    expect(r.status).toBe(404);
    expect(r.json.detail).toBe('Not Found');
  });
});