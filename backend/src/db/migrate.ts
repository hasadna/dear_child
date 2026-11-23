import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { loadConfig } from '../config/env.js';

export interface MigrationFile {
  version: string;
  filename: string;
  fullPath: string;
  sql: string;
  checksum: string;
}

export function resolveMigrationsDir(): string {
  const currentFileDir = path.dirname(fileURLToPath(import.meta.url));
  const localDir = path.join(currentFileDir, 'migrations');
  if (existsSync(localDir)) {
    return localDir;
  }
  const srcFallback = path.resolve(currentFileDir, '../../src/db/migrations');
  if (existsSync(srcFallback)) {
    return srcFallback;
  }
  throw new Error(`Migrations directory not found at ${localDir} or ${srcFallback}`);
}

export function loadMigrationFiles(
  migrationsDir: string = resolveMigrationsDir()
): MigrationFile[] {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  return files.map((filename) => {
    const fullPath = path.join(migrationsDir, filename);
    const sql = readFileSync(fullPath, 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const version = filename.replace(/\.sql$/, '');
    return {
      version,
      filename,
      fullPath,
      sql,
      checksum,
    };
  });
}

export async function runMigrations(
  connectionString: string = loadConfig().databaseEtlUrl
): Promise<{ applied: string[]; skipped: string[] }> {
  const migrations = loadMigrationFiles();
  const pool = new pg.Pool({ connectionString });
  const client = await pool.connect();

  const applied: string[] = [];
  const skipped: string[] = [];

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        version     TEXT PRIMARY KEY,
        checksum    CHAR(64) NOT NULL,
        applied_at  DATE NOT NULL DEFAULT CURRENT_DATE
      );
    `);

    const existingRes = await client.query<{
      version: string;
      checksum: string;
    }>('SELECT version, checksum FROM public.schema_migrations');
    const appliedMap = new Map(
      existingRes.rows.map((r) => [r.version, r.checksum])
    );

    for (const migration of migrations) {
      if (appliedMap.has(migration.version)) {
        skipped.push(migration.version);
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query(
          'INSERT INTO public.schema_migrations (version, checksum) VALUES ($1, $2)',
          [migration.version, migration.checksum]
        );
        await client.query('COMMIT');
        applied.push(migration.version);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    return { applied, skipped };
  } finally {
    client.release();
    await pool.end();
  }
}

if (
  process.argv[1] &&
  (process.argv[1].endsWith('migrate.js') ||
    process.argv[1].endsWith('migrate.ts'))
) {
  runMigrations()
    .then(({ applied, skipped }) => {
      console.log(
        `[DB Migrate] Completed. Applied: ${applied.length} (${applied.join(', ') || 'none'}), Skipped: ${skipped.length}`
      );
    })
    .catch((err) => {
      console.error('[DB Migrate] Failed:', err);
      process.exit(1);
    });
}
