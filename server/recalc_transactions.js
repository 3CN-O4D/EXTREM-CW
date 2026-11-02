const { Pool } = require('pg');
const fs = require('fs');
const raw = fs.readFileSync('/home/bard/carwash/EXTREM-CW/.env','utf8').match(/DATABASE_URL=(.*)/)[1].trim();
const cs = raw.replace(/([?&])sslmode=[A-Za-z_-]*/g, '$1').replace(/[?&]$/, '');
const pool = new Pool({ connectionString: cs, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 30000 });

function calculateTransaction(data, prices) {
  let expected_price = data.expected_price;
  const priceCfg = prices?.[data.category];

  // 1. Full Package floor
  if (data.has_car_wash && data.has_vacuum && data.has_engine_wash) {
    const pkgMax = Number(priceCfg?.max_price ?? 800);
    if (expected_price < pkgMax) expected_price = pkgMax;
  }

  let commission = 0.0;
  const cp = Number(priceCfg?.commission_percent ?? 30);
  const minP = Number(priceCfg?.min_price ?? 0);
  const maxP = Number(priceCfg?.max_price ?? 0);

  if (data.category === 'motorcycle' && minP > 0) {
    if (expected_price < minP) commission = 0.0;
    else if (expected_price <= minP + 10) commission = expected_price - minP;
    else commission = 10.0 + 2.0 * (expected_price - (minP + 10));
  } else if (data.category === 'car' && (data.has_vacuum || data.has_engine_wash)) {
    commission = expected_price * 30.0 / 100.0;
  } else if (expected_price >= minP && minP > 0) {
    commission = expected_price * cp / 100.0;
  } else if (minP === 0) {
    commission = expected_price * cp / 100.0;
  }

  const total_paid = data.cash_paid + data.mpesa_paid;
  const misc_amount = data.misc_amount || 0.0;
  let isolated_tip = 0.0;
  if (total_paid > expected_price) isolated_tip = Math.max(0.0, total_paid - expected_price - misc_amount);
  isolated_tip += data.manual_tip || 0;

  const net_business_remittance = total_paid - isolated_tip;

  let effectivePriceForShortfall = expected_price;
  let makes_allowance = 0.0;

  if (data.category === 'motorcycle' && minP > 0) {
    if (total_paid < minP) {
      effectivePriceForShortfall = minP;
      makes_allowance = 0.0;
      commission = 0.0;
    } else {
      makes_allowance = maxP - minP;
    }
  } else if ((data.category === 'vacuum' || data.category === 'engine') && !(data.has_car_wash)) {
    makes_allowance = Number(priceCfg?.min_price ?? 200.0);
  } else if (data.category === 'car' && (data.has_vacuum || data.has_engine_wash)) {
    const vacuumCfg = prices?.vacuum;
    const engineCfg = prices?.engine;
    const hasBoth = data.has_vacuum && data.has_engine_wash;

    if (hasBoth) {
      const comboMin = minP + Number(data.has_vacuum ? vacuumCfg?.min_price ?? 0 : 0) + Number(data.has_engine_wash ? engineCfg?.min_price ?? 0 : 0);
      const comboMax = maxP + Number(data.has_vacuum ? vacuumCfg?.max_price ?? 0 : 0) + Number(data.has_engine_wash ? engineCfg?.max_price ?? 0 : 0);
      if (total_paid < comboMin) {
        effectivePriceForShortfall = comboMin;
        makes_allowance = 0.0;
        commission = total_paid * 30.0 / 100.0;
      } else {
        makes_allowance = comboMax - comboMin;
        commission = Math.min(total_paid, comboMax) * 30.0 / 100.0;
      }
    } else {
      const carMax = maxP;
      const addonMax = Number(data.has_vacuum ? (vacuumCfg?.max_price ?? 300) : (engineCfg?.max_price ?? 300));
      const carPaid = Math.min(total_paid, carMax);
      const addonPaid = Math.max(0, Math.min(total_paid - carMax, addonMax));
      const carMin = minP;
      const addonMin = Number(data.has_vacuum ? (vacuumCfg?.min_price ?? 200) : (engineCfg?.min_price ?? 200));
      effectivePriceForShortfall = carMin + addonMin;
      makes_allowance = 0.0;
      commission = (carPaid + addonPaid) * 30.0 / 100.0;
    }
  }
  const gross_shortfall = Math.max(0.0, effectivePriceForShortfall - net_business_remittance);
  const shortfall = Math.max(0.0, gross_shortfall - makes_allowance);

  let net_wage_before_tip = 0.0;
  if (net_business_remittance === 0) {
    net_wage_before_tip = -expected_price;
  } else {
    net_wage_before_tip = commission - shortfall;
  }

  let final_payout = net_wage_before_tip;
  if (data.tip_method === 'wages') final_payout += isolated_tip;

  return { expected_price, shortfall, commission, net_wage_before_tip, final_payout, net_business_remittance, isolated_tip, gross_shortfall };
}

(async () => {
  try {
    const priceRows = await pool.query('SELECT category, min_price, max_price, commission_percent FROM prices WHERE is_active = true');
    const prices = {};
    for (const r of priceRows.rows) prices[r.category] = r;

    const txRows = await pool.query('SELECT * FROM transactions ORDER BY id');
    const transactions = txRows.rows;
    console.log(`Found ${transactions.length} transactions to recalculate`);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const employeeChanges = {};

      for (const tx of transactions) {
        const data = {
          category: tx.category.toLowerCase(),
          expected_price: tx.expected_price,
          cash_paid: tx.cash_paid || 0,
          mpesa_paid: tx.mpesa_paid || 0,
          manual_tip: tx.manual_tip || 0,
          misc_amount: tx.misc_amount || 0,
          tip_method: tx.tip_method ? tx.tip_method.toLowerCase() : 'cash',
          has_car_wash: tx.has_car_wash || false,
          has_vacuum: tx.has_vacuum || false,
          has_engine_wash: tx.has_engine_wash || false,
          plate_number: tx.plate_number,
          custom_category: tx.custom_category,
          carpet_metadata: tx.carpet_metadata,
        };

        const result = calculateTransaction(data, prices);

        await client.query(
          `UPDATE transactions SET
            expected_price = $1,
            shortfall = $2,
            calculated_commission = $3,
            net_wage_before_tip = $4,
            final_payout = $5,
            net_business_remittance = $6,
            isolated_tip = $7
          WHERE id = $8`,
          [
            result.expected_price,
            result.shortfall,
            result.commission,
            result.net_wage_before_tip,
            result.final_payout,
            result.net_business_remittance,
            result.isolated_tip,
            tx.id,
          ]
        );

        if (!employeeChanges[tx.washer_id]) {
          employeeChanges[tx.washer_id] = { total_final_payout: 0, count: 0 };
        }
        employeeChanges[tx.washer_id].total_final_payout += result.final_payout;
        employeeChanges[tx.washer_id].count += 1;

        console.log(`Tx #${tx.id}: ${tx.category} expected=${result.expected_price} paid=${tx.cash_paid + tx.mpesa_paid} shortfall=${result.shortfall} commission=${result.commission} payout=${result.final_payout}`);
      }

      await client.query('COMMIT');
      console.log('\nAll transactions recalculated successfully.');

      const client2 = await pool.connect();
      try {
        await client2.query('BEGIN');
        await client2.query('UPDATE users SET payable_balance = 0, debt_balance = 0 WHERE role = $1', ['EMPLOYEE']);

        for (const [washerId, changes] of Object.entries(employeeChanges)) {
          const totalPayout = changes.total_final_payout;
          const credit = Math.max(0, totalPayout);
          const debit = Math.abs(Math.min(0, totalPayout));
          await client2.query(
            'UPDATE users SET payable_balance = payable_balance + $1, debt_balance = debt_balance + $2 WHERE id = $3',
            [credit, debit, washerId]
          );
          console.log(`Employee ${washerId}: total_payout=${totalPayout.toFixed(2)} credit=${credit.toFixed(2)} debit=${debit.toFixed(2)}`);
        }

        await client2.query('COMMIT');
        console.log('\nEmployee balances recalculated successfully.');
      } catch (e) {
        await client2.query('ROLLBACK');
        throw e;
      } finally {
        client2.release();
      }
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await pool.end();
  }
})();
