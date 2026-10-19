import { describe, it, expect, beforeAll } from 'vitest';
import { db, initializeSchema } from '../db/schema.js';
import { seedDatabase } from '../db/seed.js';
import { calculateVehicleLCA } from '../calculator/lcaEngine.js';

describe('End-to-End Mathematical & Scientific Validation of the Lifecycle Calculator', () => {
  beforeAll(() => {
    initializeSchema();
    seedDatabase();
  });

  it('1. Validates exact EU SWD(2023) 256 ICEV BOM (1,137 kg) + Section 2 screening ranges + Section 4 direct processes against manual math', () => {
    // Fetch actual ICEV BOM from SQLite database
    const bomRows = db.prepare(`
      SELECT cm.*, m.factor_min, m.factor_max, m.factor_value
      FROM component_materials cm
      LEFT JOIN materials m ON cm.material_id = m.material_id
      WHERE cm.component_id = 'COMP-BOM-ICEV-EU'
    `).all() as any[];

    expect(bomRows.length).toBe(12);
    const totalBomMass = bomRows.reduce((s, r) => s + r.mass_kg, 0);
    // In EU SWD(2023) 256 Section 3 Table, the 12 integer-rounded rows for ICEV sum to 1,138 kg (653+101+40+79+14+5+8+24+159+41+9+5) while the printed Total row is 1,137 kg due to individual row rounding.
    expect(totalBomMass).toBe(1138);

    // Pure primary screening ranges (0% recycled override) to verify exact PDF Section 2 bands:
    // Steel: 653 kg * [1.5, 2.8] = [979.5, 1828.4]
    // Cast iron: 101 kg * [1.5, 2.5] = [151.5, 252.5]
    // Wrought Al: 40 kg * [8.0, 18.0] = [320.0, 720.0]
    // Cast Al: 79 kg * [8.0, 18.0] = [632.0, 1422.0]
    // Copper: 14 kg * [2.5, 6.0] = [35.0, 84.0]
    // Magnesium: 5 kg * [15.0, 35.0] = [75.0, 175.0]
    // Manganese: 8 kg * [NULL] -> Flagged & excluded (0)
    // Glass: 24 kg * [0.8, 1.8] = [19.2, 43.2]
    // Average plastics: 159 kg * [2.0, 5.0] = [318.0, 795.0]
    // Rubber: 41 kg * [2.0, 4.0] = [82.0, 164.0]
    // GFRP: 9 kg * [NULL] -> Flagged & excluded (0)
    // Other: 5 kg * [NULL] -> Flagged & excluded (0)
    // Manual Sum Min = 979.5 + 151.5 + 320 + 632 + 35 + 75 + 19.2 + 318 + 82 = 2612.2 kg CO2e
    // Manual Sum Max = 1828.4 + 252.5 + 720 + 1422 + 84 + 175 + 43.2 + 795 + 164 = 5484.1 kg CO2e
    // Manual Midpoint = (2612.2 + 5484.1) / 2 = 4048.15 kg CO2e

    const res = calculateVehicleLCA({
      scenario_name: 'Manual Verification — ICEV 1,137 kg Baseline',
      powertrain: 'Petrol (ICEV)',
      lifetime_distance_km: 150000,
      materials_bom: bomRows.map(r => ({
        material_id: r.material_id || 'MAT-OTHER',
        material_name: r.material_name,
        mass_kg: r.mass_kg,
        factor_min: r.factor_min,
        factor_max: r.factor_max,
        factor_kgco2e_per_kg: r.factor_value,
        recycled_share_pct: 0
      })),
      manufacturing_processes: [
        {
          process_id: 'PROC-STAMPING',
          process_name: 'Stamping',
          activity_quantity: 529.75, // 653*0.75 + 40
          reference_unit: 'kg processed',
          emissions_kgco2e_per_unit: 0.31
        },
        {
          process_id: 'PROC-ALU-CASTING',
          process_name: 'Aluminium shape casting',
          activity_quantity: 79,
          reference_unit: 'kg processed',
          emissions_kgco2e_per_unit: 3.08
        },
        {
          process_id: 'PROC-IRON-CASTING',
          process_name: 'Iron casting / iron process',
          activity_quantity: 101,
          reference_unit: 'kg processed',
          emissions_kgco2e_per_unit: 1.69
        }
      ],
      assembly_overhead_per_vehicle_kgco2e: 650,
      logistics_flows: [
        {
          mode_name: 'Road Freight',
          freight_tonnes: 1.137,
          distance_km: 800,
          factor_kgco2e_per_tonne_km: 0.065
        }
      ],
      fuel_economy_km_per_unit: 18.5,
      fuel_unit: 'L',
      fuel_tailpipe_factor_kgco2e_per_unit: 2.31,
      fuel_upstream_factor_kgco2e_per_unit: 0.58,
      maintenance_kgco2e: 450,
      eol_allocation_method: 'Cut-off (Recycled Content)',
      eol_dismantling_processing_kgco2e: 180
    });

    expect(res.stages.material_production.min).toBeCloseTo(2612.2, 2);
    expect(res.stages.material_production.max).toBeCloseTo(5484.1, 2);
    expect(res.stages.material_production.point).toBeCloseTo(4048.15, 2);

    // Verify 3 BOM materials without Section 2 screening factors (Manganese, GFRP, Other) generated explicit warnings
    expect(res.missing_data_warnings.filter(w => w.includes('has no emission factor')).length).toBe(3);

    // Direct process math: 529.75*0.31 (164.2225) + 79*3.08 (243.32) + 101*1.69 (170.69) + 650 overhead = 1228.2325
    expect(res.stages.component_and_process_manufacturing.point).toBeCloseTo(1228.23, 2);

    // Logistics math: 1.137 * 800 * 0.065 = 59.124 -> 59.12
    expect(res.stages.logistics_and_transport.point).toBeCloseTo(59.12, 2);

    // Use-phase math: 150,000 / 18.5 = 8108.1081 L
    // Tailpipe TTW = 8108.1081 * 2.31 = 18729.73 kg CO2e
    // Upstream WTT = 8108.1081 * 0.58 = 4702.70 kg CO2e
    expect(res.stages.use_phase_tailpipe.point).toBeCloseTo(18729.73, 2);
    expect(res.stages.use_phase_upstream.point).toBeCloseTo(4702.70, 2);
    expect(res.stages.use_phase_total.point).toBeCloseTo(23432.43, 2);

    // Total Lifecycle Point = 4048.15 + 1228.2325 + 59.124 + 23432.4324 + 450 + 180 = 29397.94 kg CO2e
    expect(res.totals.total_kgco2e.point).toBeCloseTo(29397.94, 1);
    // g CO2e / km = 29397.94 * 1000 / 150000 = 195.99 g/km
    expect(res.totals.g_co2e_per_km.point).toBeCloseTo(195.99, 2);
  });

  it('2. Validates PHEV Utility Factor (UF) split and FCEV IEA 2024 Hydrogen range propagation', () => {
    // PHEV: 150,000 km with UF = 0.60 -> 90,000 km electric, 60,000 km combustion
    const phevRes = calculateVehicleLCA({
      scenario_name: 'PHEV UF Split Verification',
      powertrain: 'Plug-in Hybrid (PHEV)',
      lifetime_distance_km: 150000,
      materials_bom: [{ material_id: 'MAT-STEEL-AUTO', material_name: 'Steel', mass_kg: 621, factor_min: 1.5, factor_max: 2.8 }],
      battery_capacity_kwh: 14,
      battery_factor_kgco2e_per_kwh_min: 65,
      battery_factor_kgco2e_per_kwh_max: 100,
      electric_utility_factor: 0.6,
      electricity_consumption_kwh_per_km: 0.15,
      charging_loss_pct: 10,
      grid_factor_kgco2e_per_kwh: 0.70,
      fuel_economy_km_per_unit: 20,
      fuel_unit: 'L',
      fuel_tailpipe_factor_kgco2e_per_unit: 2.31,
      fuel_upstream_factor_kgco2e_per_unit: 0.59,
      eol_allocation_method: 'Cut-off (Recycled Content)'
    });

    // Electric upstream: 90,000 * 0.15 * 1.10 * 0.70 = 10,395 kg CO2e
    // Combustion fuel: 60,000 / 20 = 3,000 L
    // Combustion tailpipe (TTW): 3,000 * 2.31 = 6,930 kg CO2e
    // Combustion upstream (WTT): 3,000 * 0.59 = 1,770 kg CO2e
    // Total upstream (Grid + WTT fuel) = 10,395 + 1,770 = 12,165 kg CO2e
    expect(phevRes.stages.use_phase_tailpipe.point).toBeCloseTo(6930, 2);
    expect(phevRes.stages.use_phase_upstream.point).toBeCloseTo(12165, 2);
    expect(phevRes.stages.use_phase_total.point).toBeCloseTo(19095, 2);

    // FCEV: 150,000 km at 100 km/kg H2 = 1,500 kg H2 consumed
    // IEA 2024 Unabated Natural Gas H2 range: 10–12 kg CO2e/kg H2 -> [15,000, 18,000] kg CO2e
    const fcevRes = calculateVehicleLCA({
      scenario_name: 'FCEV IEA 2024 H2 Verification',
      powertrain: 'Hydrogen Fuel Cell (FCEV)',
      lifetime_distance_km: 150000,
      materials_bom: [{ material_id: 'MAT-STEEL-AUTO', material_name: 'Steel', mass_kg: 642, factor_min: 1.5, factor_max: 2.8 }],
      fuel_economy_km_per_unit: 100,
      fuel_unit: 'kg',
      fuel_upstream_factor_min: 10,
      fuel_upstream_factor_max: 12,
      eol_allocation_method: 'Cut-off (Recycled Content)'
    });

    expect(fcevRes.stages.use_phase_tailpipe.point).toBe(0);
    expect(fcevRes.stages.use_phase_upstream.min).toBe(15000);
    expect(fcevRes.stages.use_phase_upstream.max).toBe(18000);
    expect(fcevRes.stages.use_phase_upstream.point).toBe(16500);
  });

  it('3. Validates End-of-Life (EoL) Recycling Double-Counting Guard and Logistics Supplier Guard', () => {
    // When BOM already includes recycled content (recycled_share_pct > 0) AND user selects Avoided Burden credit,
    // the calculator must suppress the EoL credit to prevent double-counting recycling benefits.
    const res = calculateVehicleLCA({
      scenario_name: 'Recycling & Logistics Double-Counting Guard Test',
      powertrain: 'Battery Electric (BEV)',
      lifetime_distance_km: 150000,
      materials_bom: [
        {
          material_id: 'MAT-ALU-PRIMARY',
          material_name: 'Wrought aluminium',
          mass_kg: 108,
          factor_min: 8.0,
          factor_max: 18.0,
          recycled_share_pct: 50,
          recycled_factor_min: 0.5,
          recycled_factor_max: 2.5
        }
      ],
      logistics_flows: [
        {
          mode_name: 'Inbound Supplier Road Transport',
          freight_tonnes: 1.2,
          distance_km: 1000,
          factor_kgco2e_per_tonne_km: 0.07,
          already_in_supplier_dataset: true
        }
      ],
      electricity_consumption_kwh_per_km: 0.14,
      grid_factor_kgco2e_per_kwh: 0.716,
      eol_allocation_method: 'Avoided Burden (End-of-Life Recycling Credit)',
      eol_dismantling_processing_kgco2e: 200,
      eol_recycling_credit_kgco2e: 1500
    });

    // 50% primary Al [8, 18] + 50% secondary Al [0.5, 2.5] -> effective factor [4.25, 10.25], midpoint 7.25
    // 108 kg * 4.25 = 459 min, 108 * 10.25 = 1107 max, 108 * 7.25 = 783 point
    expect(res.stages.material_production.min).toBeCloseTo(459, 2);
    expect(res.stages.material_production.max).toBeCloseTo(1107, 2);
    expect(res.stages.material_production.point).toBeCloseTo(783, 2);

    // Logistics must be 0 because already_in_supplier_dataset = true
    expect(res.stages.logistics_and_transport.point).toBe(0);
    expect(res.double_counting_guards_triggered.some(g => g.includes('LOGISTICS DOUBLE-COUNTING GUARD'))).toBe(true);

    // EoL net must be only dismantling (200 kg), with the 1,500 kg avoided-burden credit suppressed!
    expect(res.stages.end_of_life_net.point).toBe(200);
    expect(res.double_counting_guards_triggered.some(g => g.includes('RECYCLING DOUBLE-COUNTING GUARD'))).toBe(true);
  });
});
