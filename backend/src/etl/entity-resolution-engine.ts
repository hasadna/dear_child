import pg from 'pg';
import {
  haversineDistanceMeters,
  trigramSimilarity,
} from './csv-utils.js';
import {
  CanonicalDaycareCandidate,
  ExternalSourceProvenance,
  SanctionRecord,
} from './official-sources-parsers.js';

export interface MergedOfficialDaycare extends CanonicalDaycareCandidate {
  daycareId?: string;
  externalSources: ExternalSourceProvenance[];
}

/**
 * בדיקה האם קואורדינטה היא סנטרואיד עירוני כללי או קואורדינטת כתובת מדויקת
 */
function hasPreciseAddressCoordinates(c: CanonicalDaycareCandidate): boolean {
  return Boolean(c.streetNameHe && c.houseNumberPublic);
}

/**
 * מנוע איחוד ישויות היררכי בן 3 שכבות (3-Tier Deterministic Entity Resolution — D-38)
 * מאחד רשומות ממספר מאגרים רשמיים (חבילת המסגרות הארצית, GetMeonot, mosdot_edu, משרד העבודה, הרווחה ו-GIS ת"א 925)
 * לרשומה קנונית אחת לכל מסגרת, ללא כפילויות סיכות על המפה.
 */
export function resolveAndMergeOfficialDaycares(
  candidates: CanonicalDaycareCandidate[],
  sanctions: SanctionRecord[] = []
): MergedOfficialDaycare[] {
  const mergedList: MergedOfficialDaycare[] = [];

  // אינדקסים בזיכרון לשכבות 1 ו-2 (O(1) Lookup)
  const byMoeSymbol = new Map<string, MergedOfficialDaycare>();
  const byMolSymbol = new Map<string, MergedOfficialDaycare>();
  const byWelfareSymbol = new Map<string, MergedOfficialDaycare>();
  const byExternalFacilityId = new Map<string, MergedOfficialDaycare>();
  const byObudgetId = new Map<string, MergedOfficialDaycare>();
  const byMunicipalGisId = new Map<string, MergedOfficialDaycare>();

  const indexRecord = (rec: MergedOfficialDaycare) => {
    if (rec.moeSymbol) byMoeSymbol.set(rec.moeSymbol, rec);
    if (rec.molSymbol) byMolSymbol.set(rec.molSymbol, rec);
    if (rec.welfareSymbol) byWelfareSymbol.set(rec.welfareSymbol, rec);
    if (rec.externalFacilityId)
      byExternalFacilityId.set(rec.externalFacilityId, rec);
    if (rec.obudgetFacilityId) byObudgetId.set(rec.obudgetFacilityId, rec);
    if (rec.municipalGisId) byMunicipalGisId.set(rec.municipalGisId, rec);
  };

  for (const candidate of candidates) {
    let target: MergedOfficialDaycare | undefined;

    // שכבה 1: התאמת סמל רשמי מדויק (moe_symbol / mol_symbol / welfare_symbol)
    if (candidate.moeSymbol && byMoeSymbol.has(candidate.moeSymbol)) {
      target = byMoeSymbol.get(candidate.moeSymbol);
    } else if (candidate.molSymbol && byMolSymbol.has(candidate.molSymbol)) {
      target = byMolSymbol.get(candidate.molSymbol);
    } else if (
      candidate.welfareSymbol &&
      byWelfareSymbol.has(candidate.welfareSymbol)
    ) {
      target = byWelfareSymbol.get(candidate.welfareSymbol);
    }

    // שכבה 2: התאמת מזהה מסגרת חיצוני / מפתח התקציב / GIS עירוני
    if (!target) {
      if (
        candidate.externalFacilityId &&
        byExternalFacilityId.has(candidate.externalFacilityId)
      ) {
        target = byExternalFacilityId.get(candidate.externalFacilityId);
      } else if (
        candidate.obudgetFacilityId &&
        byObudgetId.has(candidate.obudgetFacilityId)
      ) {
        target = byObudgetId.get(candidate.obudgetFacilityId);
      } else if (
        candidate.municipalGisId &&
        byMunicipalGisId.has(candidate.municipalGisId)
      ) {
        target = byMunicipalGisId.get(candidate.municipalGisId);
      }
    }

    // שכבה 3: התאמה מרחבית-שמית באותו יישוב ומשטר רישוי (מרחק <= 50 מטר + דמיון שם >= 0.75 או כתובת זהה)
    if (!target) {
      for (const existing of mergedList) {
        if (
          existing.cityCode !== candidate.cityCode ||
          existing.licensingRegime !== candidate.licensingRegime
        ) {
          continue;
        }

        const sameStreetAndHouse =
          Boolean(existing.streetNameHe) &&
          Boolean(existing.houseNumberPublic) &&
          existing.streetNameHe === candidate.streetNameHe &&
          existing.houseNumberPublic === candidate.houseNumberPublic;

        const nameSim = trigramSimilarity(
          existing.normalizedName,
          candidate.normalizedName
        );

        const isGisPlaceholder =
          existing.primaryOfficialSource === 'tlv_gis_925' ||
          candidate.primaryOfficialSource === 'tlv_gis_925';

        if (sameStreetAndHouse && (nameSim >= 0.6 || isGisPlaceholder)) {
          target = existing;
          break;
        }

        const distMeters = haversineDistanceMeters(
          existing.lat,
          existing.lng,
          candidate.lat,
          candidate.lng
        );
        if (distMeters <= 50 && nameSim >= 0.75) {
          target = existing;
          break;
        }
      }
    }

    if (!target) {
      const created: MergedOfficialDaycare = {
        ...candidate,
        externalSources: [candidate.provenance],
      };
      mergedList.push(created);
      indexRecord(created);
    } else {
      // מיזוג שדות משלים ללא דריסת מידע איכותי בערכי NULL
      target.externalFacilityId =
        target.externalFacilityId || candidate.externalFacilityId;
      target.obudgetFacilityId =
        target.obudgetFacilityId || candidate.obudgetFacilityId;
      target.moeSymbol = target.moeSymbol || candidate.moeSymbol;
      target.molSymbol = target.molSymbol || candidate.molSymbol;
      target.welfareSymbol = target.welfareSymbol || candidate.welfareSymbol;
      target.municipalGisId =
        target.municipalGisId || candidate.municipalGisId;

      // העדפת שם ממרשם משרד החינוך / העבודה על פני שם גנרי של שכבת GIS
      if (
        target.primaryOfficialSource === 'tlv_gis_925' &&
        candidate.primaryOfficialSource !== 'tlv_gis_925'
      ) {
        target.displayName = candidate.displayName;
        target.normalizedName = candidate.normalizedName;
        target.primaryOfficialSource = candidate.primaryOfficialSource;
      }

      target.officialRegistryName =
        target.officialRegistryName || candidate.officialRegistryName;
      target.streetNameHe = target.streetNameHe || candidate.streetNameHe;
      target.houseNumberPublic =
        target.houseNumberPublic || candidate.houseNumberPublic;

      if (
        !hasPreciseAddressCoordinates(target) &&
        hasPreciseAddressCoordinates(candidate)
      ) {
        target.fullAddressPublic = candidate.fullAddressPublic;
      }

      if (
        candidate.primaryOfficialSource === 'tlv_gis_925' ||
        candidate.primaryOfficialSource === 'facilities_datapackage'
      ) {
        target.lat = candidate.lat;
        target.lng = candidate.lng;
      }

      target.operatorCorpId = target.operatorCorpId || candidate.operatorCorpId;
      if (
        (!target.operatorEntityName ||
          target.operatorEntityName === 'עוסק יחיד') &&
        candidate.operatorEntityName
      ) {
        target.operatorEntityName = candidate.operatorEntityName;
      }

      target.officialPhonePublic =
        target.officialPhonePublic || candidate.officialPhonePublic;
      target.officialCapacity =
        target.officialCapacity || candidate.officialCapacity;

      if (candidate.hasActiveStopOrder) {
        target.hasActiveStopOrder = true;
        target.licenseStatus = 'stop_order_active';
      } else if (target.licenseStatus !== 'stop_order_active') {
        if (
          candidate.licenseStatus === 'symbol_recognized' ||
          candidate.isSubsidizedSymbol
        ) {
          target.licenseStatus = 'symbol_recognized';
        } else if (
          candidate.licenseStatus === 'active_license' &&
          target.licenseStatus === 'municipal_verified'
        ) {
          target.licenseStatus = 'active_license';
        } else if (
          candidate.licenseStatus === 'in_licensing_process' &&
          target.licenseStatus === 'municipal_verified'
        ) {
          target.licenseStatus = 'in_licensing_process';
        }
      }

      if (candidate.isSubsidizedSymbol) {
        target.isSubsidizedSymbol = true;
        target.primaryTrack = 'symbol_regulated';
      }

      const alreadyTracked = target.externalSources.some(
        (s) =>
          s.sourceSystem === candidate.provenance.sourceSystem &&
          s.externalRecordId === candidate.provenance.externalRecordId
      );
      if (!alreadyTracked) {
        target.externalSources.push(candidate.provenance);
      }

      indexRecord(target);
    }
  }

  // הצלבת עיצומים כספיים רשמיים מ-mirsham.xlsx
  for (const sanction of sanctions) {
    for (const daycare of mergedList) {
      const nameSim = trigramSimilarity(
        daycare.normalizedName,
        sanction.normalizedName
      );
      const addressMatchesCity = sanction.rawAddress.includes(
        daycare.cityNameHe.split(' ')[0]
      );
      if (nameSim >= 0.8 && addressMatchesCity) {
        daycare.hasOfficialSanction = true;
        daycare.officialSanctionDate = sanction.sanctionDate;
        daycare.officialSanctionText = sanction.sanctionText;
        daycare.externalSources.push({
          sourceSystem: 'moe_mirsham_sanctions',
          externalRecordId: `${sanction.normalizedName}-${sanction.sanctionDate || 'tashpaz'}`,
          sourceLicense: 'data.gov.il',
          rawStatusText: sanction.sanctionText,
        });
      }
    }
  }

  return mergedList;
}

/**
 * שמירה ועדכון (Upsert) של המסגרות המאוחדות ב-PostgreSQL ללא מחיקה פיזית לעולם (D-38: Soft-Status + ON DELETE RESTRICT)
 */
export async function upsertMergedDaycaresToDb(
  client: pg.PoolClient,
  daycares: MergedOfficialDaycare[]
): Promise<{ upsertedDaycares: number; upsertedSourceLinks: number }> {
  let upsertedDaycares = 0;
  let upsertedSourceLinks = 0;

  for (const d of daycares) {
    // חיפוש רשומה קיימת לפי סמלים רשמיים או מזהה חיצוני כדי לא ליצור כפילות ולא לאבד UUID קיים שיש עליו דיווחים
    const existingRes = await client.query<{ daycare_id: string }>(
      `
      SELECT daycare_id
      FROM public.daycares
      WHERE (moe_symbol IS NOT NULL AND moe_symbol = $1)
         OR (mol_symbol IS NOT NULL AND mol_symbol = $2)
         OR (external_facility_id IS NOT NULL AND external_facility_id = $3)
         OR (municipal_gis_id IS NOT NULL AND municipal_gis_id = $4)
      LIMIT 1
      `,
      [
        d.moeSymbol || null,
        d.molSymbol || null,
        d.externalFacilityId || null,
        d.municipalGisId || null,
      ]
    );

    let daycareId: string;

    if (existingRes.rows.length > 0) {
      daycareId = existingRes.rows[0].daycare_id;
      await client.query(
        `
        UPDATE public.daycares SET
          external_facility_id = COALESCE($2, external_facility_id),
          obudget_facility_id = COALESCE($3, obudget_facility_id),
          moe_symbol = COALESCE($4, moe_symbol),
          mol_symbol = COALESCE($5, mol_symbol),
          welfare_symbol = COALESCE($6, welfare_symbol),
          municipal_gis_id = COALESCE($7, municipal_gis_id),
          display_name = $8,
          official_registry_name = COALESCE($9, official_registry_name),
          normalized_name = $10,
          age_groups_supported = $11::public.age_group_enum[],
          primary_track = $12::public.framework_track_enum,
          licensing_regime = $13::public.licensing_regime_enum,
          city_code = $14,
          city_name_he = $15,
          street_name_he = COALESCE($16, street_name_he),
          house_number_public = COALESCE($17, house_number_public),
          full_address_public = $18,
          geom = ST_SetSRID(ST_MakePoint($19, $20), 4326),
          operator_entity_name = COALESCE($21, operator_entity_name),
          operator_corp_id = COALESCE($22, operator_corp_id),
          official_phone_public = COALESCE($23, official_phone_public),
          official_capacity = COALESCE($24, official_capacity),
          license_status = $25::public.license_status_enum,
          is_active_in_registry = TRUE,
          is_subsidized_symbol = $26,
          has_active_stop_order = $27,
          has_official_sanction = $28,
          official_sanction_date = COALESCE($29::DATE, official_sanction_date),
          official_sanction_text = COALESCE($30, official_sanction_text),
          official_last_checked_at = CURRENT_DATE,
          updated_at = CURRENT_DATE
        WHERE daycare_id = $1
        `,
        [
          daycareId,
          d.externalFacilityId || null,
          d.obudgetFacilityId || null,
          d.moeSymbol || null,
          d.molSymbol || null,
          d.welfareSymbol || null,
          d.municipalGisId || null,
          d.displayName,
          d.officialRegistryName || null,
          d.normalizedName,
          d.ageGroupsSupported,
          d.primaryTrack,
          d.licensingRegime,
          d.cityCode,
          d.cityNameHe,
          d.streetNameHe || null,
          d.houseNumberPublic || null,
          d.fullAddressPublic,
          d.lng,
          d.lat,
          d.operatorEntityName || null,
          d.operatorCorpId || null,
          d.officialPhonePublic || null,
          d.officialCapacity || null,
          d.licenseStatus,
          d.isSubsidizedSymbol,
          d.hasActiveStopOrder,
          d.hasOfficialSanction,
          d.officialSanctionDate || null,
          d.officialSanctionText || null,
        ]
      );
    } else {
      const insertRes = await client.query<{ daycare_id: string }>(
        `
        INSERT INTO public.daycares (
          external_facility_id, obudget_facility_id, moe_symbol, mol_symbol,
          welfare_symbol, municipal_gis_id, display_name, official_registry_name,
          normalized_name, age_groups_supported, primary_track, licensing_regime,
          city_code, city_name_he, street_name_he, house_number_public,
          full_address_public, geom, operator_entity_name, operator_corp_id,
          official_phone_public, official_capacity, license_status,
          is_official_source, is_active_in_registry, is_subsidized_symbol,
          has_active_stop_order, has_official_sanction, official_sanction_date,
          official_sanction_text, primary_official_source
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8,
          $9, $10::public.age_group_enum[], $11::public.framework_track_enum, $12::public.licensing_regime_enum,
          $13, $14, $15, $16,
          $17, ST_SetSRID(ST_MakePoint($18, $19), 4326), $20, $21,
          $22, $23, $24::public.license_status_enum,
          TRUE, TRUE, $25,
          $26, $27, $28::DATE,
          $29, $30
        ) RETURNING daycare_id
        `,
        [
          d.externalFacilityId || null,
          d.obudgetFacilityId || null,
          d.moeSymbol || null,
          d.molSymbol || null,
          d.welfareSymbol || null,
          d.municipalGisId || null,
          d.displayName,
          d.officialRegistryName || null,
          d.normalizedName,
          d.ageGroupsSupported,
          d.primaryTrack,
          d.licensingRegime,
          d.cityCode,
          d.cityNameHe,
          d.streetNameHe || null,
          d.houseNumberPublic || null,
          d.fullAddressPublic,
          d.lng,
          d.lat,
          d.operatorEntityName || null,
          d.operatorCorpId || null,
          d.officialPhonePublic || null,
          d.officialCapacity || null,
          d.licenseStatus,
          d.isSubsidizedSymbol,
          d.hasActiveStopOrder,
          d.hasOfficialSanction,
          d.officialSanctionDate || null,
          d.officialSanctionText || null,
          d.primaryOfficialSource,
        ]
      );
      daycareId = insertRes.rows[0].daycare_id;
    }

    d.daycareId = daycareId;
    upsertedDaycares++;

    for (const src of d.externalSources) {
      await client.query(
        `
        INSERT INTO public.daycare_external_sources (
          daycare_id, source_system, external_record_id, source_license, raw_status_text, last_synced_at
        ) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE)
        ON CONFLICT (source_system, external_record_id) DO UPDATE SET
          daycare_id = EXCLUDED.daycare_id,
          raw_status_text = COALESCE(EXCLUDED.raw_status_text, public.daycare_external_sources.raw_status_text),
          last_synced_at = CURRENT_DATE
        `,
        [
          daycareId,
          src.sourceSystem,
          src.externalRecordId,
          src.sourceLicense,
          src.rawStatusText || null,
        ]
      );
      upsertedSourceLinks++;
    }
  }

  return { upsertedDaycares, upsertedSourceLinks };
}
