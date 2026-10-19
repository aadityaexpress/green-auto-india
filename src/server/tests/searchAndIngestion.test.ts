import { describe, it, expect, beforeAll } from 'vitest';
import { executeGlobalSearch } from '../search/searchEngine.js';
import { validateAndPreviewCsv, commitValidatedRows, CSV_TEMPLATES } from '../ingestion/csvPipeline.js';
import { initializeSchema } from '../db/schema.js';
import { seedDatabase } from '../db/seed.js';

describe('Green Auto India — Search Engine & CSV Ingestion Verification', () => {
  beforeAll(() => {
    initializeSchema();
    seedDatabase();
  });

  it('1. Retrieves relevant records for all 10 natural-language benchmark queries', () => {
    const queries = [
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

    for (const q of queries) {
      const res = executeGlobalSearch({ q });
      expect(res.total_results).toBeGreaterThan(0);
      expect(res.results[0].match_reasons.length).toBeGreaterThan(0);
    }
  });

  it('2. Ranks primary and recycled aluminium at the top for "Recycled aluminium versus primary aluminium"', () => {
    const res = executeGlobalSearch({ q: 'Recycled aluminium versus primary aluminium' });
    const topIds = res.results.slice(0, 4).map(r => r.id);
    expect(topIds).toContain('MAT-ALU-PRIMARY');
    expect(topIds).toContain('MAT-ALU-RECYCLED');
  });

  it('3. Ranks aluminium and iron casting processes at the top for "Casting energy consumption"', () => {
    const res = executeGlobalSearch({ q: 'Casting energy consumption' });
    const topIds = res.results.slice(0, 4).map(r => r.id);
    expect(topIds).toContain('PROC-ALU-CASTING');
    expect(topIds).toContain('PROC-IRON-CASTING');
  });

  it('4. Validates, previews, and commits a new CSV record into the persistent SQLite database', () => {
    const preview = validateAndPreviewCsv('materials', CSV_TEMPLATES.materials);
    expect(preview.total_rows).toBe(1);
    expect(preview.error_count).toBe(0);

    const commitRes = commitValidatedRows(
      'materials',
      preview.rows.map(r => r.record),
      'test_steel_import.csv'
    );
    expect(commitRes.importedCount).toBe(1);

    // Search for the newly imported India BF-BOF steel record
    const searchAfter = executeGlobalSearch({ q: 'India BF-BOF' });
    expect(searchAfter.results.some(r => r.id === 'MAT-STEEL-INDIA-BF')).toBe(true);
  });
});
