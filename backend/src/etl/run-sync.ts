import { loadConfig } from '../config/env.js';

/**
 * נקודת כניסה למשימת ה-K8s CronJob של צינור הנתונים (npm run etl:sync — D-38).
 * תורחב בחלק 4.3 למשיכה מלאה ממאגרי המסגרות הרשמיים, משרד החינוך, העבודה, GIS ת"א ופיילוט גיליון ת"א.
 */
async function main() {
  const config = loadConfig();
  console.log(
    `[ETL] Starting Dear Child ETL sync for school year ${config.activeSchoolYear}...`
  );
  console.log(`[ETL] Facilities source: ${config.externalFacilitiesCsvUrl}`);
}

main().catch((err) => {
  console.error('[ETL] Sync failed:', err);
  process.exit(1);
});
