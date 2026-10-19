export interface MaterialMassInput {
  material_id: string;
  material_name: string;
  mass_kg: number;
  factor_kgco2e_per_kg?: number | null;
  factor_min?: number | null;
  factor_max?: number | null;
  recycled_share_pct?: number; // 0 to 100 (e.g. for aluminium primary vs recycled split)
  recycled_factor_min?: number | null;
  recycled_factor_max?: number | null;
  source_id?: string;
}

export interface ProcessActivityInput {
  process_id: string;
  process_name: string;
  activity_quantity: number; // e.g. kg processed
  reference_unit: string;
  emissions_kgco2e_per_unit: number;
  is_allocated_facility_service?: boolean;
  allow_allocated_override?: boolean;
}

export interface LogisticsInput {
  mode_name: string;
  freight_tonnes: number;
  distance_km: number;
  factor_kgco2e_per_tonne_km: number;
  already_in_supplier_dataset?: boolean;
}

export interface LcaScenarioInput {
  scenario_name: string;
  vehicle_id?: string;
  powertrain: 'Petrol (ICEV)' | 'Diesel (ICEV)' | 'CNG' | 'Full Hybrid (HEV)' | 'Plug-in Hybrid (PHEV)' | 'Battery Electric (BEV)' | 'Hydrogen Fuel Cell (FCEV)';
  lifetime_distance_km: number;

  // Manufacturing Stage Options
  published_manufacturing_total_kgco2e?: number | null;
  published_manufacturing_includes_materials?: boolean;
  materials_bom?: MaterialMassInput[];
  manufacturing_processes?: ProcessActivityInput[];
  assembly_overhead_per_vehicle_kgco2e?: number;

  // Battery Pack Manufacturing (for BEV / PHEV / HEV / FCEV)
  battery_capacity_kwh?: number | null;
  battery_factor_kgco2e_per_kwh_min?: number | null;
  battery_factor_kgco2e_per_kwh_max?: number | null;
  battery_factor_kgco2e_per_kwh_point?: number | null;

  // Logistics Stage
  logistics_flows?: LogisticsInput[];

  // Use Phase Stage
  fuel_economy_km_per_unit?: number | null; // km/L for petrol/diesel, km/kg for CNG/H2
  fuel_unit?: 'L' | 'kg';
  fuel_tailpipe_factor_kgco2e_per_unit?: number | null; // TTW
  fuel_upstream_factor_kgco2e_per_unit?: number | null; // WTT
  fuel_upstream_factor_min?: number | null;
  fuel_upstream_factor_max?: number | null;

  electricity_consumption_kwh_per_km?: number | null;
  charging_loss_pct?: number; // e.g., 10%
  grid_factor_kgco2e_per_kwh?: number | null;
  grid_factor_min?: number | null;
  grid_factor_max?: number | null;
  grid_fiscal_year_and_margin?: string;

  electric_utility_factor?: number; // 0 for ICEV/HEV, 0..1 for PHEV, 1 for BEV

  // Maintenance & Replacement
  maintenance_kgco2e?: number;

  // End-of-Life (EoL)
  eol_allocation_method: 'Cut-off (Recycled Content)' | 'Avoided Burden (End-of-Life Recycling Credit)';
  eol_dismantling_processing_kgco2e?: number;
  eol_recycling_credit_kgco2e?: number; // Negative or positive magnitude of credit
}

export interface StageRange {
  point: number;
  min: number;
  max: number;
}

export interface LcaCalculationResult {
  scenario_name: string;
  functional_unit: string;
  lifetime_distance_km: number;
  powertrain: string;
  is_complete: boolean;
  data_quality_label: 'Modelled Scenario (Using Screening Ranges & User Inputs)' | 'Published + Modelled Hybrid' | 'Incomplete — Missing Required Inputs';

  stages: {
    material_production: StageRange;
    battery_pack_production: StageRange;
    component_and_process_manufacturing: StageRange;
    manufacturing_total: StageRange;
    logistics_and_transport: StageRange;
    use_phase_tailpipe: StageRange;
    use_phase_upstream: StageRange;
    use_phase_total: StageRange;
    maintenance: StageRange;
    end_of_life_net: StageRange;
  };

  totals: {
    total_kgco2e: StageRange;
    g_co2e_per_km: StageRange;
  };

  double_counting_guards_triggered: string[];
  missing_data_warnings: string[];
  methodology_notes: string[];
  sensitivity_analysis: {
    parameter: string;
    low_case_total_kgco2e: number;
    high_case_total_kgco2e: number;
    swing_kgco2e: number;
  }[];
}

export function calculateVehicleLCA(input: LcaScenarioInput): LcaCalculationResult {
  const guardsTriggered: string[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];

  if (input.lifetime_distance_km <= 0) {
    throw new Error('Lifetime distance must be greater than 0 km.');
  }

  // 1. Material Production Stage
  let matMin = 0;
  let matMax = 0;
  let matPoint = 0;

  const hasPublishedMfgWithMaterials =
    typeof input.published_manufacturing_total_kgco2e === 'number' &&
    input.published_manufacturing_total_kgco2e > 0 &&
    input.published_manufacturing_includes_materials !== false;

  if (hasPublishedMfgWithMaterials) {
    if (input.materials_bom && input.materials_bom.length > 0) {
      guardsTriggered.push(
        'DOUBLE-COUNTING GUARD: A published vehicle manufacturing footprint that already includes cradle-to-gate material production was provided. Individual BOM material production emissions were set to 0 in the total sum to prevent double counting (Section 1 & Section 11).'
      );
    }
  } else if (input.materials_bom && input.materials_bom.length > 0) {
    for (const item of input.materials_bom) {
      if (item.mass_kg <= 0) continue;

      const hasExact = typeof item.factor_kgco2e_per_kg === 'number';
      const hasRange = typeof item.factor_min === 'number' && typeof item.factor_max === 'number';

      if (!hasExact && !hasRange) {
        warnings.push(
          `Material "${item.material_name}" (${item.mass_kg} kg) has no emission factor in the Reference Data Pack (e.g. Manganese, GFRP, or Other). Excluded from material sum and flagged.`
        );
        continue;
      }

      const recShare = Math.min(100, Math.max(0, item.recycled_share_pct ?? 0)) / 100;

      if (recShare > 0 && typeof item.recycled_factor_min === 'number' && typeof item.recycled_factor_max === 'number') {
        const pMin = item.factor_min ?? item.factor_kgco2e_per_kg ?? 0;
        const pMax = item.factor_max ?? item.factor_kgco2e_per_kg ?? 0;
        const effMin = (1 - recShare) * pMin + recShare * item.recycled_factor_min;
        const effMax = (1 - recShare) * pMax + recShare * item.recycled_factor_max;
        const effMid = (effMin + effMax) / 2;

        matMin += item.mass_kg * effMin;
        matMax += item.mass_kg * effMax;
        matPoint += item.mass_kg * effMid;
      } else if (hasExact) {
        const val = item.factor_kgco2e_per_kg!;
        const fMin = item.factor_min ?? val;
        const fMax = item.factor_max ?? val;
        matMin += item.mass_kg * fMin;
        matMax += item.mass_kg * fMax;
        matPoint += item.mass_kg * val;
      } else if (hasRange) {
        const fMin = item.factor_min!;
        const fMax = item.factor_max!;
        const fMid = (fMin + fMax) / 2;
        matMin += item.mass_kg * fMin;
        matMax += item.mass_kg * fMax;
        matPoint += item.mass_kg * fMid;
      }
    }
    notes.push('Cradle-to-gate material emissions calculated from BOM masses × screening factor bands (min, midpoint, max).');
  } else {
    warnings.push('No material BOM or published manufacturing footprint supplied.');
  }

  // 2. Traction Battery Pack Production Stage
  let batMin = 0;
  let batMax = 0;
  let batPoint = 0;

  if (input.battery_capacity_kwh && input.battery_capacity_kwh > 0) {
    const bMin = input.battery_factor_kgco2e_per_kwh_min ?? input.battery_factor_kgco2e_per_kwh_point;
    const bMax = input.battery_factor_kgco2e_per_kwh_max ?? input.battery_factor_kgco2e_per_kwh_point;
    const bPt = input.battery_factor_kgco2e_per_kwh_point ?? (typeof bMin === 'number' && typeof bMax === 'number' ? (bMin + bMax) / 2 : null);

    if (typeof bMin === 'number' && typeof bMax === 'number' && typeof bPt === 'number') {
      batMin = input.battery_capacity_kwh * bMin;
      batMax = input.battery_capacity_kwh * bMax;
      batPoint = input.battery_capacity_kwh * bPt;
      notes.push(`Traction battery pack (${input.battery_capacity_kwh} kWh) modelled using chemistry/pack-specific kWh factor.`);
    } else {
      warnings.push(
        `Vehicle has a ${input.battery_capacity_kwh} kWh traction battery, but no chemistry-specific pack emission factor (kg CO2e/kWh) was provided. Section 2 requires a chemistry/pack-specific factor (e.g. BatPaC 5.2).`
      );
    }
  }

  // 3. Component & Process Manufacturing Stage
  let procPoint = 0;
  if (typeof input.published_manufacturing_total_kgco2e === 'number' && input.published_manufacturing_total_kgco2e > 0) {
    procPoint = input.published_manufacturing_total_kgco2e;
    notes.push('Using published total vehicle manufacturing footprint.');
  } else {
    if (input.manufacturing_processes && input.manufacturing_processes.length > 0) {
      for (const proc of input.manufacturing_processes) {
        if (proc.activity_quantity <= 0) continue;
        if (proc.is_allocated_facility_service && !proc.allow_allocated_override) {
          guardsTriggered.push(
            `PROCESS OVER-MULTIPLICATION GUARD: Process "${proc.process_name}" (${proc.emissions_kgco2e_per_unit} kg CO2/unit) is flagged as an allocated facility service in PMC10890010 Table 4. Indiscriminate multiplication by mass (${proc.activity_quantity} kg) was blocked (Section 4).`
          );
          continue;
        }
        procPoint += proc.activity_quantity * proc.emissions_kgco2e_per_unit;
      }
    }
    if (typeof input.assembly_overhead_per_vehicle_kgco2e === 'number' && input.assembly_overhead_per_vehicle_kgco2e > 0) {
      procPoint += input.assembly_overhead_per_vehicle_kgco2e;
      notes.push(`Included plant-level assembly/paint/welding overhead of ${input.assembly_overhead_per_vehicle_kgco2e} kg CO2e/vehicle.`);
    }
  }

  const mfgMin = matMin + batMin + procPoint;
  const mfgMax = matMax + batMax + procPoint;
  const mfgPoint = matPoint + batPoint + procPoint;

  // 4. Logistics & Freight Transport Stage
  let logPoint = 0;
  if (input.logistics_flows && input.logistics_flows.length > 0) {
    for (const flow of input.logistics_flows) {
      if (flow.already_in_supplier_dataset) {
        guardsTriggered.push(
          `LOGISTICS DOUBLE-COUNTING GUARD: Transport flow "${flow.mode_name}" was flagged as already included in cradle-to-gate supplier datasets and excluded from separate summation (Section 6).`
        );
        continue;
      }
      if (flow.freight_tonnes > 0 && flow.distance_km > 0 && flow.factor_kgco2e_per_tonne_km >= 0) {
        logPoint += flow.freight_tonnes * flow.distance_km * flow.factor_kgco2e_per_tonne_km;
      }
    }
  }

  // 5. Vehicle Use Phase Stage (Tailpipe TTW vs Upstream WTT separated)
  let useTailpipePoint = 0;
  let useUpstreamMin = 0;
  let useUpstreamMax = 0;
  let useUpstreamPoint = 0;
  let isUsePhaseComplete = true;

  const ptrain = input.powertrain;

  if (ptrain === 'Battery Electric (BEV)') {
    if (
      typeof input.electricity_consumption_kwh_per_km === 'number' &&
      input.electricity_consumption_kwh_per_km > 0 &&
      (typeof input.grid_factor_kgco2e_per_kwh === 'number' ||
        (typeof input.grid_factor_min === 'number' && typeof input.grid_factor_max === 'number'))
    ) {
      const lossMultiplier = 1 + Math.max(0, input.charging_loss_pct ?? 0) / 100;
      const totalKwh = input.lifetime_distance_km * input.electricity_consumption_kwh_per_km * lossMultiplier;

      const gPt =
        input.grid_factor_kgco2e_per_kwh ??
        ((input.grid_factor_min! + input.grid_factor_max!) / 2);
      const gMin = input.grid_factor_min ?? gPt;
      const gMax = input.grid_factor_max ?? gPt;

      useTailpipePoint = 0; // BEV has zero tailpipe emissions
      useUpstreamPoint = totalKwh * gPt;
      useUpstreamMin = totalKwh * gMin;
      useUpstreamMax = totalKwh * gMax;

      notes.push(
        `BEV Use Phase: ${input.lifetime_distance_km.toLocaleString()} km × ${input.electricity_consumption_kwh_per_km} kWh/km (charging loss ${input.charging_loss_pct ?? 0}%) × Grid Factor ${gPt} kg CO2e/kWh (${input.grid_fiscal_year_and_margin || 'User/CEA Scenario'}).`
      );
    } else {
      isUsePhaseComplete = false;
      warnings.push(
        'Missing BEV electricity consumption (kWh/km) or Indian grid emission factor (kg CO2/kWh from CEA Baseline Database). Use-phase emissions could not be completed.'
      );
    }
  } else if (ptrain === 'Plug-in Hybrid (PHEV)') {
    const uf = Math.min(1, Math.max(0, input.electric_utility_factor ?? 0.5));
    const elecKm = input.lifetime_distance_km * uf;
    const combKm = input.lifetime_distance_km * (1 - uf);

    if (
      typeof input.electricity_consumption_kwh_per_km === 'number' &&
      typeof input.grid_factor_kgco2e_per_kwh === 'number' &&
      typeof input.fuel_economy_km_per_unit === 'number' &&
      input.fuel_economy_km_per_unit > 0 &&
      typeof input.fuel_tailpipe_factor_kgco2e_per_unit === 'number'
    ) {
      const lossMultiplier = 1 + Math.max(0, input.charging_loss_pct ?? 0) / 100;
      const elecEmissions = elecKm * input.electricity_consumption_kwh_per_km * lossMultiplier * input.grid_factor_kgco2e_per_kwh;

      const fuelUsed = combKm / input.fuel_economy_km_per_unit;
      const combTailpipe = fuelUsed * input.fuel_tailpipe_factor_kgco2e_per_unit;
      const wttFactor = input.fuel_upstream_factor_kgco2e_per_unit ?? 0;
      const combUpstream = fuelUsed * wttFactor;

      if (!input.fuel_upstream_factor_kgco2e_per_unit) {
        warnings.push('PHEV fuel upstream (Well-to-Tank) factor is 0 or omitted; do not compare combustion-only petrol with lifecycle electricity (Section 5).');
      }

      useTailpipePoint = combTailpipe;
      useUpstreamPoint = elecEmissions + combUpstream;
      useUpstreamMin = useUpstreamPoint;
      useUpstreamMax = useUpstreamPoint;
      notes.push(`PHEV split use phase: ${(uf * 100).toFixed(0)}% electric km (${elecKm.toLocaleString()} km) and ${((1 - uf) * 100).toFixed(0)}% combustion km (${combKm.toLocaleString()} km).`);
    } else {
      isUsePhaseComplete = false;
      warnings.push('PHEV requires electric consumption, grid factor, combustion fuel economy, and fuel factors.');
    }
  } else if (ptrain === 'Hydrogen Fuel Cell (FCEV)') {
    if (
      typeof input.fuel_economy_km_per_unit === 'number' &&
      input.fuel_economy_km_per_unit > 0 &&
      (typeof input.fuel_upstream_factor_kgco2e_per_unit === 'number' ||
        (typeof input.fuel_upstream_factor_min === 'number' && typeof input.fuel_upstream_factor_max === 'number'))
    ) {
      const totalH2Kg = input.lifetime_distance_km / input.fuel_economy_km_per_unit;
      const hPt =
        input.fuel_upstream_factor_kgco2e_per_unit ??
        ((input.fuel_upstream_factor_min! + input.fuel_upstream_factor_max!) / 2);
      const hMin = input.fuel_upstream_factor_min ?? hPt;
      const hMax = input.fuel_upstream_factor_max ?? hPt;

      useTailpipePoint = 0; // Water vapour tailpipe
      useUpstreamPoint = totalH2Kg * hPt;
      useUpstreamMin = totalH2Kg * hMin;
      useUpstreamMax = totalH2Kg * hMax;

      notes.push(
        `FCEV Use Phase: ${totalH2Kg.toFixed(1)} kg H2 consumed over ${input.lifetime_distance_km.toLocaleString()} km × H2 production factor (${hMin}–${hMax} kg CO2e/kg H2, IEA 2024).`
      );
    } else {
      isUsePhaseComplete = false;
      warnings.push('FCEV requires hydrogen fuel economy (km/kg H2) and hydrogen production pathway factor (e.g. IEA 2024 10–12 or 22–26 kg CO2e/kg H2).');
    }
  } else {
    // ICEV (Petrol / Diesel), CNG, Full Hybrid (HEV)
    if (
      typeof input.fuel_economy_km_per_unit === 'number' &&
      input.fuel_economy_km_per_unit > 0 &&
      typeof input.fuel_tailpipe_factor_kgco2e_per_unit === 'number'
    ) {
      const totalFuelUnits = input.lifetime_distance_km / input.fuel_economy_km_per_unit;
      useTailpipePoint = totalFuelUnits * input.fuel_tailpipe_factor_kgco2e_per_unit;

      if (typeof input.fuel_upstream_factor_kgco2e_per_unit === 'number' && input.fuel_upstream_factor_kgco2e_per_unit > 0) {
        const wttMin = input.fuel_upstream_factor_min ?? input.fuel_upstream_factor_kgco2e_per_unit;
        const wttMax = input.fuel_upstream_factor_max ?? input.fuel_upstream_factor_kgco2e_per_unit;
        useUpstreamPoint = totalFuelUnits * input.fuel_upstream_factor_kgco2e_per_unit;
        useUpstreamMin = totalFuelUnits * wttMin;
        useUpstreamMax = totalFuelUnits * wttMax;
      } else {
        warnings.push(
          'CRITICAL CAVEAT (Section 5): Upstream fuel production (Well-to-Tank) factor was not provided. Tailpipe combustion-only emissions must NOT be compared directly against lifecycle BEV electricity emissions.'
        );
      }

      notes.push(
        `Combustion Use Phase: ${totalFuelUnits.toFixed(1)} ${input.fuel_unit || 'L'} consumed over ${input.lifetime_distance_km.toLocaleString()} km (${input.fuel_economy_km_per_unit} km/${input.fuel_unit || 'L'}).`
      );
    } else {
      isUsePhaseComplete = false;
      warnings.push('Missing fuel economy (km/L or km/kg) or tailpipe combustion factor for combustion powertrain.');
    }
  }

  const useTotalMin = useTailpipePoint + useUpstreamMin;
  const useTotalMax = useTailpipePoint + useUpstreamMax;
  const useTotalPoint = useTailpipePoint + useUpstreamPoint;

  // 6. Maintenance & Replacement Parts Stage
  const maintPoint = Math.max(0, input.maintenance_kgco2e ?? 0);

  // 7. End-of-Life (EoL) Stage & Double-Counting Recycling Guard
  const eolProcess = Math.max(0, input.eol_dismantling_processing_kgco2e ?? 0);
  let eolCredit = 0;

  const hasRecycledInputInBom = (input.materials_bom ?? []).some(m => (m.recycled_share_pct ?? 0) > 0);

  if (input.eol_allocation_method === 'Cut-off (Recycled Content)') {
    if (input.eol_recycling_credit_kgco2e && input.eol_recycling_credit_kgco2e !== 0) {
      guardsTriggered.push(
        'END-OF-LIFE ALLOCATION GUARD: Under the Cut-off allocation method, end-of-life avoided-burden recycling credits are set to 0 because recycling benefits are accounted for via secondary/recycled input material factors (Section 7).'
      );
    }
    eolCredit = 0;
  } else if (input.eol_allocation_method === 'Avoided Burden (End-of-Life Recycling Credit)') {
    if (hasRecycledInputInBom && input.eol_recycling_credit_kgco2e && input.eol_recycling_credit_kgco2e !== 0) {
      guardsTriggered.push(
        'RECYCLING DOUBLE-COUNTING GUARD: Scenario specified both secondary/recycled material input shares in the BOM and an End-of-Life avoided-burden credit. To prevent double counting recycling benefits, the EoL credit was suppressed (Section 7 & Section 11).'
      );
      eolCredit = 0;
    } else {
      eolCredit = -Math.abs(input.eol_recycling_credit_kgco2e ?? 0);
    }
  }

  const eolNet = eolProcess + eolCredit;

  // Total Lifecycle Aggregation
  const totalMin = mfgMin + logPoint + useTotalMin + maintPoint + eolNet;
  const totalMax = mfgMax + logPoint + useTotalMax + maintPoint + eolNet;
  const totalPoint = mfgPoint + logPoint + useTotalPoint + maintPoint + eolNet;

  const gPerKmMin = (totalMin * 1000) / input.lifetime_distance_km;
  const gPerKmMax = (totalMax * 1000) / input.lifetime_distance_km;
  const gPerKmPoint = (totalPoint * 1000) / input.lifetime_distance_km;

  const isComplete = isUsePhaseComplete && (mfgPoint > 0 || (input.materials_bom?.length ?? 0) > 0);

  // Sensitivity Analysis
  const sensitivity = [
    {
      parameter: 'Material Screening Band (Low vs High Route/Electricity Mix)',
      low_case_total_kgco2e: Number((totalPoint - (matPoint - matMin)).toFixed(1)),
      high_case_total_kgco2e: Number((totalPoint + (matMax - matPoint)).toFixed(1)),
      swing_kgco2e: Number((matMax - matMin).toFixed(1))
    },
    {
      parameter: 'Lifetime Distance (±20% around declared functional unit)',
      low_case_total_kgco2e: Number((mfgPoint + logPoint + useTotalPoint * 0.8 + maintPoint + eolNet).toFixed(1)),
      high_case_total_kgco2e: Number((mfgPoint + logPoint + useTotalPoint * 1.2 + maintPoint + eolNet).toFixed(1)),
      swing_kgco2e: Number((useTotalPoint * 0.4).toFixed(1))
    },
    {
      parameter: 'Use-Phase Energy / Fuel Efficiency (±15% Real-World vs Test-Cycle)',
      low_case_total_kgco2e: Number((mfgPoint + logPoint + useTotalPoint * 0.85 + maintPoint + eolNet).toFixed(1)),
      high_case_total_kgco2e: Number((mfgPoint + logPoint + useTotalPoint * 1.15 + maintPoint + eolNet).toFixed(1)),
      swing_kgco2e: Number((useTotalPoint * 0.3).toFixed(1))
    }
  ];

  const roundRange = (r: StageRange): StageRange => ({
    point: Number(r.point.toFixed(2)),
    min: Number(r.min.toFixed(2)),
    max: Number(r.max.toFixed(2))
  });

  return {
    scenario_name: input.scenario_name,
    functional_unit: `1 passenger car over ${input.lifetime_distance_km.toLocaleString()} km declared lifetime`,
    lifetime_distance_km: input.lifetime_distance_km,
    powertrain: input.powertrain,
    is_complete: isComplete,
    data_quality_label: !isComplete
      ? 'Incomplete — Missing Required Inputs'
      : typeof input.published_manufacturing_total_kgco2e === 'number'
      ? 'Published + Modelled Hybrid'
      : 'Modelled Scenario (Using Screening Ranges & User Inputs)',
    stages: {
      material_production: roundRange({ point: matPoint, min: matMin, max: matMax }),
      battery_pack_production: roundRange({ point: batPoint, min: batMin, max: batMax }),
      component_and_process_manufacturing: roundRange({ point: procPoint, min: procPoint, max: procPoint }),
      manufacturing_total: roundRange({ point: mfgPoint, min: mfgMin, max: mfgMax }),
      logistics_and_transport: roundRange({ point: logPoint, min: logPoint, max: logPoint }),
      use_phase_tailpipe: roundRange({ point: useTailpipePoint, min: useTailpipePoint, max: useTailpipePoint }),
      use_phase_upstream: roundRange({ point: useUpstreamPoint, min: useUpstreamMin, max: useUpstreamMax }),
      use_phase_total: roundRange({ point: useTotalPoint, min: useTotalMin, max: useTotalMax }),
      maintenance: roundRange({ point: maintPoint, min: maintPoint, max: maintPoint }),
      end_of_life_net: roundRange({ point: eolNet, min: eolNet, max: eolNet })
    },
    totals: {
      total_kgco2e: roundRange({ point: totalPoint, min: totalMin, max: totalMax }),
      g_co2e_per_km: roundRange({ point: gPerKmPoint, min: gPerKmMin, max: gPerKmMax })
    },
    double_counting_guards_triggered: guardsTriggered,
    missing_data_warnings: warnings,
    methodology_notes: notes,
    sensitivity_analysis: sensitivity
  };
}
