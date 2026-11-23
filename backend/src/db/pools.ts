import pg from 'pg';
import { AppConfig } from '../config/env.js';

const { Pool } = pg;

export interface DatabasePools {
  /**
   * חיבור Read-Only תחת המשתמש app_public_ro:
   * משמש את כלל נקודות הקצה הציבוריות לקריאה (GET /api/v1/*) ואת שרת ה-MCP (/mcp).
   * אפס גישה לסכמת app_private!
   */
  roPool: pg.Pool;

  /**
   * חיבור Write מוגבל תחת המשתמש app_backend_write:
   * משמש אך ורק את POST /api/v1/reports, POST /api/v1/reports/withdraw ו-POST /api/v1/corrections.
   */
  writePool: pg.Pool;
}

export function createDatabasePools(config: AppConfig): DatabasePools {
  const roPool = new Pool({
    connectionString: config.databasePublicRoUrl,
    max: 15,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  const writePool = new Pool({
    connectionString: config.databaseBackendWriteUrl,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  return { roPool, writePool };
}
