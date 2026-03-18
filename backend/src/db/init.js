/**
 * Database migration runner.
 * Reads SQL from migrations/ and executes idempotently (IF NOT EXISTS).
 */

const fs = require('fs');
const path = require('path');
const { query } = require('./pool');

async function initDb() {
  const migrationDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationDir, file), 'utf8');
    console.log(`Running migration: ${file}`);
    await query(sql);
  }

  console.log(`Database migrations complete (${files.length} file(s))`);
}

module.exports = { initDb };
