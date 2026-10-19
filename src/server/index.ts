import express from 'express';
import cors from 'cors';
import { db, initializeSchema } from './db/schema.js';
import { seedDatabase } from './db/seed.js';
import { executeGlobalSearch } from './search/searchEngine.js';
import { calculateVehicleLCA, LcaScenarioInput } from './calculator/lcaEngine.js';
import {
  executeReproducibleCaseStudy,
  formatCaseStudyMarkdownReport,
  DEFAULT_CASE_STUDY_CONFIG
} from './calculator/caseStudyRunner.js';
import {
  CSV_TEMPLATES,
  IngestionEntityType,
  validateAndPreviewCsv,
  commitValidatedRows,
  exportEntityToCsv
} from './ingestion/csvPipeline.js';
import { generateIntermediateNormalizedJson } from './ingestion/pdfExtractor.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Ensure DB is initialized and seeded on startup if empty
initializeSchema();
const existingSourcesCount = (db.prepare(`SELECT COUNT(*) as c FROM sources`).get() as any).c;
if (existingSourcesCount === 0) {
  seedDatabase();
}
generateIntermediateNormalizedJson();

// 1. Overview & Live Database Statistics
app.get('/api/overview', (_req, res) => {
  try {
    const materialsCount = (db.prepare(`SELECT COUNT(*) as c FROM materials`).get() as any).c;
    const componentsCount = (db.prepare(`SELECT COUNT(*) as c FROM components`).get() as any).c;
    const compMaterialsCount = (db.prepare(`SELECT COUNT(*) as c FROM component_materials`).get() as any).c;
    const processesCount = (db.prepare(`SELECT COUNT(*) as c FROM processes`).get() as any).c;
    const vehiclesCount = (db.prepare(`SELECT COUNT(*) as c FROM vehicles`).get() as any).c;
    const energyCount = (db.prepare(`SELECT COUNT(*) as c FROM energy_factors`).get() as any).c;
    const logisticsCount = (db.prepare(`SELECT COUNT(*) as c FROM logistics_factors`).get() as any).c;
    const useProfilesCount = (db.prepare(`SELECT COUNT(*) as c FROM use_phase_profiles`).get() as any).c;
    const eolCount = (db.prepare(`SELECT COUNT(*) as c FROM end_of_life_systems`).get() as any).c;
    const indicatorsCount = (db.prepare(`SELECT COUNT(*) as c FROM environmental_indicators`).get() as any).c;
    const sourcesCount = (db.prepare(`SELECT COUNT(*) as c FROM sources`).get() as any).c;
    const savedCalculationsCount = (db.prepare(`SELECT COUNT(*) as c FROM vehicle_lca_results`).get() as any).c;

    const totalRecords =
      materialsCount +
      componentsCount +
      compMaterialsCount +
      processesCount +
      vehiclesCount +
      energyCount +
      logisticsCount +
      useProfilesCount +
      eolCount +
      indicatorsCount +
      sourcesCount;

    // Count records needing external factor extraction or verification
    const matNeedsExt = (db.prepare(`SELECT COUNT(*) as c FROM materials WHERE factor_value IS NULL AND factor_min IS NULL`).get() as any).c;
    const procNeedsExt = (db.prepare(`SELECT COUNT(*) as c FROM processes WHERE process_emissions_kgco2e IS NULL OR is_allocated_facility_service = 1`).get() as any).c;
    const nrgNeedsExt = (db.prepare(`SELECT COUNT(*) as c FROM energy_factors WHERE factor_value IS NULL AND factor_min IS NULL`).get() as any).c;
    const logNeedsExt = (db.prepare(`SELECT COUNT(*) as c FROM logistics_factors WHERE factor_kgco2e_per_tonne_km IS NULL`).get() as any).c;
    const sourcesExternalBackbone = (db.prepare(`SELECT COUNT(*) as c FROM sources WHERE extraction_status LIKE '%External%'`).get() as any).c;

    // Geography breakdown across core data layers
    const indiaRecords =
      (db.prepare(`SELECT COUNT(*) as c FROM materials WHERE geography LIKE '%India%'`).get() as any).c +
      (db.prepare(`SELECT COUNT(*) as c FROM energy_factors WHERE geography LIKE '%India%'`).get() as any).c +
      (db.prepare(`SELECT COUNT(*) as c FROM logistics_factors WHERE geography LIKE '%India%'`).get() as any).c +
      (db.prepare(`SELECT COUNT(*) as c FROM sources WHERE geography LIKE '%India%'`).get() as any).c +
      (db.prepare(`SELECT COUNT(*) as c FROM vehicles`).get() as any).c;

    const euProxyRecords =
      (db.prepare(`SELECT COUNT(*) as c FROM components WHERE geography LIKE '%European%'`).get() as any).c +
      (db.prepare(`SELECT COUNT(*) as c FROM materials WHERE geography LIKE '%European%'`).get() as any).c +
      (db.prepare(`SELECT COUNT(*) as c FROM sources WHERE geography LIKE '%European%'`).get() as any).c;

    const globalScreeningRecords =
      (db.prepare(`SELECT COUNT(*) as c FROM materials WHERE geography LIKE '%Global%'`).get() as any).c +
      (db.prepare(`SELECT COUNT(*) as c FROM processes WHERE geography LIKE '%Global%'`).get() as any).c +
      (db.prepare(`SELECT COUNT(*) as c FROM energy_factors WHERE geography LIKE '%Global%'`).get() as any).c;

    res.json({
      total_records: totalRecords,
      counts: {
        materials: materialsCount,
        components: componentsCount,
        component_materials: compMaterialsCount,
        manufacturing_processes: processesCount,
        vehicle_variants: vehiclesCount,
        energy_factors: energyCount,
        logistics_factors: logisticsCount,
        energy_and_logistics_total: energyCount + logisticsCount,
        use_phase_profiles: useProfilesCount,
        end_of_life_systems: eolCount,
        environmental_indicators: indicatorsCount,
        source_documents: sourcesCount,
        saved_lca_results: savedCalculationsCount
      },
      provenance_and_gaps: {
        records_with_orphan_sources: 0, // Strict foreign key constraint guarantees 0 orphan records
        records_requiring_external_extraction_or_review: matNeedsExt + procNeedsExt + nrgNeedsExt + logNeedsExt,
        external_backbone_sources_registered: sourcesExternalBackbone,
        breakdown: {
          materials_awaiting_exact_factor: matNeedsExt,
          processes_allocated_or_missing_moulding: procNeedsExt,
          energy_pathways_awaiting_versioned_import: nrgNeedsExt,
          logistics_modes_awaiting_factor_import: logNeedsExt
        }
      },
      geography_coverage: [
        { name: 'India-Specific / India Framework', count: indiaRecords },
        { name: 'EU Representative Proxy (SWD 2023/256)', count: euProxyRecords },
        { name: 'Global / US Literature Screening (GREET / IEA / PMC)', count: globalScreeningRecords }
      ]
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Global Search & Autocomplete Suggestions
app.get('/api/search', (req, res) => {
  try {
    const result = executeGlobalSearch({
      q: String(req.query.q || ''),
      entity_type: String(req.query.entity_type || 'All'),
      geography: String(req.query.geography || 'All'),
      year: String(req.query.year || 'All'),
      boundary: String(req.query.boundary || 'All'),
      quality_status: String(req.query.quality_status || 'All'),
      source_id: String(req.query.source_id || 'All'),
      sort_by: (req.query.sort_by as any) || 'relevance',
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 25
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/search/suggestions', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const benchmarkQueries = [
    'Steel emission factor in India',
    'Recycled aluminium versus primary aluminium',
    'Battery manufacturing emissions per kWh',
    'Casting energy consumption',
    'Indian grid electricity emission factor',
    'Material composition of an electric vehicle',
    'Manufacturing emissions for a hybrid car',
    'Road freight emissions per tonne-km',
    'End-of-life recycling of lithium-ion batteries',
    'Petrol car versus electric car lifecycle emissions'
  ];

  if (!q) {
    return res.json({ suggestions: benchmarkQueries });
  }

  const matchedBenchmarks = benchmarkQueries.filter(b => b.toLowerCase().includes(q));
  const quickSearch = executeGlobalSearch({ q, limit: 6 });
  const recordTitles = quickSearch.results.map(r => r.title);

  const combined = Array.from(new Set([...matchedBenchmarks, ...recordTitles])).slice(0, 8);
  res.json({ suggestions: combined });
});

// 3. Entity Endpoints with Joined Source Metadata
app.get('/api/materials', (_req, res) => {
  const rows = db.prepare(`
    SELECT m.*, s.title as source_title, s.url as source_url, s.publisher as source_publisher
    FROM materials m
    LEFT JOIN sources s ON m.source_id = s.source_id
    ORDER BY m.category, m.name
  `).all();
  res.json(rows);
});

app.get('/api/components', (_req, res) => {
  const comps = db.prepare(`
    SELECT c.*, s.title as source_title, s.url as source_url, s.publisher as source_publisher
    FROM components c
    LEFT JOIN sources s ON c.source_id = s.source_id
  `).all() as any[];

  const compMats = db.prepare(`
    SELECT cm.*, m.factor_min, m.factor_max, m.factor_value, m.unit as factor_unit, m.data_quality_status
    FROM component_materials cm
    LEFT JOIN materials m ON cm.material_id = m.material_id
  `).all() as any[];

  const enriched = comps.map(c => ({
    ...c,
    material_breakdown: compMats.filter(cm => cm.component_id === c.component_id)
  }));
  res.json(enriched);
});

app.get('/api/processes', (_req, res) => {
  const rows = db.prepare(`
    SELECT p.*, s.title as source_title, s.url as source_url, s.publisher as source_publisher
    FROM processes p
    LEFT JOIN sources s ON p.source_id = s.source_id
    ORDER BY p.is_allocated_facility_service ASC, p.process_name ASC
  `).all();
  res.json(rows);
});

app.get('/api/energy-factors', (_req, res) => {
  const rows = db.prepare(`
    SELECT e.*, s.title as source_title, s.url as source_url, s.publisher as source_publisher
    FROM energy_factors e
    LEFT JOIN sources s ON e.source_id = s.source_id
    ORDER BY e.carrier, e.energy_id
  `).all();
  res.json(rows);
});

app.get('/api/logistics-factors', (_req, res) => {
  const rows = db.prepare(`
    SELECT l.*, s.title as source_title, s.url as source_url, s.publisher as source_publisher
    FROM logistics_factors l
    LEFT JOIN sources s ON l.source_id = s.source_id
  `).all();
  res.json(rows);
});

app.get('/api/vehicles', (_req, res) => {
  const rows = db.prepare(`
    SELECT v.*, s.title as source_title, s.url as source_doc_url, s.publisher as source_publisher
    FROM vehicles v
    LEFT JOIN sources s ON v.source_id = s.source_id
    ORDER BY v.vehicle_id
  `).all();
  res.json(rows);
});

app.get('/api/use-phase-profiles', (_req, res) => {
  const rows = db.prepare(`
    SELECT u.*, s.title as source_title, s.url as source_url
    FROM use_phase_profiles u
    LEFT JOIN sources s ON u.source_id = s.source_id
  `).all();
  res.json(rows);
});

app.get('/api/eol-systems', (_req, res) => {
  const rows = db.prepare(`
    SELECT e.*, s.title as source_title, s.url as source_url
    FROM end_of_life_systems e
    LEFT JOIN sources s ON e.source_id = s.source_id
  `).all();
  res.json(rows);
});

app.get('/api/indicators', (_req, res) => {
  const rows = db.prepare(`
    SELECT i.*, s.title as source_title, s.url as source_url
    FROM environmental_indicators i
    LEFT JOIN sources s ON i.source_id = s.source_id
  `).all();
  res.json(rows);
});

app.get('/api/sources', (_req, res) => {
  const rows = db.prepare(`SELECT * FROM sources ORDER BY extraction_status ASC, publication_year DESC`).all();
  res.json(rows);
});

app.get('/api/import-reports', (_req, res) => {
  const rows = db.prepare(`SELECT * FROM import_reports ORDER BY created_at DESC`).all();
  res.json(rows);
});

// 4. Lifecycle Calculation Engine Endpoints
app.post('/api/calculate-lca', (req, res) => {
  try {
    const scenarioInput: LcaScenarioInput = req.body;
    const result = calculateVehicleLCA(scenarioInput);

    if (req.body.save_result) {
      const resultId = `LCA-RES-${Date.now()}`;
      db.prepare(`
        INSERT INTO vehicle_lca_results (
          result_id, scenario_name, vehicle_id, functional_unit, lifetime_km,
          material_production_kgco2e, component_manufacturing_kgco2e, manufacturing_total_kgco2e,
          transport_kgco2e, use_phase_tailpipe_kgco2e, use_phase_upstream_kgco2e,
          use_phase_total_kgco2e, maintenance_kgco2e, end_of_life_kgco2e,
          total_kgco2e, g_co2e_per_km, double_counting_guard_applied,
          assumptions_json, uncertainty_and_flags_json, data_quality_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        resultId,
        result.scenario_name,
        scenarioInput.vehicle_id || null,
        result.functional_unit,
        result.lifetime_distance_km,
        result.stages.material_production.point,
        result.stages.component_and_process_manufacturing.point + result.stages.battery_pack_production.point,
        result.stages.manufacturing_total.point,
        result.stages.logistics_and_transport.point,
        result.stages.use_phase_tailpipe.point,
        result.stages.use_phase_upstream.point,
        result.stages.use_phase_total.point,
        result.stages.maintenance.point,
        result.stages.end_of_life_net.point,
        result.totals.total_kgco2e.point,
        result.totals.g_co2e_per_km.point,
        result.double_counting_guards_triggered.length > 0 ? 1 : 0,
        JSON.stringify(scenarioInput),
        JSON.stringify({
          ranges: result.stages,
          totals_range: result.totals,
          guards: result.double_counting_guards_triggered,
          warnings: result.missing_data_warnings
        }),
        result.data_quality_label
      );
    }

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/saved-lca-results', (_req, res) => {
  const rows = db.prepare(`SELECT * FROM vehicle_lca_results ORDER BY created_at DESC`).all();
  res.json(rows);
});

// 4b. Reproducible Case Study Endpoints
app.get('/api/case-study/default-config', (_req, res) => {
  res.json(DEFAULT_CASE_STUDY_CONFIG);
});

app.post('/api/case-study/run', (req, res) => {
  try {
    const saveToDb = Boolean(req.body.save_to_db);
    const customConfig = req.body.config || {};
    const report = executeReproducibleCaseStudy(customConfig, saveToDb);
    res.json(report);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/case-study/saved', (_req, res) => {
  try {
    const rows = db.prepare(`SELECT * FROM case_study_runs ORDER BY created_at DESC`).all();
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/case-study/export-markdown', (req, res) => {
  try {
    const customConfig = req.body.config || {};
    const report = executeReproducibleCaseStudy(customConfig, false);
    const md = formatCaseStudyMarkdownReport(report);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="GreenAutoIndia_CaseStudy_${report.run_id}.md"`);
    res.send(md);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 5. CSV Ingestion, Templates & Export Endpoints
app.get('/api/ingestion/template/:entityType', (req, res) => {
  const entityType = req.params.entityType as IngestionEntityType;
  const tpl = CSV_TEMPLATES[entityType];
  if (!tpl) {
    return res.status(400).json({ error: 'Unsupported entity type for template.' });
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${entityType}_template.csv"`);
  res.send(tpl);
});

app.get('/api/ingestion/export/:entityType', (req, res) => {
  try {
    const entityType = req.params.entityType as IngestionEntityType;
    const csvStr = exportEntityToCsv(entityType);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${entityType}_export.csv"`);
    res.send(csvStr);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/ingestion/preview', (req, res) => {
  try {
    const { entity_type, csv_text } = req.body;
    if (!entity_type || !csv_text) {
      return res.status(400).json({ error: 'Both entity_type and csv_text are required.' });
    }
    const preview = validateAndPreviewCsv(entity_type as IngestionEntityType, csv_text);
    res.json(preview);
  } catch (err: any) {
    res.status(400).json({ error: `CSV Parse/Validation Error: ${err.message}` });
  }
});

app.post('/api/ingestion/commit', (req, res) => {
  try {
    const { entity_type, rows, source_file_name } = req.body;
    if (!entity_type || !Array.isArray(rows)) {
      return res.status(400).json({ error: 'entity_type and rows array are required.' });
    }
    const result = commitValidatedRows(entity_type as IngestionEntityType, rows, source_file_name);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: `Database Import Error: ${err.message}` });
  }
});

export { app };
export default app;

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Green Auto India LCA Backend Server running on http://localhost:${PORT}`);
  });
}
