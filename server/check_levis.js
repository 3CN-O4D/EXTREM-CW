const { Pool } = require('pg');
const fs = require('fs');
const raw = fs.readFileSync('/home/bard/carwash/EXTREM-CW/.env','utf8').match(/DATABASE_URL=(.*)/)[1].trim();
const cs = raw.replace(/([?&])sslmode=[A-Za-z_-]*/g, '$1').replace(/[?&]$/, '');
const pool = new Pool({ connectionString: cs, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 30000 });

(async () => {
  try {
    console.log('=== EMPLOYEE 4 (Levis) TRANSACTIONS ===');
    const txs = await pool.query("SELECT id, category, expected_price, cash_paid, mpesa_paid, shortfall, calculated_commission, final_payout, net_business_remittance, timestamp FROM transactions WHERE washer_id = 4 ORDER BY id");
    console.table(txs.rows.map(r => ({...r, total_paid: (r.cash_paid||0)+(r.mpesa_paid||0)})));

    console.log('\n=== EMPLOYEE 4 DEBTS ===');
    const debts = await pool.query("SELECT * FROM debts WHERE employee_id = 4 ORDER BY id");
    console.table(debts.rows);

    console.log('\n=== EMPLOYEE 4 USER BALANCE ===');
    const users = await pool.query("SELECT id, abbreviation, full_name, payable_balance, debt_balance FROM users WHERE id = 4");
    console.table(users.rows);

    // Compute what wage should be
    const allTx = await pool.query("SELECT final_payout FROM transactions WHERE washer_id = 4");
    const totalPayout = allTx.rows.reduce((s, r) => s + Number(r.final_payout), 0);
    console.log(`\nTotal payout from transactions: ${totalPayout}`);
    console.log(`Expected wage: payable=${Math.max(0,totalPayout)}, debt=${Math.max(0,-totalPayout)}`);

  } catch(e) { console.error('ERROR:', e.message); }
  finally { await pool.end(); }
})();
