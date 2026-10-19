import fs from 'fs';
import path from 'path';
import os from 'os';
import { db, initializeSchema } from '../db/schema.js';
import { seedDatabase } from '../db/seed.js';

const INTERMEDIATE_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), 'extracted_intermediate')
  : path.resolve(process.cwd(), 'data', 'extracted_intermediate');

try {
  if (!fs.existsSync(INTERMEDIATE_DIR)) {
    fs.mkdirSync(INTERMEDIATE_DIR, { recursive: true });
  }
} catch {
  // Ignore on read-only serverless environment
}

export function generateIntermediateNormalizedJson() {
  initializeSchema();
  const counts = seedDatabase();

  const snapshot = {
    extraction_metadata: {
      source_pdf: 'Automotive Life-Cycle Assessment Reference Data Pack (Research snapshot: 18 October 2026)',
      extracted_at: new Date().toISOString(),
      scientific_integrity_policy: 'Zero fabricated numbers. Screening bands preserved as min/max ranges. Allocated facility factors flagged. External backbone sources registered with extraction_status.'
    },
    counts,
    sources: db.prepare(`SELECT * FROM sources`).all(),
    materials: db.prepare(`SELECT * FROM materials`).all(),
    components: db.prepare(`SELECT * FROM components`).all(),
    component_materials: db.prepare(`SELECT * FROM component_materials`).all(),
    processes: db.prepare(`SELECT * FROM processes`).all(),
    energy_factors: db.prepare(`SELECT * FROM energy_factors`).all(),
    logistics_factors: db.prepare(`SELECT * FROM logistics_factors`).all(),
    vehicles: db.prepare(`SELECT * FROM vehicles`).all(),
    use_phase_profiles: db.prepare(`SELECT * FROM use_phase_profiles`).all(),
    end_of_life_systems: db.prepare(`SELECT * FROM end_of_life_systems`).all(),
    environmental_indicators: db.prepare(`SELECT * FROM environmental_indicators`).all(),
    import_reports: db.prepare(`SELECT * FROM import_reports`).all()
  };

  const outPath = path.join(INTERMEDIATE_DIR, 'pdf_reference_pack_normalized.json');
  try {
    fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2), 'utf-8');
  } catch {
    // Ignore write failure on read-only filesystem
  }
  return { outPath, counts };
}

// Allow CLI execution
if (process.argv[1] && process.argv[1].includes('pdfExtractor')) {
  const res = generateIntermediateNormalizedJson();
  console.log('Normalized PDF intermediate JSON written to:', res.outPath);
  console.log('Record counts:', res.counts);
}
