const { Pool } = require('pg');
const fs = require('fs');
const raw = fs.readFileSync('/home/bard/carwash/EXTREM-CW/.env','utf8').match(/DATABASE_URL=(.*)/)[1].trim();
const cs = raw.replace(/([?&])sslmode=[A-Za-z_-]*/g, '$1').replace(/[?&]$/, '');
const pool = new Pool({ connectionString: cs, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 30000 });

(async () => {
  try {
    // 1. Delete the bad debt #56 (amount 199550 from buggy calculation)
    await pool.query('DELETE FROM debts WHERE id = 56');
    console.log('Deleted bad debt #56 (amount 199550)');

    // 2. Recalculate employee balances from scratch based on current transactions
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Reset all employee balances
      await client.query("UPDATE users SET payable_balance = 0, debt_balance = 0 WHERE role = 'EMPLOYEE'");

      // Get all transactions with correct payouts
      const txs = await client.query('SELECT washer_id, final_payout FROM transactions');
      const empTotals = {};
      for (const r of txs.rows) {
        if (!empTotals[r.washer_id]) empTotals[r.washer_id] = 0;
        empTotals[r.washer_id] += Number(r.final_payout);
      }

      for (const [washerId, totalPayout] of Object.entries(empTotals)) {
        const credit = Math.max(0, totalPayout);
        const debit = Math.abs(Math.min(0, totalPayout));
        await client.query(
          'UPDATE users SET payable_balance = $1, debt_balance = $2 WHERE id = $3',
          [credit, debit, washerId]
        );
        console.log(`Employee ${washerId}: total_payout=${totalPayout} credit=${credit} debit=${debit}`);
      }

      await client.query('COMMIT');
      console.log('\nEmployee balances recalculated.');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    // 3. Verify final state
    console.log('\n=== FINAL USERS ===');
    const users = await pool.query('SELECT id, abbreviation, full_name, payable_balance, debt_balance FROM users ORDER BY id');
    console.table(users.rows);

    console.log('\n=== FINAL DEBTS ===');
    const debts = await pool.query('SELECT * FROM debts ORDER BY id');
    console.table(debts.rows);

  } catch(e) { console.error('ERROR:', e.message); }
  finally { await pool.end(); }
})();
