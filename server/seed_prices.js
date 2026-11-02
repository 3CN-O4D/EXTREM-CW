const { Pool } = require('pg');
const fs = require('fs');
const raw = fs.readFileSync('/home/bard/carwash/EXTREM-CW/.env','utf8').match(/DATABASE_URL=(.*)/)[1].trim();
const connectionString = raw.replace(/([?&])sslmode=[A-Za-z_-]*/g, '$1').replace(/[?&]$/, '');
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 20000 });
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS prices (
        id SERIAL PRIMARY KEY,
        category VARCHAR(50) UNIQUE NOT NULL,
        min_price NUMERIC NOT NULL DEFAULT 0,
        max_price NUMERIC NOT NULL DEFAULT 0,
        commission_percent NUMERIC NOT NULL DEFAULT 30,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
      );
    `);
    await pool.query(`
      INSERT INTO prices (category, min_price, max_price, commission_percent) VALUES
        ('bicycle', 50, 50, 0),
        ('motorcycle', 50, 70, 43),
        ('taxi', 150, 150, 33),
        ('car', 200, 200, 35),
        ('midrange', 300, 300, 30),
        ('lorry', 500, 500, 30),
        ('carpet', 300, 300, 30),
        ('vacuum', 200, 300, 30),
        ('engine', 200, 300, 30),
        ('other', 0, 0, 0)
      ON CONFLICT (category) DO NOTHING;
    `);
    const res = await pool.query('SELECT * FROM prices ORDER BY category');
    console.log('Prices seeded:', res.rows.length);
    console.table(res.rows);
  } catch (e) { console.log('ERR:', e.message); }
  finally { await pool.end(); }
})();
