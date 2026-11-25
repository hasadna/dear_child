import { getActiveSchoolYear } from '../utils/school-years.js';

export interface AppConfig {
  port: number;
  host: string;
  nodeEnv: 'development' | 'production' | 'test';
  activeSchoolYear: number;
  databasePublicRoUrl: string;
  databaseBackendWriteUrl: string;
  databaseEtlUrl: string;
  secretPepper: string;
  quotaPepperSeparate: string;
  googleClientId: string;
  turnstileSecretKey: string;
  externalFacilitiesApiUrl: string;
  externalFacilitiesCsvUrl: string;
  obudgetFacilitiesUrl: string;
  frontendStaticDir?: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = (env.NODE_ENV as AppConfig['nodeEnv']) || 'development';
  const defaultDbUrl =
    env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/dear_child';

  return {
    port: Number(env.PORT || 3000),
    host: env.HOST || '0.0.0.0',
    nodeEnv,
    activeSchoolYear: Number(env.ACTIVE_SCHOOL_YEAR || getActiveSchoolYear()),
    databasePublicRoUrl: env.DATABASE_PUBLIC_RO_URL || defaultDbUrl,
    databaseBackendWriteUrl: env.DATABASE_BACKEND_WRITE_URL || defaultDbUrl,
    databaseEtlUrl: env.DATABASE_ETL_URL || defaultDbUrl,
    secretPepper:
      env.SECRET_PEPPER || 'dev-only-secret-pepper-replace-with-vault-256bit-key',
    quotaPepperSeparate:
      env.QUOTA_PEPPER_SEPARATE ||
      'dev-only-quota-pepper-replace-with-vault-256bit-key',
    googleClientId: env.GOOGLE_CLIENT_ID || '',
    turnstileSecretKey: env.TURNSTILE_SECRET_KEY || '',
    externalFacilitiesApiUrl:
      env.EXTERNAL_FACILITIES_API_URL || 'https://api-m5crpfzdeq-ez.a.run.app',
    externalFacilitiesCsvUrl:
      env.EXTERNAL_FACILITIES_CSV_URL ||
      'https://next.obudget.org/datapackages/facilities/all/facilities.csv',
    obudgetFacilitiesUrl:
      env.OBUDGET_FACILITIES_URL ||
      'https://next.obudget.org/datapackages/facilities/all/facilities.csv',
    frontendStaticDir: env.FRONTEND_STATIC_DIR,
  };
}
