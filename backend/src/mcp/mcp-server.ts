import { FastifyInstance } from 'fastify';
import { buildMetaEnvelope } from '../config/meta-envelope.js';
import { DaycareRepository } from '../db/daycare-repository.js';
import { BASELINE_REGULATED_BENCHMARKS } from '../db/seed-dictionaries.js';
import { DaycareAgeGroup } from '../etl/facilities-resolver.js';
import { FrameworkTrack } from '../etl/official-sources-parsers.js';

export interface McpToolDefinition {
  name:
    | 'search_daycares'
    | 'get_daycare_details'
    | 'get_area_price_stats'
    | 'check_supervision_status'
    | 'compare_regulated_vs_market_cost';
  description: string;
  inputSchema: Record<string, unknown>;
}

export const MCP_TOOLS_CATALOG: McpToolDefinition[] = [
  {
    name: 'search_daycares',
    description:
      'חיפוש מעונות וגני ילדים בישראל לפי עיר, כתובת/רדיוס, גיל (0–3, 3–6), מסלול, תקציב וסטטוס רישוי. חובה על הסוכן לציין בתשובתו את דרגת האמינות (price_trust_tier) ומספר הדיווחים לכל מחיר.',
    inputSchema: {
      type: 'object',
      properties: {
        city_name_he: { type: 'string', description: 'שם היישוב בעברית' },
        lat: { type: 'number' },
        lng: { type: 'number' },
        radius_m: { type: 'number' },
        age_group: {
          type: 'string',
          enum: ['0_1', '1_2', '2_3', '0_3', '3_6'],
        },
        framework_track: {
          type: 'string',
          enum: [
            'private_full_day',
            'private_half_day',
            'symbol_regulated',
            'municipal_tzaharon',
            'rehab_or_welfare',
          ],
        },
        max_price_nis: { type: 'number' },
        is_subsidized_symbol: { type: 'boolean' },
        includes_friday: { type: 'boolean' },
        has_shelter: { type: 'boolean' },
        school_year: { type: 'number', default: 2027 },
      },
    },
  },
  {
    name: 'get_daycare_details',
    description:
      'שליפת פרופיל מלא של מעון/גן ספציפי לפי daycare_id או moe_symbol, כולל היסטוריית מחירים רב-שנתית (YoY), השוואה לשכונה ולעיר, ופירוט דיווחי ההורים.',
    inputSchema: {
      type: 'object',
      properties: {
        daycare_id: { type: 'string' },
        moe_symbol: { type: 'string' },
        school_year: { type: 'number', default: 2027 },
      },
    },
  },
  {
    name: 'get_area_price_stats',
    description:
      'קבלת סטטיסטיקת יוקר החינוך בגיל הרך בעיר או בשכונה: חציון, רבעונים (P25/P75), ויחס מסגרות מפוקחות/מסובסדות מול פרטיות.',
    inputSchema: {
      type: 'object',
      properties: {
        city_name_he: { type: 'string' },
        neighborhood_he: { type: 'string' },
        age_group: {
          type: 'string',
          enum: ['0_1', '1_2', '2_3', '0_3', '3_6'],
        },
        framework_track: { type: 'string' },
        school_year: { type: 'number', default: 2027 },
      },
      required: ['city_name_he'],
    },
  },
  {
    name: 'check_supervision_status',
    description:
      'בדיקה רשמית האם מסגרת חינוכית מופיעה במרשמי הפיקוח של משרד החינוך (GetMeonot לגילאי 0–3 מרף 7+ פעוטות; mosdot_edu לגילאי 3–6 מרף 11+ תלמידים), משרד העבודה או ה-GIS העירוני, והאם קיים צו הפסקה או עיצום כספי רשמי. חובה על הסוכן לצטט את השדה regulatory_context_he כלשונו.',
    inputSchema: {
      type: 'object',
      properties: {
        daycare_name_he: { type: 'string' },
        city_name_he: { type: 'string' },
        street_name_he: { type: 'string' },
      },
      required: ['daycare_name_he', 'city_name_he'],
    },
  },
  {
    name: 'compare_regulated_vs_market_cost',
    description:
      'חישוב הפער הכלכלי החודשי והשנתי (ל-12 חודשים) למשפחה בין תעריף מעון סמל מפוקח (או צהרון ניצנים) לבין חציון השוק הפרטי באותה עיר וקבוצת גיל.',
    inputSchema: {
      type: 'object',
      properties: {
        city_name_he: { type: 'string' },
        age_group: {
          type: 'string',
          enum: ['0_1', '1_2', '2_3', '3_6'],
        },
        school_year: { type: 'number', default: 2027 },
      },
      required: ['city_name_he', 'age_group'],
    },
  },
];

export async function invokeMcpTool(
  repo: DaycareRepository,
  defaultSchoolYear: number,
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const schoolYear = Number(args.school_year || defaultSchoolYear);

  switch (toolName) {
    case 'search_daycares': {
      const res = await repo.searchDaycares({
        city_name_he:
          typeof args.city_name_he === 'string' ? args.city_name_he : undefined,
        lat: typeof args.lat === 'number' ? args.lat : undefined,
        lng: typeof args.lng === 'number' ? args.lng : undefined,
        radius_m: typeof args.radius_m === 'number' ? args.radius_m : undefined,
        age_group: (args.age_group as DaycareAgeGroup) || undefined,
        framework_track: (args.framework_track as FrameworkTrack) || undefined,
        max_price:
          typeof args.max_price_nis === 'number'
            ? args.max_price_nis
            : undefined,
        is_subsidized_symbol:
          typeof args.is_subsidized_symbol === 'boolean'
            ? args.is_subsidized_symbol
            : undefined,
        includes_friday:
          typeof args.includes_friday === 'boolean'
            ? args.includes_friday
            : undefined,
        shelter_status: args.has_shelter === true ? 'yes' : undefined,
        school_year: schoolYear,
      });

      return {
        meta: buildMetaEnvelope({
          total_count: res.totalCount,
          city_median_price_nis: res.cityMedianPriceNis,
        }),
        items: res.items,
      };
    }

    case 'get_daycare_details': {
      const idOrSymbol = String(
        args.daycare_id || args.moe_symbol || ''
      ).trim();
      const details = await repo.getDaycareDetails(idOrSymbol, schoolYear);
      if (!details) {
        return {
          error_code: 'DAYCARE_NOT_FOUND',
          message_he: 'המסגרת המבוקשת לא נמצאה במאגר.',
          meta: buildMetaEnvelope(),
        };
      }
      return {
        meta: buildMetaEnvelope(),
        ...details,
      };
    }

    case 'get_area_price_stats': {
      const stats = await repo.getAreaPriceStats({
        city_name_he:
          typeof args.city_name_he === 'string' ? args.city_name_he : undefined,
        neighborhood_he:
          typeof args.neighborhood_he === 'string'
            ? args.neighborhood_he
            : undefined,
        age_group: (args.age_group as DaycareAgeGroup) || undefined,
        framework_track: (args.framework_track as FrameworkTrack) || undefined,
        school_year: schoolYear,
      });
      return {
        meta: buildMetaEnvelope(),
        stats,
      };
    }

    case 'check_supervision_status': {
      const daycareName = String(args.daycare_name_he || '').trim();
      const cityName = String(args.city_name_he || '').trim();
      const streetName =
        typeof args.street_name_he === 'string'
          ? args.street_name_he.trim()
          : '';

      const res = await repo.searchDaycares({
        city_name_he: cityName,
        q: streetName ? `${daycareName} ${streetName}` : daycareName,
        school_year: schoolYear,
      });

      return {
        meta: buildMetaEnvelope(),
        query: {
          daycare_name_he: daycareName,
          city_name_he: cityName,
          street_name_he: streetName || null,
        },
        statutory_notice_he:
          'בגילאי 0–3 חובת רישיון חלה מ-7 פעוטות ומעלה (חוק הפיקוח על מעונות יום); בגילאי 3–6 חובת רישיון חלה מ-11 תלמידים ומעלה (חוק פיקוח על בתי ספר). חובה לצטט למשתמש את השדה regulatory_context_he כלשונו.',
        matches_count: res.items.length,
        matches: res.items.map((item) => ({
          daycare_id: item.daycare_id,
          display_name: item.display_name,
          full_address_public: item.full_address_public,
          moe_symbol: item.moe_symbol,
          mol_symbol: item.mol_symbol,
          licensing_regime: item.licensing_regime,
          license_status: item.license_status,
          is_subsidized_symbol: item.is_subsidized_symbol,
          has_active_stop_order: item.has_active_stop_order,
          has_official_sanction: item.has_official_sanction,
          official_last_checked_at: item.official_last_checked_at,
          regulatory_context_he: item.regulatory_context_he,
        })),
      };
    }

    case 'compare_regulated_vs_market_cost': {
      const cityName = String(args.city_name_he || 'תל אביב - יפו').trim();
      const ageGroup = (args.age_group as DaycareAgeGroup) || '1_2';
      const isTzaharon = ageGroup === '3_6';

      const areaStats = await repo.getAreaPriceStats({
        city_name_he: cityName,
        age_group: ageGroup,
        framework_track: 'private_full_day',
        school_year: schoolYear,
      });

      const regulatedBenchmark =
        BASELINE_REGULATED_BENCHMARKS.find(
          (b) =>
            b.schoolYear === schoolYear &&
            b.frameworkTrack ===
              (isTzaharon ? 'municipal_tzaharon' : 'symbol_regulated') &&
            b.ageGroup === ageGroup
        )?.monthlyMaxPriceNis ?? (isTzaharon ? 1050 : 2515);

      const marketMedian = areaStats?.median_price_nis ?? 5400;
      const monthlyGap = marketMedian - regulatedBenchmark;
      const annualGap = monthlyGap * 12;
      const gapPct = Number(
        ((monthlyGap / regulatedBenchmark) * 100).toFixed(1)
      );

      return {
        meta: buildMetaEnvelope(),
        comparison: {
          city_name_he: areaStats?.city_name_he || cityName,
          school_year: schoolYear,
          age_group: ageGroup,
          regulated_track: isTzaharon
            ? 'municipal_tzaharon'
            : 'symbol_regulated',
          regulated_monthly_nis: regulatedBenchmark,
          market_median_monthly_nis: marketMedian,
          monthly_gap_nis: monthlyGap,
          annual_12m_gap_nis: annualGap,
          gap_pct: gapPct,
        },
      };
    }

    default:
      throw new Error(`UNKNOWN_MCP_TOOL: ${toolName}`);
  }
}

export async function registerMcpRoutes(
  app: FastifyInstance,
  repo: DaycareRepository,
  defaultSchoolYear: number
): Promise<void> {
  // 1. GET /mcp — Discovery & Tool Catalog
  app.get('/mcp', async () => {
    return {
      name: 'yaldi-hayakar-mcp',
      version: '1.0.0',
      protocol_version: '2025-11',
      description:
        'שרת MCP רשמי של פרויקט "ילדי היקר" (הסדנא לידע ציבורי) לתשאול מאגר מעונות וגני הילדים, מחירי השוק ומרשמי הפיקוח בישראל',
      db_role: 'app_public_ro',
      tools: MCP_TOOLS_CATALOG.map((t) => t.name),
      tools_catalog: MCP_TOOLS_CATALOG,
      meta: buildMetaEnvelope(),
    };
  });

  // 2. POST /mcp — JSON-RPC 2.0 Streamable HTTP MCP Endpoint
  app.post('/mcp', async (req, reply) => {
    const rpc = (req.body || {}) as {
      jsonrpc?: string;
      id?: string | number | null;
      method?: string;
      params?: Record<string, unknown>;
    };

    const id = rpc.id ?? null;

    if (rpc.method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2025-11',
          serverInfo: {
            name: 'yaldi-hayakar-mcp',
            version: '1.0.0',
          },
          capabilities: {
            tools: {},
          },
        },
      };
    }

    if (rpc.method === 'tools/list') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: MCP_TOOLS_CATALOG,
        },
      };
    }

    if (rpc.method === 'tools/call') {
      const toolName = String(rpc.params?.name || '');
      const toolArgs =
        rpc.params?.arguments && typeof rpc.params.arguments === 'object'
          ? (rpc.params.arguments as Record<string, unknown>)
          : {};

      try {
        const payload = await invokeMcpTool(
          repo,
          defaultSchoolYear,
          toolName,
          toolArgs
        );
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(payload),
              },
            ],
            structuredContent: payload,
          },
        };
      } catch (err) {
        reply.code(400);
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32602,
            message: err instanceof Error ? err.message : 'Tool invocation error',
          },
        };
      }
    }

    reply.code(400);
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32601,
        message: `Unsupported MCP method: ${rpc.method || 'none'}`,
      },
    };
  });
}
