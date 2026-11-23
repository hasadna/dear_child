import { existsSync, readFileSync } from 'node:fs';
import pg from 'pg';
import { loadConfig } from '../config/env.js';
import { seedBaselineDictionaries } from '../db/seed-dictionaries.js';
import { parseCsvRecords } from './csv-utils.js';
import {
  MergedOfficialDaycare,
  resolveAndMergeOfficialDaycares,
  upsertMergedDaycaresToDb,
} from './entity-resolution-engine.js';
import {
  CanonicalDaycareCandidate,
  parseLaborDaycareRow,
  parseMoEFinancialSanctionRow,
  parseMoELicensedDaycareRow,
  parseMoEMosdotEduRow,
  parseProcessedFacilitiesCsvRow,
  parseTlvGisLayer925Row,
  SanctionRecord,
} from './official-sources-parsers.js';
import {
  insertTlvSeedSubmissionsToDb,
  matchAndBuildTlvCommunitySheetSeed,
} from './tlv-sheet-seed.js';

export interface EtlBatchInput {
  facilitiesDatapackageCsv?: string;
  moeGetMeonotCsv?: string;
  moeMosdotEduCsv?: string;
  moeMirshamSanctionsCsv?: string;
  laborDaycaresCsv?: string;
  tlvGisLayer925Csv?: string;
  tlvCommunitySheetCsv?: string;
}

/**
 * הרצת צינור ה-ETL והאיחוד בזיכרון (ללא תלות בחיבור DB — משמש גם לבדיקות אינטגרציה מהירות)
 */
export function processEtlBatchInMemory(input: EtlBatchInput): {
  mergedDaycares: MergedOfficialDaycare[];
  tlvSeedResult: ReturnType<typeof matchAndBuildTlvCommunitySheetSeed>;
} {
  const candidates: CanonicalDaycareCandidate[] = [];
  const sanctions: SanctionRecord[] = [];

  if (input.facilitiesDatapackageCsv) {
    for (const row of parseCsvRecords(input.facilitiesDatapackageCsv)) {
      const parsed = parseProcessedFacilitiesCsvRow(row);
      if (parsed) candidates.push(parsed);
    }
  }

  if (input.moeGetMeonotCsv) {
    for (const row of parseCsvRecords(input.moeGetMeonotCsv)) {
      const parsed = parseMoELicensedDaycareRow(row);
      if (parsed) candidates.push(parsed);
    }
  }

  if (input.laborDaycaresCsv) {
    for (const row of parseCsvRecords(input.laborDaycaresCsv)) {
      const parsed = parseLaborDaycareRow(row);
      if (parsed) candidates.push(parsed);
    }
  }

  if (input.moeMosdotEduCsv) {
    for (const row of parseCsvRecords(input.moeMosdotEduCsv)) {
      const parsed = parseMoEMosdotEduRow(row);
      if (parsed) candidates.push(parsed);
    }
  }

  if (input.tlvGisLayer925Csv) {
    for (const row of parseCsvRecords(input.tlvGisLayer925Csv)) {
      const parsed = parseTlvGisLayer925Row(row);
      if (parsed) candidates.push(parsed);
    }
  }

  if (input.moeMirshamSanctionsCsv) {
    for (const row of parseCsvRecords(input.moeMirshamSanctionsCsv)) {
      const parsed = parseMoEFinancialSanctionRow(row);
      if (parsed) sanctions.push(parsed);
    }
  }

  const mergedDaycares = resolveAndMergeOfficialDaycares(candidates, sanctions);

  const tlvSeedResult = input.tlvCommunitySheetCsv
    ? matchAndBuildTlvCommunitySheetSeed(
        input.tlvCommunitySheetCsv,
        mergedDaycares
      )
    : {
        matchedSubmissions: [],
        matchedDaycaresCount: 0,
        skippedUnmatchedRowsCount: 0,
      };

  return { mergedDaycares, tlvSeedResult };
}

function readOptionalFile(filePath?: string): string | undefined {
  if (!filePath || !existsSync(filePath)) return undefined;
  return readFileSync(filePath, 'utf8');
}

/**
 * נקודת כניסה למשימת ה-K8s CronJob של צינור הנתונים (npm run etl:sync — D-38).
 */
async function main() {
  const config = loadConfig();
  console.log(
    `[ETL] Starting Dear Child ETL sync for school year ${config.activeSchoolYear}...`
  );

  const batchInput: EtlBatchInput = {
    facilitiesDatapackageCsv: readOptionalFile(
      process.env.ETL_FACILITIES_CSV_PATH
    ),
    moeGetMeonotCsv: readOptionalFile(process.env.ETL_MOE_GETMEONOT_CSV_PATH),
    moeMosdotEduCsv: readOptionalFile(process.env.ETL_MOE_MOSDOT_CSV_PATH),
    moeMirshamSanctionsCsv: readOptionalFile(
      process.env.ETL_MOE_MIRSHAM_CSV_PATH
    ),
    laborDaycaresCsv: readOptionalFile(process.env.ETL_LABOR_CSV_PATH),
    tlvGisLayer925Csv: readOptionalFile(process.env.ETL_TLV_GIS_925_CSV_PATH),
    tlvCommunitySheetCsv: readOptionalFile(
      process.env.ETL_TLV_COMMUNITY_SHEET_CSV_PATH
    ),
  };

  if (
    !batchInput.facilitiesDatapackageCsv &&
    config.externalFacilitiesCsvUrl.startsWith('http')
  ) {
    try {
      const res = await fetch(config.externalFacilitiesCsvUrl, {
        headers: {
          'User-Agent':
            'Hasadna-DearChild-ETL/1.0 (+https://github.com/hasadna/dear_child)',
        },
      });
      if (res.ok) {
        batchInput.facilitiesDatapackageCsv = await res.text();
      }
    } catch (err) {
      console.warn(
        '[ETL] Remote facilities CSV fetch skipped or unreachable:',
        err
      );
    }
  }

  const { mergedDaycares, tlvSeedResult } = processEtlBatchInMemory(batchInput);
  console.log(
    `[ETL] Resolved ${mergedDaycares.length} canonical official daycares and ${tlvSeedResult.matchedSubmissions.length} intersecting TLV sheet price records.`
  );

  if (process.env.ETL_DRY_RUN === 'true') {
    console.log('[ETL] Dry run completed without database write.');
    return;
  }

  const pool = new pg.Pool({ connectionString: config.databaseEtlUrl });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const dictRes = await seedBaselineDictionaries(client);
    const dbRes = await upsertMergedDaycaresToDb(client, mergedDaycares);
    const seedInserted = await insertTlvSeedSubmissionsToDb(
      client,
      tlvSeedResult.matchedSubmissions
    );
    await client.query('COMMIT');

    console.log(
      `[ETL] Sync committed: ${dictRes.citiesInserted} cities, ${dbRes.upsertedDaycares} daycares, ${dbRes.upsertedSourceLinks} provenance links, ${seedInserted} TLV seed price rows.`
    );
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (
  process.argv[1] &&
  (process.argv[1].endsWith('run-sync.js') ||
    process.argv[1].endsWith('run-sync.ts'))
) {
  main().catch((err) => {
    console.error('[ETL] Sync failed:', err);
    process.exit(1);
  });
}
