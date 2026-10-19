import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { db } from '../db/schema.js';

export type IngestionEntityType = 'materials' | 'processes' | 'energy_factors' | 'vehicles' | 'logistics_factors' | 'sources';

export interface ValidatedIngestionRow {
  row_number: number;
  status: 'valid' | 'duplicate' | 'flagged_for_review' | 'error';
  messages: string[];
  record: Record<string, any>;
}

export interface IngestionPreviewResult {
  entity_type: IngestionEntityType;
  total_rows: number;
  valid_count: number;
  duplicate_count: number;
  flagged_count: number;
  error_count: number;
  rows: ValidatedIngestionRow[];
}

export const CSV_TEMPLATES: Record<IngestionEntityType, string> = {
  materials: `material_id,name,category,grade_or_type,production_route,primary_or_recycled,recycled_content_pct,factor_value,factor_min,factor_max,unit,geography,reference_year,system_boundary,uncertainty_or_range,source_id,data_quality_status,notes_and_limitations
MAT-STEEL-INDIA-BF,Primary Hot-Rolled Automotive Steel (India BF-BOF),Ferrous Metals,IS 2062 / Auto Grade,Integrated Blast Furnace - Basic Oxygen Furnace,Primary,0,2.45,2.2,2.7,kg CO2e/kg,India,2024,Cradle-to-Gate,±10% plant variation,SRC-CEEW-AUTO,Peer-Reviewed Published,India BF-BOF route steel emission factor imported via CSV pipeline`,

  processes: `process_id,process_name,process_category,applicability,energy_consumption_mj,process_emissions_kgco2e,reference_unit,energy_source,geography,reference_year,system_boundary,source_id,data_quality_status,is_allocated_facility_service,limitations
PROC-INJ-MOULD-PP,Polymer Injection Moulding (Polypropylene),Polymer Processing,Automotive bumpers and interior trim (PP),11.8,0.82,kg polymer moulded,Grid Electricity,India,2024,Gate-to-Gate Process,SRC-UMICH-GREET-2012,Extracted from Referenced Dataset,0,Process-specific injection moulding inventory resolving Table 4 data gap`,

  energy_factors: `energy_id,carrier,pathway,factor_value,factor_min,factor_max,unit,geography,reference_year,lifecycle_boundary,factor_type_details,source_id,data_quality_status,critical_caveat
NRG-GRID-CEA-FY23-24,Grid electricity (India),Indian National Grid Weighted Average (CEA Baseline v19),0.716,0.710,0.725,kg CO2/kWh,India,FY 2023-24,Generation Grid Mix,CEA CO2 Baseline Database v19 Weighted Average Emission Factor,SRC-CEA-INDIA,Officially Reported (CEA India),Excludes T&D losses; add T&D loss factor for wall-to-wheel BEV charging`,

  vehicles: `vehicle_id,manufacturer,model,variant,model_year,powertrain,body_type,kerb_mass_kg,glider_reference_mass_kg,fuel_consumption_value,fuel_consumption_unit,electricity_consumption_kwh_per_km,electric_utility_factor,battery_capacity_kwh,battery_chemistry,range_km,test_cycle,material_coverage_notes,public_data_to_collect,manufacturing_emissions_approach,source_id,source_url,lca_data_status
VEH-IND-BEV-COMPACT,Indian Retail EV Example,Compact SUV EV,30 kWh LFP Standard Range,2025,Battery Electric (BEV),Compact SUV,1260,1137,,,0.135,1.0,30.2,LFP (Lithium Iron Phosphate),312,ARAI / MIDC,Uses EU SWD(2023) 256 BEV glider proxy + 30.2 kWh LFP pack,Official brochure kWh and ARAI range disclosed; BOM is proxy,Glider BOM + LFP pack per kWh factor,SRC-PACK-2026,https://cea.nic.in/,Published Specs + Proxy BOM`,

  logistics_factors: `mode_id,transport_mode,vehicle_or_ship_class,fuel_or_traction,distance_km,freight_mass_tonnes,load_factor_pct,empty_running_notes,factor_kgco2e_per_tonne_km,factor_min,factor_max,unit,geography,reference_year,system_boundary,source_id,data_quality_status,notes
LOG-ROAD-HDV-BS6,Road freight,BS-VI Heavy Duty Truck (28T GVW),Diesel,500,18,75,20% empty return included,0.068,0.058,0.078,kg CO2e/tonne-km,India,2024,Well-to-Wheel Freight Transport,SRC-PACK-2026,Engineering Estimate / Proxy,Imported via CSV pipeline for Indian road freight`,

  sources: `source_id,title,publisher,publication_year,url,accessed_on,page_table,geography,dataset_version,licence_access_notes,extraction_status,notes
SRC-CEA-V19-2024,CO2 Baseline Database for the Indian Power Sector User Guide Version 19.0,Central Electricity Authority (CEA) Ministry of Power,2024,https://cea.nic.in/cdm-co2-baseline-database/?lang=en,2026-10-18,Table S-1 Weighted Average,India,v19.0 (FY 2022-23 / 2023-24),Public Government of India Data,Imported via CSV Pipeline,Official Indian grid emission factor reference`
};

export function validateAndPreviewCsv(entityType: IngestionEntityType, csvText: string): IngestionPreviewResult {
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as Record<string, any>[];

  const sourceIds = new Set(
    (db.prepare(`SELECT source_id FROM sources`).all() as any[]).map(s => s.source_id)
  );

  const validatedRows: ValidatedIngestionRow[] = [];
  let validCount = 0;
  let duplicateCount = 0;
  let flaggedCount = 0;
  let errorCount = 0;

  records.forEach((raw, idx) => {
    const rowNum = idx + 1;
    const messages: string[] = [];
    let status: ValidatedIngestionRow['status'] = 'valid';

    // Check source_id foreign key if entity is not sources
    if (entityType !== 'sources') {
      if (!raw.source_id || !raw.source_id.trim()) {
        status = 'error';
        messages.push('Missing required source_id (No orphan values allowed — Section 11).');
      } else if (!sourceIds.has(raw.source_id.trim())) {
        status = 'flagged_for_review';
        messages.push(`source_id "${raw.source_id}" does not exist yet; will auto-register placeholder or require source import first.`);
      }
    }

    if (entityType === 'materials') {
      if (!raw.material_id || !raw.name || !raw.unit || !raw.system_boundary) {
        status = 'error';
        messages.push('Missing required fields: material_id, name, unit, or system_boundary.');
      }
      const existing = db.prepare(`SELECT material_id FROM materials WHERE material_id = ?`).get(raw.material_id);
      if (existing && status !== 'error') {
        status = 'duplicate';
        messages.push(`material_id "${raw.material_id}" already exists in database (will update if approved).`);
      }
      const fVal = raw.factor_value !== '' && raw.factor_value !== undefined ? Number(raw.factor_value) : null;
      const fMin = raw.factor_min !== '' && raw.factor_min !== undefined ? Number(raw.factor_min) : null;
      const fMax = raw.factor_max !== '' && raw.factor_max !== undefined ? Number(raw.factor_max) : null;
      if (fVal === null && (fMin === null || fMax === null) && status === 'valid') {
        status = 'flagged_for_review';
        messages.push('Both factor_value and factor_min/factor_max are empty; flagged for human review.');
      }
    } else if (entityType === 'processes') {
      if (!raw.process_id || !raw.process_name || !raw.reference_unit) {
        status = 'error';
        messages.push('Missing required fields: process_id, process_name, or reference_unit.');
      }
      const existing = db.prepare(`SELECT process_id FROM processes WHERE process_id = ?`).get(raw.process_id);
      if (existing && status !== 'error') {
        status = 'duplicate';
        messages.push(`process_id "${raw.process_id}" already exists.`);
      }
      const emVal = raw.process_emissions_kgco2e !== '' ? Number(raw.process_emissions_kgco2e) : null;
      if (emVal !== null && emVal > 20 && Number(raw.is_allocated_facility_service) !== 1 && status === 'valid') {
        status = 'flagged_for_review';
        messages.push(`High process emission factor (${emVal} kg CO2/unit) detected; verify whether this is an allocated facility service (Section 4).`);
      }
    } else if (entityType === 'energy_factors') {
      if (!raw.energy_id || !raw.carrier || !raw.unit || !raw.lifecycle_boundary) {
        status = 'error';
        messages.push('Missing required fields: energy_id, carrier, unit, or lifecycle_boundary.');
      }
      const existing = db.prepare(`SELECT energy_id FROM energy_factors WHERE energy_id = ?`).get(raw.energy_id);
      if (existing && status !== 'error') {
        status = 'duplicate';
        messages.push(`energy_id "${raw.energy_id}" already exists.`);
      }
    } else if (entityType === 'vehicles') {
      if (!raw.vehicle_id || !raw.manufacturer || !raw.model || !raw.powertrain) {
        status = 'error';
        messages.push('Missing required fields: vehicle_id, manufacturer, model, or powertrain.');
      }
      const existing = db.prepare(`SELECT vehicle_id FROM vehicles WHERE vehicle_id = ?`).get(raw.vehicle_id);
      if (existing && status !== 'error') {
        status = 'duplicate';
        messages.push(`vehicle_id "${raw.vehicle_id}" already exists.`);
      }
    } else if (entityType === 'logistics_factors') {
      if (!raw.mode_id || !raw.transport_mode || !raw.unit) {
        status = 'error';
        messages.push('Missing required fields: mode_id, transport_mode, or unit.');
      }
      const existing = db.prepare(`SELECT mode_id FROM logistics_factors WHERE mode_id = ?`).get(raw.mode_id);
      if (existing && status !== 'error') {
        status = 'duplicate';
        messages.push(`mode_id "${raw.mode_id}" already exists.`);
      }
    } else if (entityType === 'sources') {
      if (!raw.source_id || !raw.title || !raw.publisher) {
        status = 'error';
        messages.push('Missing required fields: source_id, title, or publisher.');
      }
      const existing = db.prepare(`SELECT source_id FROM sources WHERE source_id = ?`).get(raw.source_id);
      if (existing && status !== 'error') {
        status = 'duplicate';
        messages.push(`source_id "${raw.source_id}" already exists.`);
      }
    }

    if (messages.length === 0) {
      messages.push('Passed schema, unit, and provenance validation.');
    }

    if (status === 'valid') validCount++;
    else if (status === 'duplicate') duplicateCount++;
    else if (status === 'flagged_for_review') flaggedCount++;
    else errorCount++;

    validatedRows.push({
      row_number: rowNum,
      status,
      messages,
      record: raw
    });
  });

  return {
    entity_type: entityType,
    total_rows: records.length,
    valid_count: validCount,
    duplicate_count: duplicateCount,
    flagged_count: flaggedCount,
    error_count: errorCount,
    rows: validatedRows
  };
}

export function commitValidatedRows(
  entityType: IngestionEntityType,
  rowsToImport: Record<string, any>[],
  sourceFileName = 'User_CSV_Upload.csv'
) {
  let importedCount = 0;
  let skippedCount = 0;

  const ensureSourceExists = (sourceId: string) => {
    const found = db.prepare(`SELECT source_id FROM sources WHERE source_id = ?`).get(sourceId);
    if (!found) {
      db.prepare(`
        INSERT INTO sources (source_id, title, publisher, publication_year, url, geography, extraction_status, notes)
        VALUES (?, ?, 'User Imported Source', 2026, '', 'India / User Specified', 'Imported via CSV Pipeline', 'Auto-registered during CSV import')
      `).run(sourceId, `External Source (${sourceId})`);
    }
  };

  const numOrNull = (v: any) => (v !== undefined && v !== null && String(v).trim() !== '' ? Number(v) : null);

  const tx = db.transaction(() => {
    for (const r of rowsToImport) {
      if (entityType !== 'sources' && r.source_id) {
        ensureSourceExists(r.source_id);
      }

      if (entityType === 'materials') {
        db.prepare(`
          INSERT OR REPLACE INTO materials (
            material_id, name, category, grade_or_type, production_route, primary_or_recycled,
            recycled_content_pct, factor_value, factor_min, factor_max, unit, geography,
            reference_year, system_boundary, uncertainty_or_range, source_id, data_quality_status, notes_and_limitations
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          r.material_id,
          r.name,
          r.category || 'General Automotive Material',
          r.grade_or_type || '',
          r.production_route || 'Specified in Source',
          r.primary_or_recycled || 'Primary',
          numOrNull(r.recycled_content_pct),
          numOrNull(r.factor_value),
          numOrNull(r.factor_min),
          numOrNull(r.factor_max),
          r.unit || 'kg CO2e/kg',
          r.geography || 'India',
          numOrNull(r.reference_year) || 2026,
          r.system_boundary || 'Cradle-to-Gate',
          r.uncertainty_or_range || '',
          r.source_id,
          r.data_quality_status || 'Extracted from Referenced Dataset',
          r.notes_and_limitations || ''
        );
        importedCount++;
      } else if (entityType === 'processes') {
        db.prepare(`
          INSERT OR REPLACE INTO processes (
            process_id, process_name, process_category, applicability, energy_consumption_mj,
            process_emissions_kgco2e, reference_unit, energy_source, geography, reference_year,
            system_boundary, source_id, data_quality_status, is_allocated_facility_service, limitations
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          r.process_id,
          r.process_name,
          r.process_category || 'Manufacturing Process',
          r.applicability || 'Component Fabrication',
          numOrNull(r.energy_consumption_mj),
          numOrNull(r.process_emissions_kgco2e),
          r.reference_unit || 'kg processed',
          r.energy_source || 'Electricity',
          r.geography || 'India',
          numOrNull(r.reference_year) || 2026,
          r.system_boundary || 'Gate-to-Gate Process',
          r.source_id,
          r.data_quality_status || 'Extracted from Referenced Dataset',
          numOrNull(r.is_allocated_facility_service) || 0,
          r.limitations || ''
        );
        importedCount++;
      } else if (entityType === 'energy_factors') {
        db.prepare(`
          INSERT OR REPLACE INTO energy_factors (
            energy_id, carrier, pathway, factor_value, factor_min, factor_max, unit,
            geography, reference_year, lifecycle_boundary, factor_type_details,
            source_id, data_quality_status, critical_caveat
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          r.energy_id,
          r.carrier,
          r.pathway || 'Standard Pathway',
          numOrNull(r.factor_value),
          numOrNull(r.factor_min),
          numOrNull(r.factor_max),
          r.unit || 'kg CO2/kWh',
          r.geography || 'India',
          String(r.reference_year || '2026'),
          r.lifecycle_boundary || 'Generation Grid Mix',
          r.factor_type_details || '',
          r.source_id,
          r.data_quality_status || 'Officially Reported',
          r.critical_caveat || ''
        );
        importedCount++;
      } else if (entityType === 'vehicles') {
        db.prepare(`
          INSERT OR REPLACE INTO vehicles (
            vehicle_id, manufacturer, model, variant, model_year, powertrain, body_type,
            kerb_mass_kg, glider_reference_mass_kg, fuel_consumption_value, fuel_consumption_unit,
            electricity_consumption_kwh_per_km, electric_utility_factor, battery_capacity_kwh,
            battery_chemistry, range_km, test_cycle, material_coverage_notes, public_data_to_collect,
            manufacturing_emissions_approach, source_id, source_url, lca_data_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          r.vehicle_id,
          r.manufacturer,
          r.model,
          r.variant || 'Standard',
          numOrNull(r.model_year) || 2025,
          r.powertrain || 'Petrol (ICEV)',
          r.body_type || 'Passenger Car',
          numOrNull(r.kerb_mass_kg),
          numOrNull(r.glider_reference_mass_kg) || 1137,
          numOrNull(r.fuel_consumption_value),
          r.fuel_consumption_unit || 'km/L',
          numOrNull(r.electricity_consumption_kwh_per_km),
          numOrNull(r.electric_utility_factor) ?? 0,
          numOrNull(r.battery_capacity_kwh),
          r.battery_chemistry || '',
          numOrNull(r.range_km),
          r.test_cycle || 'ARAI / MIDC',
          r.material_coverage_notes || '',
          r.public_data_to_collect || '',
          r.manufacturing_emissions_approach || '',
          r.source_id,
          r.source_url || '',
          r.lca_data_status || 'Published Specs + Proxy BOM'
        );
        importedCount++;
      } else if (entityType === 'logistics_factors') {
        db.prepare(`
          INSERT OR REPLACE INTO logistics_factors (
            mode_id, transport_mode, vehicle_or_ship_class, fuel_or_traction, distance_km,
            freight_mass_tonnes, load_factor_pct, empty_running_notes, factor_kgco2e_per_tonne_km,
            factor_min, factor_max, unit, geography, reference_year, system_boundary,
            source_id, data_quality_status, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          r.mode_id,
          r.transport_mode,
          r.vehicle_or_ship_class || 'Commercial Freight',
          r.fuel_or_traction || 'Diesel',
          numOrNull(r.distance_km),
          numOrNull(r.freight_mass_tonnes),
          numOrNull(r.load_factor_pct),
          r.empty_running_notes || '',
          numOrNull(r.factor_kgco2e_per_tonne_km),
          numOrNull(r.factor_min),
          numOrNull(r.factor_max),
          r.unit || 'kg CO2e/tonne-km',
          r.geography || 'India',
          numOrNull(r.reference_year) || 2026,
          r.system_boundary || 'Well-to-Wheel Freight Transport',
          r.source_id,
          r.data_quality_status || 'Extracted from Referenced Dataset',
          r.notes || ''
        );
        importedCount++;
      } else if (entityType === 'sources') {
        db.prepare(`
          INSERT OR REPLACE INTO sources (
            source_id, title, publisher, publication_year, url, accessed_on, page_table,
            geography, dataset_version, licence_access_notes, extraction_status, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          r.source_id,
          r.title,
          r.publisher,
          numOrNull(r.publication_year) || 2026,
          r.url || '',
          r.accessed_on || new Date().toISOString().slice(0, 10),
          r.page_table || '',
          r.geography || 'India',
          r.dataset_version || 'v1.0',
          r.licence_access_notes || '',
          r.extraction_status || 'Imported via CSV Pipeline',
          r.notes || ''
        );
        importedCount++;
      } else {
        skippedCount++;
      }
    }

    const reportId = `REP-CSV-${Date.now()}`;
    db.prepare(`
      INSERT INTO import_reports (
        report_id, import_source_name, import_type, total_rows_processed,
        successful_imports, skipped_rows, duplicate_rows, flagged_for_review, details_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      reportId,
      sourceFileName,
      `CSV Import (${entityType})`,
      rowsToImport.length,
      importedCount,
      skippedCount,
      0,
      0,
      JSON.stringify({ entityType, importedIds: rowsToImport.map(x => Object.values(x)[0]) })
    );
  });

  tx();
  return { importedCount, skippedCount };
}

export function exportEntityToCsv(entityType: IngestionEntityType): string {
  const allowedTables: IngestionEntityType[] = ['materials', 'processes', 'energy_factors', 'vehicles', 'logistics_factors', 'sources'];
  if (!allowedTables.includes(entityType)) {
    throw new Error('Invalid entity type for CSV export.');
  }
  const rows = db.prepare(`SELECT * FROM ${entityType}`).all() as Record<string, any>[];
  return stringify(rows, { header: true });
}
