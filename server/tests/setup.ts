import fs from 'fs';
import path from 'path';

// Load the repo-root .env (DATABASE_URL, SECRET_KEY, ...) before any app import.
const base = typeof __dirname !== 'undefined' ? path.resolve(__dirname, '../..') : process.cwd();
const envPath = path.resolve(base, '.env');
if (fs.existsSync(envPath)) {
  for (const raw of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(raw.trim());
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2];
    }
  }
}