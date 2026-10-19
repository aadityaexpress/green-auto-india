import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = process.env.DB_PATH || path.join(DB_DIR, 'green_auto_india.sqlite');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initializeSchema(database: Database.Database = db) {
  database.exec(`
    -- J. Sources and Data Provenance
    CREATE TABLE IF NOT EXISTS sources (
      source_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      publisher TEXT NOT NULL,
      publication_year INTEGER,
      url TEXT,
      accessed_on TEXT,
      page_table TEXT,
      geography TEXT NOT NULL,
      dataset_version TEXT,
      licence_access_notes TEXT,
      extraction_status TEXT NOT NULL DEFAULT 'Directly Extracted from PDF',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- A. Materials
    CREATE TABLE IF NOT EXISTS materials (
      material_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      grade_or_type TEXT,
      production_route TEXT NOT NULL,
      primary_or_recycled TEXT NOT NULL CHECK(primary_or_recycled IN ('Primary', 'Recycled/Secondary', 'Mixed/Unspecified', 'Pack/Assembly')),
      recycled_content_pct REAL,
      factor_value REAL,
      factor_min REAL,
      factor_max REAL,
      unit TEXT NOT NULL,
      geography TEXT NOT NULL,
      reference_year INTEGER,
      system_boundary TEXT NOT NULL,
      uncertainty_or_range TEXT,
      source_id TEXT NOT NULL REFERENCES sources(source_id),
      data_quality_status TEXT NOT NULL,
      notes_and_limitations TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- B. Vehicle Components & Representative Powertrain Material Compositions
    CREATE TABLE IF NOT EXISTS components (
      component_id TEXT PRIMARY KEY,
      component_name TEXT NOT NULL,
      component_category TEXT NOT NULL,
      applicable_powertrain TEXT NOT NULL,
      mass_kg REAL,
      material_composition_json TEXT NOT NULL,
      manufacturing_processes TEXT,
      geography TEXT NOT NULL,
      reference_year INTEGER,
      source_id TEXT NOT NULL REFERENCES sources(source_id),
      confidence_status TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Junction table: Component Materials (Many-to-Many)
    CREATE TABLE IF NOT EXISTS component_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      component_id TEXT NOT NULL REFERENCES components(component_id) ON DELETE CASCADE,
      material_id TEXT REFERENCES materials(material_id),
      material_name TEXT NOT NULL,
      mass_kg REAL,
      mass_fraction_pct REAL,
      notes TEXT
    );

    -- C. Vehicles and Variants (including Case-Study Archetypes & Named Retail Models)
    CREATE TABLE IF NOT EXISTS vehicles (
      vehicle_id TEXT PRIMARY KEY,
      manufacturer TEXT NOT NULL,
      model TEXT NOT NULL,
      variant TEXT NOT NULL,
      model_year INTEGER,
      powertrain TEXT NOT NULL CHECK(powertrain IN ('Petrol (ICEV)', 'Diesel (ICEV)', 'CNG', 'Full Hybrid (HEV)', 'Plug-in Hybrid (PHEV)', 'Battery Electric (BEV)', 'Hydrogen Fuel Cell (FCEV)')),
      body_type TEXT NOT NULL,
      kerb_mass_kg REAL,
      glider_reference_mass_kg REAL,
      fuel_consumption_value REAL,
      fuel_consumption_unit TEXT,
      electricity_consumption_kwh_per_km REAL,
      electric_utility_factor REAL,
      battery_capacity_kwh REAL,
      battery_chemistry TEXT,
      range_km REAL,
      test_cycle TEXT,
      material_coverage_notes TEXT,
      public_data_to_collect TEXT,
      manufacturing_emissions_approach TEXT,
      source_id TEXT NOT NULL REFERENCES sources(source_id),
      source_url TEXT,
      lca_data_status TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- D. Manufacturing Processes
    CREATE TABLE IF NOT EXISTS processes (
      process_id TEXT PRIMARY KEY,
      process_name TEXT NOT NULL,
      process_category TEXT NOT NULL,
      applicability TEXT NOT NULL,
      energy_consumption_mj REAL,
      process_emissions_kgco2e REAL,
      reference_unit TEXT NOT NULL,
      energy_source TEXT NOT NULL,
      geography TEXT NOT NULL,
      reference_year INTEGER,
      system_boundary TEXT NOT NULL,
      source_id TEXT NOT NULL REFERENCES sources(source_id),
      data_quality_status TEXT NOT NULL,
      is_allocated_facility_service INTEGER NOT NULL DEFAULT 0,
      limitations TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- E. Energy Sources and Emission Factors
    CREATE TABLE IF NOT EXISTS energy_factors (
      energy_id TEXT PRIMARY KEY,
      carrier TEXT NOT NULL,
      pathway TEXT NOT NULL,
      factor_value REAL,
      factor_min REAL,
      factor_max REAL,
      unit TEXT NOT NULL,
      geography TEXT NOT NULL,
      reference_year TEXT NOT NULL,
      lifecycle_boundary TEXT NOT NULL CHECK(lifecycle_boundary IN ('Tank-to-Wheel (Combustion Only)', 'Well-to-Tank (Upstream Production & Delivery)', 'Well-to-Wheel / Full Lifecycle', 'Generation Grid Mix', 'Cradle-to-Gate H2 Production')),
      factor_type_details TEXT,
      source_id TEXT NOT NULL REFERENCES sources(source_id),
      data_quality_status TEXT NOT NULL,
      critical_caveat TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- F. Transportation and Logistics
    CREATE TABLE IF NOT EXISTS logistics_factors (
      mode_id TEXT PRIMARY KEY,
      transport_mode TEXT NOT NULL,
      vehicle_or_ship_class TEXT NOT NULL,
      fuel_or_traction TEXT NOT NULL,
      distance_km REAL,
      freight_mass_tonnes REAL,
      load_factor_pct REAL,
      empty_running_notes TEXT,
      factor_kgco2e_per_tonne_km REAL,
      factor_min REAL,
      factor_max REAL,
      unit TEXT NOT NULL DEFAULT 'kg CO2e/tonne-km',
      geography TEXT NOT NULL,
      reference_year INTEGER,
      system_boundary TEXT NOT NULL,
      source_id TEXT NOT NULL REFERENCES sources(source_id),
      data_quality_status TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- G. Vehicle Use Phase Assumptions & Profiles
    CREATE TABLE IF NOT EXISTS use_phase_profiles (
      profile_id TEXT PRIMARY KEY,
      profile_name TEXT NOT NULL,
      applicable_powertrain TEXT NOT NULL,
      lifetime_distance_km REAL NOT NULL,
      annual_distance_km REAL NOT NULL,
      fuel_economy_value REAL,
      fuel_economy_unit TEXT,
      electricity_consumption_kwh_per_km REAL,
      electric_utility_factor REAL,
      maintenance_assumptions TEXT NOT NULL,
      replacement_parts_notes TEXT NOT NULL,
      operating_conditions TEXT NOT NULL,
      maintenance_emissions_kgco2e REAL,
      source_id TEXT NOT NULL REFERENCES sources(source_id),
      data_quality_status TEXT NOT NULL
    );

    -- H. End-of-Life Systems
    CREATE TABLE IF NOT EXISTS end_of_life_systems (
      eol_id TEXT PRIMARY KEY,
      system_name TEXT NOT NULL,
      applicable_material_or_vehicle TEXT NOT NULL,
      dismantling_process TEXT NOT NULL,
      recovery_rate_pct REAL,
      recycling_rate_pct REAL,
      process_energy_mj_per_kg REAL,
      process_emissions_kgco2e_per_kg REAL,
      allocation_method TEXT NOT NULL CHECK(allocation_method IN ('Cut-off (Recycled Content)', 'Avoided Burden (End-of-Life Recycling Credit)', '50/50 Allocation', 'System Expansion / Stated in Source')),
      recycling_credit_kgco2e_per_kg REAL,
      geography TEXT NOT NULL,
      reference_year INTEGER,
      source_id TEXT NOT NULL REFERENCES sources(source_id),
      data_quality_status TEXT NOT NULL,
      notes TEXT
    );

    -- I. Environmental Indicators
    CREATE TABLE IF NOT EXISTS environmental_indicators (
      indicator_id TEXT PRIMARY KEY,
      indicator_name TEXT NOT NULL,
      indicator_code TEXT NOT NULL,
      lcia_method TEXT NOT NULL,
      unit TEXT NOT NULL,
      scope_description TEXT NOT NULL,
      status_in_pack TEXT NOT NULL,
      source_id TEXT NOT NULL REFERENCES sources(source_id),
      notes TEXT
    );

    -- K. Calculation Results
    CREATE TABLE IF NOT EXISTS vehicle_lca_results (
      result_id TEXT PRIMARY KEY,
      scenario_name TEXT NOT NULL,
      vehicle_id TEXT REFERENCES vehicles(vehicle_id),
      functional_unit TEXT NOT NULL,
      lifetime_km REAL NOT NULL,
      material_production_kgco2e REAL NOT NULL,
      component_manufacturing_kgco2e REAL NOT NULL,
      manufacturing_total_kgco2e REAL NOT NULL,
      transport_kgco2e REAL NOT NULL,
      use_phase_tailpipe_kgco2e REAL NOT NULL,
      use_phase_upstream_kgco2e REAL NOT NULL,
      use_phase_total_kgco2e REAL NOT NULL,
      maintenance_kgco2e REAL NOT NULL,
      end_of_life_kgco2e REAL NOT NULL,
      total_kgco2e REAL NOT NULL,
      g_co2e_per_km REAL NOT NULL,
      double_counting_guard_applied INTEGER NOT NULL DEFAULT 1,
      assumptions_json TEXT NOT NULL,
      uncertainty_and_flags_json TEXT NOT NULL,
      data_quality_status TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Ingestion & Audit Reports
    CREATE TABLE IF NOT EXISTS import_reports (
      report_id TEXT PRIMARY KEY,
      import_source_name TEXT NOT NULL,
      import_type TEXT NOT NULL,
      total_rows_processed INTEGER NOT NULL,
      successful_imports INTEGER NOT NULL,
      skipped_rows INTEGER NOT NULL,
      duplicate_rows INTEGER NOT NULL,
      flagged_for_review INTEGER NOT NULL,
      details_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Reproducible Case Study Runs
    CREATE TABLE IF NOT EXISTS case_study_runs (
      run_id TEXT PRIMARY KEY,
      study_title TEXT NOT NULL,
      engine_version TEXT NOT NULL,
      functional_unit_km REAL NOT NULL,
      reference_powertrain TEXT NOT NULL,
      config_json TEXT NOT NULL,
      selected_factor_ids_json TEXT NOT NULL,
      source_ids_json TEXT NOT NULL,
      scenarios_results_json TEXT NOT NULL,
      sensitivity_matrix_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Indexes for fast filtering & search
    CREATE INDEX IF NOT EXISTS idx_materials_category ON materials(category);
    CREATE INDEX IF NOT EXISTS idx_materials_geography ON materials(geography);
    CREATE INDEX IF NOT EXISTS idx_materials_quality ON materials(data_quality_status);
    CREATE INDEX IF NOT EXISTS idx_components_powertrain ON components(applicable_powertrain);
    CREATE INDEX IF NOT EXISTS idx_vehicles_powertrain ON vehicles(powertrain);
    CREATE INDEX IF NOT EXISTS idx_processes_category ON processes(process_category);
    CREATE INDEX IF NOT EXISTS idx_energy_carrier ON energy_factors(carrier);
    CREATE INDEX IF NOT EXISTS idx_energy_geography ON energy_factors(geography);
  `);
}
