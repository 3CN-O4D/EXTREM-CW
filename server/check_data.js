const { Pool } = require('pg');
const fs = require('fs');
const raw = fs.readFileSync('/home/bard/carwash/EXTREM-CW/.env','utf8').match(/DATABASE_URL=(.*)/)[1].trim();
const cs = raw.replace(/([?&])sslmode=[A-Za-z_-]*/g, '$1').replace(/[?&]$/, '');
const pool = new Pool({ connectionString: cs, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 30000 });

(async () => {
  try {
    console.log('=== USERS ===');
    const users = await pool.query('SELECT id, abbreviation, full_name, role, payable_balance, debt_balance FROM users ORDER BY id');
    console.table(users.rows);

    console.log('\n=== TRANSACTIONS ===');
    const txs = await pool.query('SELECT id, washer_id, category, expected_price, cash_paid, mpesa_paid, shortfall, calculated_commission, final_payout, net_business_remittance, timestamp FROM transactions ORDER BY id');
    console.table(txs.rows.map(r => ({...r, total_paid: (r.cash_paid||0)+(r.mpesa_paid||0)})));

    console.log('\n=== DEBTS ===');
    const debts = await pool.query('SELECT * FROM debts ORDER BY id');
    console.table(debts.rows);

    console.log('\n=== CASH SUMMARY ===');
    const cashSum = await pool.query("SELECT COALESCE(SUM(cash_paid),0) as total_cash, COALESCE(SUM(mpesa_paid),0) as total_mpesa, COUNT(*) as count FROM transactions");
    console.log('Total cash:', cashSum.rows[0].total_cash);
    console.log('Total mpesa:', cashSum.rows[0].total_mpesa);
    console.log('Total transactions:', cashSum.rows[0].count);

    console.log('\n=== WEEKLY LOGS (settlements) ===');
    const logs = await pool.query('SELECT * FROM weekly_logs ORDER BY week_id DESC');
    console.table(logs.rows);

    console.log('\n=== CLIENT DEBTS ===');
    const cd = await pool.query('SELECT * FROM client_debts ORDER BY id');
    console.table(cd.rows);

  } catch(e) { console.error('ERROR:', e.message); }
  finally { await pool.end(); }
})();
