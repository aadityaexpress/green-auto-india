import { db } from '../db/schema.js';

export interface UnifiedSearchResult {
  id: string;
  entity_type: 'Material' | 'Component' | 'Manufacturing Process' | 'Energy Factor' | 'Logistics Mode' | 'Vehicle Archetype/Model' | 'End-of-Life System' | 'Environmental Indicator' | 'Source Document';
  title: string;
  subtitle: string;
  value_display: string;
  unit: string;
  system_boundary: string;
  geography: string;
  reference_year: string | number;
  data_quality_status: string;
  source_id: string;
  source_title: string;
  source_url: string;
  notes: string;
  relevance_score: number;
  match_reasons: string[];
  raw_record: Record<string, any>;
}

export interface SearchQueryOptions {
  q?: string;
  entity_type?: string;
  geography?: string;
  year?: string;
  boundary?: string;
  quality_status?: string;
  source_id?: string;
  sort_by?: 'relevance' | 'year_desc' | 'source_quality' | 'alphabetical';
  page?: number;
  limit?: number;
}

const STOP_WORDS = new Set([
  'in', 'of', 'for', 'an', 'a', 'the', 'and', 'or', 'versus', 'vs', 'per', 'with', 'to', 'from', 'by', 'on'
]);

const SYNONYM_EXPANSIONS: Record<string, string[]> = {
  ev: ['electric', 'bev', 'battery', 'traction'],
  bev: ['battery', 'electric', 'ev'],
  ice: ['icev', 'petrol', 'diesel', 'combustion', 'internal'],
  icev: ['ice', 'petrol', 'diesel', 'combustion'],
  hev: ['hybrid', 'full hybrid'],
  phev: ['plug-in', 'hybrid'],
  fcev: ['hydrogen', 'fuel-cell', 'fuel cell'],
  car: ['vehicle', 'passenger', 'automotive', 'hatchback', 'suv'],
  indian: ['india', 'cea', 'ceew', 'nature'],
  india: ['indian', 'cea', 'ceew'],
  aluminium: ['aluminum', 'wrought', 'cast'],
  aluminum: ['aluminium', 'wrought', 'cast'],
  grid: ['electricity', 'cea', 'power'],
  electricity: ['grid', 'solar', 'wind', 'kwh'],
  freight: ['logistics', 'road', 'rail', 'shipping', 'transport', 'tonne-km'],
  battery: ['lithium-ion', 'lib', 'pack', 'kwh', 'lfp', 'nmc', 'batpac'],
  eol: ['end-of-life', 'recycling', 'dismantling', 'scrap', 'recovery'],
  recycling: ['recycled', 'secondary', 'end-of-life', 'scrap', 'cut-off', 'avoided']
};

export function executeGlobalSearch(options: SearchQueryOptions) {
  const rawQuery = (options.q || '').trim().toLowerCase();
  const rawTokens = rawQuery
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP_WORDS.has(t));

  const expandedTokens = new Set<string>(rawTokens);
  for (const token of rawTokens) {
    if (SYNONYM_EXPANSIONS[token]) {
      for (const syn of SYNONYM_EXPANSIONS[token]) {
        expandedTokens.add(syn);
      }
    }
  }

  const queryMentionsIndia = rawTokens.includes('india') || rawTokens.includes('indian');

  // Load source map
  const sourcesList = db.prepare(`SELECT * FROM sources`).all() as any[];
  const sourceMap = new Map<string, any>();
  for (const s of sourcesList) {
    sourceMap.set(s.source_id, s);
  }

  const allItems: UnifiedSearchResult[] = [];

  // 1. Materials
  const materials = db.prepare(`SELECT * FROM materials`).all() as any[];
  for (const m of materials) {
    const src = sourceMap.get(m.source_id) || {};
    let valDisplay = 'N/A';
    if (typeof m.factor_value === 'number') {
      valDisplay = `${m.factor_value}`;
    } else if (typeof m.factor_min === 'number' && typeof m.factor_max === 'number') {
      valDisplay = `~${m.factor_min}–${m.factor_max} (Screening Range)`;
    } else if (m.uncertainty_or_range) {
      valDisplay = m.uncertainty_or_range;
    }

    allItems.push({
      id: m.material_id,
      entity_type: 'Material',
      title: m.name,
      subtitle: `${m.category} • ${m.production_route} (${m.primary_or_recycled})`,
      value_display: valDisplay,
      unit: m.unit,
      system_boundary: m.system_boundary,
      geography: m.geography,
      reference_year: m.reference_year || '2026',
      data_quality_status: m.data_quality_status,
      source_id: m.source_id,
      source_title: src.title || m.source_id,
      source_url: src.url || '',
      notes: m.notes_and_limitations || '',
      relevance_score: 0,
      match_reasons: [],
      raw_record: m
    });
  }

  // 2. Components & Representative Vehicle BOMs
  const components = db.prepare(`SELECT * FROM components`).all() as any[];
  for (const c of components) {
    const src = sourceMap.get(c.source_id) || {};
    allItems.push({
      id: c.component_id,
      entity_type: 'Component',
      title: c.component_name,
      subtitle: `${c.component_category} • Powertrain: ${c.applicable_powertrain}`,
      value_display: c.mass_kg ? `${c.mass_kg} kg total mass` : 'Qualitative Subsystem Composition',
      unit: c.mass_kg ? 'kg' : 'Material Mix',
      system_boundary: 'Vehicle BOM / Component Composition',
      geography: c.geography,
      reference_year: c.reference_year || '2023',
      data_quality_status: c.confidence_status,
      source_id: c.source_id,
      source_title: src.title || c.source_id,
      source_url: src.url || '',
      notes: `${c.notes || ''} Processes: ${c.manufacturing_processes || ''}`,
      relevance_score: 0,
      match_reasons: [],
      raw_record: c
    });
  }

  // 3. Manufacturing Processes
  const processes = db.prepare(`SELECT * FROM processes`).all() as any[];
  for (const p of processes) {
    const src = sourceMap.get(p.source_id) || {};
    const valDisplay =
      typeof p.process_emissions_kgco2e === 'number'
        ? `${p.process_emissions_kgco2e} kg CO2 (${p.energy_consumption_mj} MJ)`
        : 'Missing in Table 4 — Requires Process Inventory';

    allItems.push({
      id: p.process_id,
      entity_type: 'Manufacturing Process',
      title: p.process_name,
      subtitle: `${p.process_category} • Applicability: ${p.applicability}`,
      value_display: valDisplay,
      unit: `per ${p.reference_unit}`,
      system_boundary: p.system_boundary,
      geography: p.geography,
      reference_year: p.reference_year || '2024',
      data_quality_status: p.data_quality_status,
      source_id: p.source_id,
      source_title: src.title || p.source_id,
      source_url: src.url || '',
      notes: p.limitations || '',
      relevance_score: 0,
      match_reasons: [],
      raw_record: p
    });
  }

  // 4. Energy Factors
  const energy = db.prepare(`SELECT * FROM energy_factors`).all() as any[];
  for (const e of energy) {
    const src = sourceMap.get(e.source_id) || {};
    let valDisplay = e.factor_type_details || 'Requires Dataset Import';
    if (typeof e.factor_min === 'number' && typeof e.factor_max === 'number') {
      valDisplay = `~${e.factor_min}–${e.factor_max} (Mid: ${e.factor_value})`;
    } else if (typeof e.factor_value === 'number') {
      valDisplay = `${e.factor_value}`;
    }

    allItems.push({
      id: e.energy_id,
      entity_type: 'Energy Factor',
      title: `${e.carrier} — ${e.pathway}`,
      subtitle: `Carrier: ${e.carrier} • Boundary: ${e.lifecycle_boundary}`,
      value_display: valDisplay,
      unit: e.unit,
      system_boundary: e.lifecycle_boundary,
      geography: e.geography,
      reference_year: e.reference_year,
      data_quality_status: e.data_quality_status,
      source_id: e.source_id,
      source_title: src.title || e.source_id,
      source_url: src.url || '',
      notes: e.critical_caveat || '',
      relevance_score: 0,
      match_reasons: [],
      raw_record: e
    });
  }

  // 5. Logistics Modes
  const logistics = db.prepare(`SELECT * FROM logistics_factors`).all() as any[];
  for (const l of logistics) {
    const src = sourceMap.get(l.source_id) || {};
    const valDisplay =
      typeof l.factor_kgco2e_per_tonne_km === 'number'
        ? `${l.factor_kgco2e_per_tonne_km}`
        : 'Formula / Mode Layer (Requires Factor Import)';

    allItems.push({
      id: l.mode_id,
      entity_type: 'Logistics Mode',
      title: `${l.transport_mode} (${l.vehicle_or_ship_class})`,
      subtitle: `Traction/Fuel: ${l.fuel_or_traction}`,
      value_display: valDisplay,
      unit: l.unit,
      system_boundary: l.system_boundary,
      geography: l.geography,
      reference_year: l.reference_year || '2026',
      data_quality_status: l.data_quality_status,
      source_id: l.source_id,
      source_title: src.title || l.source_id,
      source_url: src.url || '',
      notes: `${l.notes || ''} ${l.empty_running_notes || ''}`,
      relevance_score: 0,
      match_reasons: [],
      raw_record: l
    });
  }

  // 6. Vehicles
  const vehicles = db.prepare(`SELECT * FROM vehicles`).all() as any[];
  for (const v of vehicles) {
    const src = sourceMap.get(v.source_id) || {};
    allItems.push({
      id: v.vehicle_id,
      entity_type: 'Vehicle Archetype/Model',
      title: `${v.model} — ${v.variant}`,
      subtitle: `${v.manufacturer} • Powertrain: ${v.powertrain} • Body: ${v.body_type}`,
      value_display: v.kerb_mass_kg ? `${v.kerb_mass_kg} kg baseline mass` : 'Archetype Specification',
      unit: v.fuel_consumption_unit || 'Vehicle Archetype',
      system_boundary: 'Cradle-to-Grave Archetype',
      geography: 'India / EU Reference BOM',
      reference_year: v.model_year || '2026',
      data_quality_status: v.lca_data_status,
      source_id: v.source_id,
      source_title: src.title || v.source_id,
      source_url: v.source_url || src.url || '',
      notes: `Coverage: ${v.material_coverage_notes} | Manufacturing Approach: ${v.manufacturing_emissions_approach}`,
      relevance_score: 0,
      match_reasons: [],
      raw_record: v
    });
  }

  // 7. End-of-Life Systems
  const eols = db.prepare(`SELECT * FROM end_of_life_systems`).all() as any[];
  for (const eol of eols) {
    const src = sourceMap.get(eol.source_id) || {};
    allItems.push({
      id: eol.eol_id,
      entity_type: 'End-of-Life System',
      title: eol.system_name,
      subtitle: `Allocation: ${eol.allocation_method} • Target: ${eol.applicable_material_or_vehicle}`,
      value_display: eol.allocation_method,
      unit: 'EoL Allocation & Recycling Module',
      system_boundary: 'End-of-Life (Dismantling, Recycling, Recovery)',
      geography: eol.geography,
      reference_year: eol.reference_year || '2026',
      data_quality_status: eol.data_quality_status,
      source_id: eol.source_id,
      source_title: src.title || eol.source_id,
      source_url: src.url || '',
      notes: `${eol.dismantling_process}. ${eol.notes || ''}`,
      relevance_score: 0,
      match_reasons: [],
      raw_record: eol
    });
  }

  // 8. Environmental Indicators
  const indicators = db.prepare(`SELECT * FROM environmental_indicators`).all() as any[];
  for (const ind of indicators) {
    const src = sourceMap.get(ind.source_id) || {};
    allItems.push({
      id: ind.indicator_id,
      entity_type: 'Environmental Indicator',
      title: `${ind.indicator_name} (${ind.indicator_code})`,
      subtitle: `LCIA Method: ${ind.lcia_method}`,
      value_display: ind.status_in_pack,
      unit: ind.unit,
      system_boundary: 'LCIA Impact Category',
      geography: 'Global / India',
      reference_year: '2026',
      data_quality_status: ind.status_in_pack,
      source_id: ind.source_id,
      source_title: src.title || ind.source_id,
      source_url: src.url || '',
      notes: `${ind.scope_description} ${ind.notes || ''}`,
      relevance_score: 0,
      match_reasons: [],
      raw_record: ind
    });
  }

  // 9. Source Documents
  for (const s of sourcesList) {
    allItems.push({
      id: s.source_id,
      entity_type: 'Source Document',
      title: s.title,
      subtitle: `${s.publisher} (${s.publication_year})`,
      value_display: s.extraction_status,
      unit: s.page_table || 'Reference Source',
      system_boundary: s.dataset_version || 'Full Document',
      geography: s.geography,
      reference_year: s.publication_year || '2026',
      data_quality_status: s.extraction_status,
      source_id: s.source_id,
      source_title: s.title,
      source_url: s.url || '',
      notes: s.notes || '',
      relevance_score: 0,
      match_reasons: [],
      raw_record: s
    });
  }

  // Score and filter items
  const scoredItems: UnifiedSearchResult[] = [];

  for (const item of allItems) {
    // Apply strict filters if requested
    if (options.entity_type && options.entity_type !== 'All' && item.entity_type !== options.entity_type) {
      continue;
    }
    if (options.geography && options.geography !== 'All' && !item.geography.toLowerCase().includes(options.geography.toLowerCase())) {
      continue;
    }
    if (options.boundary && options.boundary !== 'All' && !item.system_boundary.toLowerCase().includes(options.boundary.toLowerCase())) {
      continue;
    }
    if (options.quality_status && options.quality_status !== 'All' && !item.data_quality_status.toLowerCase().includes(options.quality_status.toLowerCase())) {
      continue;
    }
    if (options.source_id && options.source_id !== 'All' && item.source_id !== options.source_id) {
      continue;
    }
    if (options.year && options.year !== 'All' && String(item.reference_year) !== String(options.year)) {
      continue;
    }

    if (!rawQuery) {
      item.relevance_score = 50;
      item.match_reasons = ['Displayed in full database directory view'];
      scoredItems.push(item);
      continue;
    }

    const titleLower = item.title.toLowerCase();
    const subLower = item.subtitle.toLowerCase();
    const notesLower = item.notes.toLowerCase();
    const geoLower = item.geography.toLowerCase();
    const unitLower = item.unit.toLowerCase();
    const typeLower = item.entity_type.toLowerCase();
    const rawJsonLower = JSON.stringify(item.raw_record).toLowerCase();

    let score = 0;
    const reasons: string[] = [];

    // Phrase match
    if (titleLower.includes(rawQuery)) {
      score += 80;
      reasons.push(`Exact phrase match in title ("${item.title}")`);
    } else if (subLower.includes(rawQuery) || notesLower.includes(rawQuery)) {
      score += 45;
      reasons.push(`Phrase match in technical description or notes`);
    }

    // Token matches
    let matchedDirectTokens = 0;
    for (const token of rawTokens) {
      if (titleLower.includes(token)) {
        score += 30;
        matchedDirectTokens++;
        reasons.push(`Matched concept "${token}" in record title`);
      } else if (subLower.includes(token) || typeLower.includes(token)) {
        score += 20;
        matchedDirectTokens++;
        reasons.push(`Matched category/attribute "${token}"`);
      } else if (unitLower.includes(token)) {
        score += 18;
        matchedDirectTokens++;
        reasons.push(`Matched reference unit "${token}"`);
      } else if (notesLower.includes(token) || rawJsonLower.includes(token)) {
        score += 12;
        matchedDirectTokens++;
        reasons.push(`Matched term "${token}" in metadata/BOM/notes`);
      }
    }

    // Expanded synonym matches
    for (const syn of expandedTokens) {
      if (rawTokens.includes(syn)) continue;
      if (titleLower.includes(syn) || subLower.includes(syn)) {
        score += 14;
        reasons.push(`Matched domain synonym "${syn}"`);
      } else if (notesLower.includes(syn) || rawJsonLower.includes(syn)) {
        score += 6;
      }
    }

    // Geography boost when query mentions India
    if (queryMentionsIndia && geoLower.includes('india')) {
      score += 25;
      reasons.push(`Prioritised India-specific geographical coverage (${item.geography})`);
    }

    // Special query intent boosts
    if ((rawTokens.includes('steel') || rawTokens.includes('aluminium') || rawTokens.includes('copper')) && item.entity_type === 'Material') {
      score += 20;
      reasons.push('Direct Material Emission Factor layer match');
    }
    if ((rawTokens.includes('casting') || rawTokens.includes('stamping') || rawTokens.includes('welding') || rawTokens.includes('painting')) && item.entity_type === 'Manufacturing Process') {
      score += 25;
      reasons.push('Direct Manufacturing Process layer match');
    }
    if ((rawTokens.includes('grid') || rawTokens.includes('electricity') || rawTokens.includes('hydrogen')) && item.entity_type === 'Energy Factor') {
      score += 25;
      reasons.push('Direct Energy & Fuel Pathway layer match');
    }
    if ((rawTokens.includes('freight') || rawTokens.includes('road') || rawTokens.includes('rail') || rawTokens.includes('tonne-km')) && item.entity_type === 'Logistics Mode') {
      score += 25;
      reasons.push('Direct Transportation & Logistics layer match');
    }
    if ((rawTokens.includes('composition') || rawTokens.includes('bom')) && item.entity_type === 'Component') {
      score += 25;
      reasons.push('Direct Representative Vehicle Material Composition (BOM) match');
    }

    if (score > 0 && (matchedDirectTokens > 0 || expandedTokens.size > 0)) {
      // Deduplicate reasons
      item.relevance_score = score;
      item.match_reasons = Array.from(new Set(reasons)).slice(0, 4);
      scoredItems.push(item);
    }
  }

  // Sort results
  const sortBy = options.sort_by || 'relevance';
  scoredItems.sort((a, b) => {
    if (sortBy === 'alphabetical') {
      return a.title.localeCompare(b.title);
    }
    if (sortBy === 'year_desc') {
      const yA = parseInt(String(a.reference_year), 10) || 0;
      const yB = parseInt(String(b.reference_year), 10) || 0;
      return yB - yA || b.relevance_score - a.relevance_score;
    }
    if (sortBy === 'source_quality') {
      const qRank = (status: string) => {
        if (status.includes('Peer-Reviewed') || status.includes('Directly Extracted') || status.includes('Published Representative')) return 3;
        if (status.includes('Indicative Screening')) return 2;
        return 1;
      };
      return qRank(b.data_quality_status) - qRank(a.data_quality_status) || b.relevance_score - a.relevance_score;
    }
    return b.relevance_score - a.relevance_score;
  });

  const page = Math.max(1, options.page || 1);
  const limit = Math.max(1, Math.min(100, options.limit || 25));
  const startIndex = (page - 1) * limit;
  const paginated = scoredItems.slice(startIndex, startIndex + limit);

  return {
    query: options.q || '',
    total_results: scoredItems.length,
    page,
    limit,
    total_pages: Math.ceil(scoredItems.length / limit) || 1,
    results: paginated
  };
}
