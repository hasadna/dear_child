import pg from 'pg';
import { loadConfig } from '../config/env.js';

/**
 * כלי CLI מוגן לניהול פניות "מצאתם טעות?" ב-MVP1 (npm run admin:corrections — D-38)
 * מיועד ל-3-5 מורשי הגישה בלבד (תקנות אבטחת מידע — רמה בסיסית), ללא חשיפת פאנל Admin וובי ציבורי.
 *
 * פקודות נתמכות:
 *   npm run admin:corrections -- list [pending|resolved|rejected]
 *   npm run admin:corrections -- resolve <request_id> [--hide-submission <submission_id>]
 *   npm run admin:corrections -- reject <request_id>
 */
export async function executeCorrectionsCliCommand(
  args: string[],
  client: {
    query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }>;
  }
): Promise<string> {
  const action = args[0] || 'list';

  if (action === 'list') {
    const statusFilter = args[1] || 'pending';
    const res = await client.query(
      `
      SELECT
        cr.request_id,
        cr.daycare_id,
        d.display_name,
        d.city_name_he,
        cr.issue_category,
        cr.structured_details,
        cr.status,
        cr.reported_month
      FROM app_private.correction_requests cr
      LEFT JOIN public.daycares d ON d.daycare_id = cr.daycare_id
      WHERE cr.status = $1
      ORDER BY cr.reported_month DESC
      `,
      [statusFilter]
    );
    return JSON.stringify(
      { action: 'list', status: statusFilter, count: res.rows.length, items: res.rows },
      null,
      2
    );
  }

  if (action === 'resolve' || action === 'reject') {
    const requestId = args[1];
    if (!requestId) {
      throw new Error('Missing <request_id> argument');
    }
    const newStatus = action === 'resolve' ? 'resolved' : 'rejected';

    const hideFlagIdx = args.indexOf('--hide-submission');
    const hideSubmissionId =
      hideFlagIdx >= 0 && args[hideFlagIdx + 1]
        ? args[hideFlagIdx + 1]
        : undefined;

    if (hideSubmissionId && newStatus === 'resolved') {
      await client.query(
        `
        UPDATE app_private.survey_submissions
        SET is_flagged_hidden = TRUE
        WHERE submission_id = $1::UUID
        `,
        [hideSubmissionId]
      );
    }

    const updateRes = await client.query(
      `
      UPDATE app_private.correction_requests
      SET status = $2
      WHERE request_id = $1::UUID
      `,
      [requestId, newStatus]
    );

    return JSON.stringify(
      {
        action,
        request_id: requestId,
        new_status: newStatus,
        hidden_submission_id: hideSubmissionId || null,
        updated: (updateRes.rowCount || 0) > 0,
      },
      null,
      2
    );
  }

  throw new Error(`Unknown CLI action: ${action}`);
}

if (
  process.argv[1] &&
  (process.argv[1].endsWith('manage-corrections.js') ||
    process.argv[1].endsWith('manage-corrections.ts'))
) {
  const config = loadConfig();
  const pool = new pg.Pool({ connectionString: config.databaseEtlUrl });
  pool
    .connect()
    .then(async (client) => {
      try {
        const output = await executeCorrectionsCliCommand(
          process.argv.slice(2),
          client
        );
        console.log(output);
      } finally {
        client.release();
        await pool.end();
      }
    })
    .catch((err) => {
      console.error('[CLI Admin Corrections] Error:', err);
      process.exit(1);
    });
}
