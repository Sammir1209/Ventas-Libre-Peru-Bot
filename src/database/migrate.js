const fs = require('fs');
const path = require('path');

// ══════════════════════════════════════════════════════
// ⟡ Script de Migración Manual
// ══════════════════════════════════════════════════════

async function runMigrations() {
  require('dotenv').config();
  const { Pool } = require('pg');

  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL || 'postgresql://localhost:5432/ventas_libres',
    ssl: (process.env.POSTGRES_URL || '').includes('render.com')
      ? { rejectUnauthorized: false }
      : false,
  });

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`⟡ Ejecutando ${files.length} migración(es)...\n`);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    try {
      await pool.query(sql);
      console.log(`  ✓ ${file}`);
    } catch (err) {
      console.error(`  ✗ ${file}: ${err.message}`);
    }
  }

  await pool.end();
  console.log('\n⟡ Migraciones completadas.');
}

runMigrations().catch(console.error);
