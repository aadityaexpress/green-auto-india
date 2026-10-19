import { describe, it, expect } from 'vitest';
import { calculateVehicleLCA } from '../calculator/lcaEngine.js';

describe('Green Auto India — Lifecycle Assessment (LCA) Calculation Engine', () => {
  it('1. Propagates min/max screening ranges for BOM materials accurately', () => {
    const res = calculateVehicleLCA({
      scenario_name: 'ICEV Material Screening Test',
      powertrain: 'Petrol (ICEV)',
      lifetime_distance_km: 150000,
      materials_bom: [
        {
          material_id: 'MAT-STEEL-AUTO',
          material_name: 'Carbon steel / automotive steel',
          mass_kg: 653,
          factor_min: 1.5,
          factor_max: 2.8
        },
        {
          material_id: 'MAT-ALU-PRIMARY',
          material_name: 'Aluminium, primary',
          mass_kg: 100,
          factor_min: 8.0,
          factor_max: 18.0
        }
      ],
      fuel_economy_km_per_unit: 18,
      fuel_unit: 'L',
      fuel_tailpipe_factor_kgco2e_per_unit: 2.31,
      fuel_upstream_factor_kgco2e_per_unit: 0.55,
      eol_allocation_method: 'Cut-off (Recycled Content)'
    });

    // Steel: 653 * 1.5 = 979.5 min, 653 * 2.8 = 1828.4 max
    // Al: 100 * 8 = 800 min, 100 * 18 = 1800 max
    // Total mat min = 1779.5, max = 3628.4
    expect(res.stages.material_production.min).toBeCloseTo(1779.5, 1);
    expect(res.stages.material_production.max).toBeCloseTo(3628.4, 1);
    expect(res.is_complete).toBe(true);
  });

  it('2. Prevents double-counting when published manufacturing footprint already includes materials', () => {
    const res = calculateVehicleLCA({
      scenario_name: 'Double Counting Guard Test',
      powertrain: 'Petrol (ICEV)',
      lifetime_distance_km: 150000,
      published_manufacturing_total_kgco2e: 5200,
      published_manufacturing_includes_materials: true,
      materials_bom: [
        {
          material_id: 'MAT-STEEL-AUTO',
          material_name: 'Steel',
          mass_kg: 653,
          factor_min: 1.5,
          factor_max: 2.8
        }
      ],
      fuel_economy_km_per_unit: 15,
      fuel_tailpipe_factor_kgco2e_per_unit: 2.31,
      fuel_upstream_factor_kgco2e_per_unit: 0.5,
      eol_allocation_method: 'Cut-off (Recycled Content)'
    });

    expect(res.stages.material_production.point).toBe(0);
    expect(res.stages.manufacturing_total.point).toBe(5200);
    expect(res.double_counting_guards_triggered.length).toBeGreaterThan(0);
    expect(res.double_counting_guards_triggered[0]).toContain('DOUBLE-COUNTING GUARD');
  });

  it('3. Blocks indiscriminate multiplication of allocated facility services (e.g. Painting 268 kg CO2/kg)', () => {
    const res = calculateVehicleLCA({
      scenario_name: 'Allocated Facility Guard Test',
      powertrain: 'Petrol (ICEV)',
      lifetime_distance_km: 150000,
      materials_bom: [
        { material_id: 'MAT-STEEL-AUTO', material_name: 'Steel', mass_kg: 653, factor_min: 1.5, factor_max: 2.8 }
      ],
      manufacturing_processes: [
        {
          process_id: 'PROC-STAMPING',
          process_name: 'Stamping',
          activity_quantity: 500,
          reference_unit: 'kg processed',
          emissions_kgco2e_per_unit: 0.31,
          is_allocated_facility_service: false
        },
        {
          process_id: 'PROC-PAINTING',
          process_name: 'Painting',
          activity_quantity: 1137, // User mistakenly passes full car mass
          reference_unit: 'kg processed',
          emissions_kgco2e_per_unit: 268,
          is_allocated_facility_service: true
        }
      ],
      fuel_economy_km_per_unit: 16,
      fuel_tailpipe_factor_kgco2e_per_unit: 2.31,
      fuel_upstream_factor_kgco2e_per_unit: 0.5,
      eol_allocation_method: 'Cut-off (Recycled Content)'
    });

    // Only Stamping (500 * 0.31 = 155) should be included; Painting (1137 * 268 = 304,716) must be blocked!
    expect(res.stages.component_and_process_manufacturing.point).toBeCloseTo(155, 1);
    expect(res.double_counting_guards_triggered.some(g => g.includes('PROCESS OVER-MULTIPLICATION GUARD'))).toBe(true);
  });

  it('4. Separates Tailpipe (TTW) and Upstream (WTT) emissions and calculates BEV use phase correctly', () => {
    const bevRes = calculateVehicleLCA({
      scenario_name: 'BEV Use Phase Test',
      powertrain: 'Battery Electric (BEV)',
      lifetime_distance_km: 150000,
      materials_bom: [
        { material_id: 'MAT-STEEL-AUTO', material_name: 'Steel', mass_kg: 642, factor_min: 1.5, factor_max: 2.8 }
      ],
      battery_capacity_kwh: 40,
      battery_factor_kgco2e_per_kwh_min: 65,
      battery_factor_kgco2e_per_kwh_max: 100,
      electricity_consumption_kwh_per_km: 0.14,
      charging_loss_pct: 10,
      grid_factor_kgco2e_per_kwh: 0.71,
      grid_fiscal_year_and_margin: 'CEA FY 2022-23 Weighted Average',
      eol_allocation_method: 'Cut-off (Recycled Content)'
    });

    // BEV tailpipe must be 0
    expect(bevRes.stages.use_phase_tailpipe.point).toBe(0);
    // BEV upstream = 150,000 * 0.14 * 1.10 * 0.71 = 16,401 kg CO2e
    expect(bevRes.stages.use_phase_upstream.point).toBeCloseTo(16401, 0);
    expect(bevRes.stages.battery_pack_production.min).toBe(2600);
    expect(bevRes.stages.battery_pack_production.max).toBe(4000);
  });

  it('5. Flags incomplete results when required use-phase inputs are missing without fabricating numbers', () => {
    const incompleteRes = calculateVehicleLCA({
      scenario_name: 'Incomplete BEV Scenario',
      powertrain: 'Battery Electric (BEV)',
      lifetime_distance_km: 150000,
      materials_bom: [
        { material_id: 'MAT-STEEL-AUTO', material_name: 'Steel', mass_kg: 642, factor_min: 1.5, factor_max: 2.8 }
      ],
      // Missing electricity_consumption_kwh_per_km and grid_factor_kgco2e_per_kwh
      eol_allocation_method: 'Cut-off (Recycled Content)'
    });

    expect(incompleteRes.is_complete).toBe(false);
    expect(incompleteRes.data_quality_label).toBe('Incomplete — Missing Required Inputs');
    expect(incompleteRes.missing_data_warnings.length).toBeGreaterThan(0);
  });
});
