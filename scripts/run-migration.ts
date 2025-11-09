import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { Pool } from 'pg';
import path from 'path';

// Load environment variables from .env.local
config({ path: '.env.local' });

const pool = new Pool({
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
});

async function runMigration() {
  const migrationFile = process.argv[2];

  if (!migrationFile) {
    console.error('Usage: npx tsx scripts/run-migration.ts <migration-file>');
    process.exit(1);
  }

  const migrationPath = path.join(process.cwd(), migrationFile);

  console.log(`Running migration: ${migrationPath}`);

  try {
    const sql = readFileSync(migrationPath, 'utf-8');

    await pool.query(sql);

    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
