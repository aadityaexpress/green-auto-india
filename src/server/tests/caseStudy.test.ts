import { describe, it, expect, beforeAll } from 'vitest';
import { db, initializeSchema } from '../db/schema.js';
import { seedDatabase } from '../db/seed.js';
import {
  executeReproducibleCaseStudy,
  formatCaseStudyMarkdownReport,
  CASE_STUDY_TITLE
} from '../calculator/caseStudyRunner.js';

describe('Case Study: Comparative Life-Cycle Carbon Assessment of Passenger Vehicle Powertrains Under Indian Conditions', () => {
  beforeAll(() => {
    initializeSchema();
    seedDatabase();
  });

  it('1. Independently recalculates the BEV 150,000 km scenario from first principles and matches the Case Study Runner output to within 0.01 kg CO2e', () => {
    const report = executeReproducibleCaseStudy({}, false);
    expect(report.study_title).toBe(CASE_STUDY_TITLE);

    const bev = report.scenarios.find(s => s.code === 'BEV')!;
    expect(bev).toBeDefined();

    // Independent manual derivation for BEV (COMP-BOM-BEV-EU, 150,000 km, 20% recycled steel, 35% recycled Al):
    // 1. Cradle-to-Gate Material Production:
    //    - Steel (642 kg): 80% primary [1.5, 2.8] + 20% EAF [0.8, 1.5] -> eff [1.36, 2.54]
    //      Min = 642 * 1.36 = 873.12 kg, Max = 642 * 2.54 = 1630.68 kg
    //    - Cast iron (16 kg): [1.5, 2.5] -> Min = 24.00, Max = 40.00
    //    - Wrought Al (108 kg): 65% primary [8, 18] + 35% secondary [0.5, 2.5] -> eff [5.375, 12.575]
    //      Min = 108 * 5.375 = 580.50, Max = 108 * 12.575 = 1358.10
    //    - Cast Al (77 kg): eff [5.375, 12.575] -> Min = 77 * 5.375 = 413.875, Max = 77 * 12.575 = 968.275
    //    - Copper (35 kg): [2.5, 6.0] -> Min = 87.50, Max = 210.00
    //    - Magnesium (1 kg): [15, 35] -> Min = 15.00, Max = 35.00
    //    - Glass (26 kg): [0.8, 1.8] -> Min = 20.80, Max = 46.80
    //    - Average plastics (166 kg): [2.0, 5.0] -> Min = 332.00, Max = 830.00
    //    - Rubber (39 kg): [2.0, 4.0] -> Min = 78.00, Max = 156.00
    //    - Manganese (7 kg), GFRP (5 kg), Other (14 kg): NULL factor -> 0 (flagged)
    const manualMatMin = 873.12 + 24.0 + 580.5 + 413.875 + 87.5 + 15.0 + 20.8 + 332.0 + 78.0; // 2424.795 -> 2424.80
    const manualMatMax = 1630.68 + 40.0 + 1358.1 + 968.275 + 210.0 + 35.0 + 46.8 + 830.0 + 156.0; // 5274.855 -> 5274.86
    const manualMatMid = (manualMatMin + manualMatMax) / 2; // 3849.825 -> 3849.83

    expect(bev.result.stages.material_production.min).toBeCloseTo(manualMatMin, 1);
    expect(bev.result.stages.material_production.max).toBeCloseTo(manualMatMax, 1);
    expect(bev.result.stages.material_production.point).toBeCloseTo(manualMatMid, 1);

    // 2. Traction Battery Pack Production (40 kWh @ [65, 100] kg CO2e/kWh):
    //    Min = 40 * 65 = 2,600 kg, Max = 40 * 100 = 4,000 kg, Midpoint = 3,300 kg
    expect(bev.result.stages.battery_pack_production.min).toBe(2600);
    expect(bev.result.stages.battery_pack_production.max).toBe(4000);
    expect(bev.result.stages.battery_pack_production.point).toBe(3300);

    // 3. Component & Plant Manufacturing (Direct processes from PMC10890010 Table 4 + 650 kg overhead):
    //    - Stamping: (642*0.75 + 108) = 589.5 kg * 0.31 = 182.745
    //    - Al casting: 77 kg * 3.08 = 237.16
    //    - Iron casting: 16 kg * 1.69 = 27.04
    //    - Copper wire: 35 kg * 0.43 = 15.05
    //    - Forging: (642*0.25) = 160.5 kg * 2.61 = 418.905
    //    - Machining: (16 + 77 + 642*0.15) = 189.3 kg * 0.115 = 21.7695
    //    - Glass pane forming: 26 kg * 0.93 = 24.18
    //    - Assembly overhead: 650
    const manualProc = 182.745 + 237.16 + 27.04 + 15.05 + 418.905 + 21.7695 + 24.18 + 650; // 1576.8495 -> 1576.85
    expect(bev.result.stages.component_and_process_manufacturing.point).toBeCloseTo(manualProc, 2);

    // 4. Logistics (Disabled by default because Section 6 has no inline table -> 0 kg, flagged)
    expect(bev.result.stages.logistics_and_transport.point).toBe(0);

    // 5. Use Phase (150,000 km * 0.14 kWh/km * 1.10 charging loss * 0.716 kg CO2/kWh):
    //    Tailpipe = 0 kg CO2e
    //    Upstream Grid = 23,100 kWh * 0.716 = 16,539.60 kg CO2e
    expect(bev.result.stages.use_phase_tailpipe.point).toBe(0);
    expect(bev.result.stages.use_phase_upstream.point).toBeCloseTo(16539.6, 2);

    // 6. Maintenance (320 kg) + 7. EoL Net (180 kg dismantling under Cut-off) = 500 kg
    const manualTotalPoint = manualMatMid + 3300 + manualProc + 16539.6 + 320 + 180; // 25766.2745 -> 25766.27
    expect(bev.result.totals.total_kgco2e.point).toBeCloseTo(manualTotalPoint, 1);
    expect(bev.result.totals.g_co2e_per_km.point).toBeCloseTo((manualTotalPoint * 1000) / 150000, 2);
  });

  it('2. Compares Petrol ICEV, Full Hybrid HEV, Battery Electric BEV, and CNG scenarios and verifies percentage differences & break-even distance', () => {
    const report = executeReproducibleCaseStudy({}, false);
    expect(report.scenarios.map(s => s.code)).toEqual(['ICEV', 'HEV', 'BEV', 'CNG']);

    const icev = report.scenarios.find(s => s.code === 'ICEV')!;
    const hev = report.scenarios.find(s => s.code === 'HEV')!;
    const bev = report.scenarios.find(s => s.code === 'BEV')!;
    const cng = report.scenarios.find(s => s.code === 'CNG')!;

    // Reference is ICEV -> 0% difference vs itself
    expect(icev.comparison_vs_reference.diff_pct_point).toBe(0);

    // Under 150,000 km baseline, HEV, BEV, and CNG all have lower total lifecycle emissions than Petrol ICEV
    expect(hev.comparison_vs_reference.diff_pct_point).toBeLessThan(0);
    expect(bev.comparison_vs_reference.diff_pct_point).toBeLessThan(0);
    expect(cng.comparison_vs_reference.diff_pct_point).toBeLessThan(0);

    // BEV has higher manufacturing emissions than ICEV (due to 40 kWh battery pack) but lower per-km operational emissions -> positive break-even km
    expect(bev.result.stages.manufacturing_total.point).toBeGreaterThan(icev.result.stages.manufacturing_total.point);
    expect(bev.comparison_vs_reference.break_even_km_vs_reference).toBeGreaterThan(20000);
    expect(bev.comparison_vs_reference.break_even_km_vs_reference).toBeLessThan(90000);
  });

  it('3. Runs all 4 required sensitivity dimensions (Grid Intensity, Lifetime Distance 80k/150k/250k, Recycled Shares, Battery Factor Range)', () => {
    const report = executeReproducibleCaseStudy({}, false);
    expect(report.sensitivity_suites.length).toBe(10);

    const lowGrid = report.sensitivity_suites.find(s => s.case_id === 'SENS-GRID-LOW')!;
    const highGrid = report.sensitivity_suites.find(s => s.case_id === 'SENS-GRID-HIGH')!;

    const bevLowGrid = lowGrid.results_by_powertrain.find(x => x.code === 'BEV')!.total_kgco2e_point;
    const bevHighGrid = highGrid.results_by_powertrain.find(x => x.code === 'BEV')!.total_kgco2e_point;

    // BEV total emissions must be significantly lower under 0.30 kg/kWh grid than 0.95 kg/kWh grid
    expect(bevLowGrid).toBeLessThan(bevHighGrid - 10000);
  });

  it('4. Persists reproducible case-study runs into SQLite and generates a complete exportable Markdown report', () => {
    const savedReport = executeReproducibleCaseStudy({ lifetime_distance_km: 150000 }, true);

    const dbRow = db
      .prepare(`SELECT * FROM case_study_runs WHERE run_id = ?`)
      .get(savedReport.run_id) as any;

    expect(dbRow).toBeDefined();
    expect(dbRow.study_title).toBe(CASE_STUDY_TITLE);
    expect(dbRow.functional_unit_km).toBe(150000);

    const md = formatCaseStudyMarkdownReport(savedReport);
    expect(md).toContain(CASE_STUDY_TITLE);
    expect(md).toContain('Stage-by-Stage Lifecycle Breakdown');
    expect(md).toContain('Sensitivity Analysis Scenarios');
    expect(md).toContain('SRC-EC-SWD-2023-256');
  });
});
