import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Calculator, ShieldCheck, AlertTriangle, Save, CheckCircle2 } from 'lucide-react';
import { QualityBadge } from './SharedBadges.js';

export function LifecycleCalculatorView({ preselectedVehicle }: { preselectedVehicle?: any }) {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [components, setComponents] = useState<any[]>([]);
  const [processes, setProcesses] = useState<any[]>([]);

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('VEH-ARCH-1-PETROL');
  const [scenarioName, setScenarioName] = useState<string>('India Small Petrol Hatchback (150,000 km Baseline)');
  const [powertrain, setPowertrain] = useState<string>('Petrol (ICEV)');
  const [lifetimeKm, setLifetimeKm] = useState<number>(150000);

  // Recycled content share sliders for Steel & Aluminium
  const [recycledSteelSharePct, setRecycledSteelSharePct] = useState<number>(20);
  const [recycledAluSharePct, setRecycledAluSharePct] = useState<number>(35);

  // Double-counting test toggle: Published manufacturing total
  const [usePublishedMfgTotal, setUsePublishedMfgTotal] = useState<boolean>(false);
  const [publishedMfgTotalKg, setPublishedMfgTotalKg] = useState<number>(5400);

  // Battery pack parameters
  const [batteryKwh, setBatteryKwh] = useState<number>(0);
  const [batteryFactorMin, setBatteryFactorMin] = useState<number>(65);
  const [batteryFactorMax, setBatteryFactorMax] = useState<number>(100);

  // Assembly & logistics parameters
  const [assemblyOverheadKg, setAssemblyOverheadKg] = useState<number>(650);
  const [freightDistanceKm, setFreightDistanceKm] = useState<number>(800);
  const [freightFactor, setFreightFactor] = useState<number>(0.065);
  const [logisticsAlreadyInSupplier, setLogisticsAlreadyInSupplier] = useState<boolean>(false);

  // Use phase parameters (User-editable scenario inputs clearly labelled)
  const [fuelEconomy, setFuelEconomy] = useState<number>(18.5);
  const [fuelUnit, setFuelUnit] = useState<'L' | 'kg'>('L');
  const [fuelTailpipeFactor, setFuelTailpipeFactor] = useState<number>(2.31);
  const [fuelUpstreamFactor, setFuelUpstreamFactor] = useState<number>(0.58);

  const [elecConsumptionKwhPerKm, setElecConsumptionKwhPerKm] = useState<number>(0.14);
  const [chargingLossPct, setChargingLossPct] = useState<number>(10);
  const [gridFactor, setGridFactor] = useState<number>(0.716);
  const [gridFiscalYearLabel, setGridFiscalYearLabel] = useState<string>('User Scenario / CEA India Grid Factor (kg CO2/kWh)');
  const [electricUtilityFactor, setElectricUtilityFactor] = useState<number>(0.5);

  // Maintenance & EoL
  const [maintenanceKg, setMaintenanceKg] = useState<number>(450);
  const [eolAllocationMethod, setEolAllocationMethod] = useState<'Cut-off (Recycled Content)' | 'Avoided Burden (End-of-Life Recycling Credit)'>('Cut-off (Recycled Content)');
  const [eolDismantlingKg, setEolDismantlingKg] = useState<number>(180);
  const [eolCreditKg, setEolCreditKg] = useState<number>(0);

  const [calcResult, setCalcResult] = useState<any | null>(null);
  const [savedBanner, setSavedBanner] = useState<boolean>(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/vehicles').then(r => r.json()),
      fetch('/api/components').then(r => r.json()),
      fetch('/api/processes').then(r => r.json())
    ]).then(([vData, cData, pData]) => {
      setVehicles(vData);
      setComponents(cData);
      setProcesses(pData);
    });
  }, []);

  // Apply preset when vehicle changes
  const applyVehiclePreset = (vId: string, vList = vehicles) => {
    setSelectedVehicleId(vId);
    const v = vList.find(x => x.vehicle_id === vId);
    if (!v) return;

    setPowertrain(v.powertrain);
    setScenarioName(`${v.model} — 150,000 km Scenario`);

    if (v.powertrain === 'Petrol (ICEV)') {
      setBatteryKwh(0);
      setFuelEconomy(18.5);
      setFuelUnit('L');
      setFuelTailpipeFactor(2.31);
      setFuelUpstreamFactor(0.58);
    } else if (v.powertrain === 'Diesel (ICEV)') {
      setBatteryKwh(0);
      setFuelEconomy(21.0);
      setFuelUnit('L');
      setFuelTailpipeFactor(2.68);
      setFuelUpstreamFactor(0.65);
    } else if (v.powertrain === 'CNG') {
      setBatteryKwh(0);
      setFuelEconomy(26.0);
      setFuelUnit('kg');
      setFuelTailpipeFactor(2.75);
      setFuelUpstreamFactor(0.85);
    } else if (v.powertrain === 'Full Hybrid (HEV)') {
      setBatteryKwh(1.5);
      setFuelEconomy(25.5);
      setFuelUnit('L');
      setFuelTailpipeFactor(2.31);
      setFuelUpstreamFactor(0.58);
    } else if (v.powertrain === 'Plug-in Hybrid (PHEV)') {
      setBatteryKwh(14.0);
      setElectricUtilityFactor(0.55);
      setElecConsumptionKwhPerKm(0.15);
      setFuelEconomy(19.0);
      setFuelUnit('L');
      setFuelTailpipeFactor(2.31);
      setFuelUpstreamFactor(0.58);
    } else if (v.powertrain === 'Battery Electric (BEV)') {
      setBatteryKwh(v.battery_capacity_kwh || 40.0);
      setElecConsumptionKwhPerKm(v.electricity_consumption_kwh_per_km || 0.14);
      setGridFactor(0.716);
    } else if (v.powertrain === 'Hydrogen Fuel Cell (FCEV)') {
      setBatteryKwh(1.5);
      setFuelEconomy(100.0); // 100 km / kg H2 (1 kg H2 / 100 km)
      setFuelUnit('kg');
      setFuelTailpipeFactor(0);
      setFuelUpstreamFactor(11.0); // IEA 2024 Natural Gas SMR midpoint (10-12 kg CO2e/kg H2)
    }
  };

  useEffect(() => {
    if (preselectedVehicle && vehicles.length > 0) {
      applyVehiclePreset(preselectedVehicle.vehicle_id, vehicles);
    }
  }, [preselectedVehicle, vehicles]);

  // Build BOM array from EU SWD(2023) 256 table matching the selected powertrain
  const buildBomInput = () => {
    let bomCompId = 'COMP-BOM-ICEV-EU';
    if (powertrain === 'Full Hybrid (HEV)') bomCompId = 'COMP-BOM-HEV-EU';
    else if (powertrain === 'Plug-in Hybrid (PHEV)') bomCompId = 'COMP-BOM-PHEV-EU';
    else if (powertrain === 'Battery Electric (BEV)') bomCompId = 'COMP-BOM-BEV-EU';

    const comp = components.find(c => c.component_id === bomCompId);
    if (!comp || !comp.material_breakdown) return [];

    return comp.material_breakdown.map((m: any) => {
      const isAlu = m.material_name.toLowerCase().includes('aluminium');
      const isSteel = m.material_name.toLowerCase().includes('steel');
      return {
        material_id: m.material_id || 'MAT-OTHER',
        material_name: m.material_name,
        mass_kg: m.mass_kg,
        factor_min: m.factor_min,
        factor_max: m.factor_max,
        factor_kgco2e_per_kg: m.factor_value,
        recycled_share_pct: isAlu ? recycledAluSharePct : isSteel ? recycledSteelSharePct : 0,
        recycled_factor_min: isAlu ? 0.5 : isSteel ? 0.8 : null,
        recycled_factor_max: isAlu ? 2.5 : isSteel ? 1.5 : null
      };
    });
  };

  const runCalculation = (saveToDb = false) => {
    const bom = buildBomInput();
    if (bom.length === 0) return;

    // Map direct component manufacturing processes from Section 4 Table 4 to their respective BOM masses
    const getMatMass = (nameSub: string) =>
      bom.filter((x: any) => x.material_name.toLowerCase().includes(nameSub)).reduce((acc: number, x: any) => acc + x.mass_kg, 0);

    const mfgProcesses = [
      {
        process_id: 'PROC-STAMPING',
        process_name: 'Stamping (Steel & Wrought Al sheet)',
        activity_quantity: getMatMass('steel') * 0.75 + getMatMass('wrought'),
        reference_unit: 'kg processed',
        emissions_kgco2e_per_unit: 0.31,
        is_allocated_facility_service: false
      },
      {
        process_id: 'PROC-ALU-CASTING',
        process_name: 'Aluminium shape casting',
        activity_quantity: getMatMass('cast aluminium'),
        reference_unit: 'kg processed',
        emissions_kgco2e_per_unit: 3.08,
        is_allocated_facility_service: false
      },
      {
        process_id: 'PROC-IRON-CASTING',
        process_name: 'Iron casting / iron process',
        activity_quantity: getMatMass('cast iron'),
        reference_unit: 'kg processed',
        emissions_kgco2e_per_unit: 1.69,
        is_allocated_facility_service: false
      },
      {
        process_id: 'PROC-CU-WIRE',
        process_name: 'Copper wire production',
        activity_quantity: getMatMass('copper'),
        reference_unit: 'kg processed',
        emissions_kgco2e_per_unit: 0.43,
        is_allocated_facility_service: false
      },
      {
        process_id: 'PROC-FORGING',
        process_name: 'Forging (25% structural/powertrain steel)',
        activity_quantity: getMatMass('steel') * 0.25,
        reference_unit: 'kg processed',
        emissions_kgco2e_per_unit: 2.61,
        is_allocated_facility_service: false
      },
      {
        process_id: 'PROC-GLASS-FORMING',
        process_name: 'Glass pane forming',
        activity_quantity: bom
          .filter((x: any) => x.material_name.toLowerCase() === 'glass')
          .reduce((acc: number, x: any) => acc + x.mass_kg, 0),
        reference_unit: 'kg processed',
        emissions_kgco2e_per_unit: 0.93,
        is_allocated_facility_service: false
      }
    ];

    const payload = {
      scenario_name: scenarioName,
      vehicle_id: selectedVehicleId,
      powertrain,
      lifetime_distance_km: lifetimeKm,
      published_manufacturing_total_kgco2e: usePublishedMfgTotal ? publishedMfgTotalKg : null,
      published_manufacturing_includes_materials: true,
      materials_bom: bom,
      manufacturing_processes: mfgProcesses,
      assembly_overhead_per_vehicle_kgco2e: assemblyOverheadKg,
      battery_capacity_kwh: batteryKwh,
      battery_factor_kgco2e_per_kwh_min: batteryFactorMin,
      battery_factor_kgco2e_per_kwh_max: batteryFactorMax,
      logistics_flows: [
        {
          mode_name: 'Inbound/Outbound Freight Transport',
          freight_tonnes: 1.137,
          distance_km: freightDistanceKm,
          factor_kgco2e_per_tonne_km: freightFactor,
          already_in_supplier_dataset: logisticsAlreadyInSupplier
        }
      ],
      fuel_economy_km_per_unit: fuelEconomy,
      fuel_unit: fuelUnit,
      fuel_tailpipe_factor_kgco2e_per_unit: fuelTailpipeFactor,
      fuel_upstream_factor_kgco2e_per_unit: fuelUpstreamFactor,
      fuel_upstream_factor_min: powertrain === 'Hydrogen Fuel Cell (FCEV)' ? 10.0 : fuelUpstreamFactor * 0.9,
      fuel_upstream_factor_max: powertrain === 'Hydrogen Fuel Cell (FCEV)' ? 12.0 : fuelUpstreamFactor * 1.1,
      electricity_consumption_kwh_per_km: elecConsumptionKwhPerKm,
      charging_loss_pct: chargingLossPct,
      grid_factor_kgco2e_per_kwh: gridFactor,
      grid_fiscal_year_and_margin: gridFiscalYearLabel,
      electric_utility_factor: electricUtilityFactor,
      maintenance_kgco2e: maintenanceKg,
      eol_allocation_method: eolAllocationMethod,
      eol_dismantling_processing_kgco2e: eolDismantlingKg,
      eol_recycling_credit_kgco2e: eolCreditKg,
      save_result: saveToDb
    };

    fetch('/api/calculate-lca', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(r => r.json())
      .then(d => {
        setCalcResult(d);
        if (saveToDb) {
          setSavedBanner(true);
          setTimeout(() => setSavedBanner(false), 3500);
        }
      });
  };

  useEffect(() => {
    if (components.length > 0 && processes.length > 0) {
      runCalculation(false);
    }
  }, [
    selectedVehicleId,
    powertrain,
    lifetimeKm,
    recycledSteelSharePct,
    recycledAluSharePct,
    usePublishedMfgTotal,
    publishedMfgTotalKg,
    batteryKwh,
    batteryFactorMin,
    batteryFactorMax,
    assemblyOverheadKg,
    freightDistanceKm,
    freightFactor,
    logisticsAlreadyInSupplier,
    fuelEconomy,
    fuelTailpipeFactor,
    fuelUpstreamFactor,
    elecConsumptionKwhPerKm,
    chargingLossPct,
    gridFactor,
    electricUtilityFactor,
    maintenanceKg,
    eolAllocationMethod,
    eolDismantlingKg,
    eolCreditKg,
    components
  ]);

  const stageChartData = calcResult
    ? [
        {
          stage: 'Cradle-to-Gate Materials',
          Min: calcResult.stages.material_production.min,
          Midpoint: calcResult.stages.material_production.point,
          Max: calcResult.stages.material_production.max
        },
        {
          stage: 'Traction Battery Pack',
          Min: calcResult.stages.battery_pack_production.min,
          Midpoint: calcResult.stages.battery_pack_production.point,
          Max: calcResult.stages.battery_pack_production.max
        },
        {
          stage: 'Component & Plant Mfg',
          Min: calcResult.stages.component_and_process_manufacturing.min,
          Midpoint: calcResult.stages.component_and_process_manufacturing.point,
          Max: calcResult.stages.component_and_process_manufacturing.max
        },
        {
          stage: 'Logistics & Freight',
          Min: calcResult.stages.logistics_and_transport.min,
          Midpoint: calcResult.stages.logistics_and_transport.point,
          Max: calcResult.stages.logistics_and_transport.max
        },
        {
          stage: 'Use Phase: Tailpipe (TTW)',
          Min: calcResult.stages.use_phase_tailpipe.min,
          Midpoint: calcResult.stages.use_phase_tailpipe.point,
          Max: calcResult.stages.use_phase_tailpipe.max
        },
        {
          stage: 'Use Phase: Upstream (WTT/Grid)',
          Min: calcResult.stages.use_phase_upstream.min,
          Midpoint: calcResult.stages.use_phase_upstream.point,
          Max: calcResult.stages.use_phase_upstream.max
        },
        {
          stage: 'Maintenance & EoL Net',
          Min: calcResult.stages.maintenance.min + calcResult.stages.end_of_life_net.min,
          Midpoint: calcResult.stages.maintenance.point + calcResult.stages.end_of_life_net.point,
          Max: calcResult.stages.maintenance.max + calcResult.stages.end_of_life_net.max
        }
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-700 text-white">
            <Calculator className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Interactive Automotive Lifecycle Assessment (LCA) Calculator
            </h2>
            <p className="text-xs text-slate-500">
              Propagates Section 2 screening ranges, EU SWD(2023) 256 BOM masses, and Section 4 process factors while enforcing strict double-counting guards.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {savedBanner && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
              <CheckCircle2 className="w-4 h-4" /> Saved to SQLite
            </span>
          )}
          <button
            onClick={() => runCalculation(true)}
            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Scenario Result to Database</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Scenario Parameters & Controls */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-5">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
            1. Vehicle Archetype & Functional Unit
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Select Vehicle Archetype / Model</label>
              <select
                value={selectedVehicleId}
                onChange={e => applyVehiclePreset(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white font-medium"
              >
                {vehicles.map(v => (
                  <option key={v.vehicle_id} value={v.vehicle_id}>
                    {v.model} ({v.powertrain})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Declared Lifetime (km)</label>
                <input
                  type="number"
                  value={lifetimeKm}
                  onChange={e => setLifetimeKm(Number(e.target.value) || 150000)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Powertrain</label>
                <input
                  type="text"
                  disabled
                  value={powertrain}
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-100 text-slate-600 font-medium"
                />
              </div>
            </div>
          </div>

          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2 pt-2">
            2. Materials, Recycled Route & Manufacturing
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between font-medium text-slate-700 mb-1">
                <span>Recycled / Secondary Aluminium Share (%)</span>
                <span className="font-mono font-bold text-emerald-700">{recycledAluSharePct}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={recycledAluSharePct}
                onChange={e => setRecycledAluSharePct(Number(e.target.value))}
                className="w-full accent-emerald-600"
              />
              <div className="text-[11px] text-slate-500">
                Blends Primary Al (~8–18 kg CO2e/kg) with Secondary Al (~0.5–2.5 kg CO2e/kg).
              </div>
            </div>

            <div>
              <div className="flex justify-between font-medium text-slate-700 mb-1">
                <span>Recycled / EAF Steel Share (%)</span>
                <span className="font-mono font-bold text-emerald-700">{recycledSteelSharePct}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={recycledSteelSharePct}
                onChange={e => setRecycledSteelSharePct(Number(e.target.value))}
                className="w-full accent-emerald-600"
              />
            </div>

            {(powertrain.includes('BEV') || powertrain.includes('PHEV') || powertrain.includes('HEV') || powertrain.includes('FCEV')) && (
              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-lg space-y-2">
                <div className="font-semibold text-emerald-950">Traction Battery Pack Parameters (Scenario Input)</div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-600">Capacity (kWh)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={batteryKwh}
                      onChange={e => setBatteryKwh(Number(e.target.value))}
                      className="w-full border border-slate-300 rounded px-2 py-1 font-mono bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600">Min (kgCO2e/kWh)</label>
                    <input
                      type="number"
                      value={batteryFactorMin}
                      onChange={e => setBatteryFactorMin(Number(e.target.value))}
                      className="w-full border border-slate-300 rounded px-2 py-1 font-mono bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600">Max (kgCO2e/kWh)</label>
                    <input
                      type="number"
                      value={batteryFactorMax}
                      onChange={e => setBatteryFactorMax(Number(e.target.value))}
                      className="w-full border border-slate-300 rounded px-2 py-1 font-mono bg-white"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={usePublishedMfgTotal}
                  onChange={e => setUsePublishedMfgTotal(e.target.checked)}
                  className="rounded accent-emerald-600"
                />
                <span>Use Published Whole-Vehicle Manufacturing Footprint (Test Double-Counting Guard)</span>
              </label>
              {usePublishedMfgTotal && (
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">Published Factory Total (kg CO2e incl. materials)</label>
                  <input
                    type="number"
                    value={publishedMfgTotalKg}
                    onChange={e => setPublishedMfgTotalKg(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded px-2.5 py-1 font-mono bg-white"
                  />
                </div>
              )}
            </div>
          </div>

          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2 pt-2">
            3. Use-Phase Energy & Fuel Scenario Parameters
          </h3>

          <div className="space-y-3 text-xs">
            {powertrain === 'Battery Electric (BEV)' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Electricity Use (kWh/km)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={elecConsumptionKwhPerKm}
                    onChange={e => setElecConsumptionKwhPerKm(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Grid Factor (kg CO2/kWh)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={gridFactor}
                    onChange={e => setGridFactor(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono"
                  />
                </div>
              </div>
            ) : powertrain === 'Plug-in Hybrid (PHEV)' ? (
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between font-semibold text-slate-700">
                    <span>Electric Utility Factor (UF Share)</span>
                    <span className="font-mono">{(electricUtilityFactor * 100).toFixed(0)}% Electric</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={electricUtilityFactor}
                    onChange={e => setElectricUtilityFactor(Number(e.target.value))}
                    className="w-full accent-emerald-600"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-600">Electric (kWh/km)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={elecConsumptionKwhPerKm}
                      onChange={e => setElecConsumptionKwhPerKm(Number(e.target.value))}
                      className="w-full border border-slate-300 rounded px-2 py-1 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600">Grid (kg CO2/kWh)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={gridFactor}
                      onChange={e => setGridFactor(Number(e.target.value))}
                      className="w-full border border-slate-300 rounded px-2 py-1 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600">Fuel Econ (km/L)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={fuelEconomy}
                      onChange={e => setFuelEconomy(Number(e.target.value))}
                      className="w-full border border-slate-300 rounded px-2 py-1 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600">Petrol TTW+WTT</label>
                    <input
                      type="number"
                      step="0.1"
                      value={fuelTailpipeFactor}
                      onChange={e => setFuelTailpipeFactor(Number(e.target.value))}
                      className="w-full border border-slate-300 rounded px-2 py-1 font-mono"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Economy (km/{fuelUnit})</label>
                  <input
                    type="number"
                    step="0.5"
                    value={fuelEconomy}
                    onChange={e => setFuelEconomy(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-2 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tailpipe TTW (kg/{fuelUnit})</label>
                  <input
                    type="number"
                    step="0.05"
                    value={fuelTailpipeFactor}
                    onChange={e => setFuelTailpipeFactor(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-2 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Upstream WTT (kg/{fuelUnit})</label>
                  <input
                    type="number"
                    step="0.05"
                    value={fuelUpstreamFactor}
                    onChange={e => setFuelUpstreamFactor(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-2 py-1.5 font-mono"
                  />
                </div>
              </div>
            )}

            {/* End-of-Life Allocation Selector */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="block font-semibold text-slate-700">End-of-Life Allocation Method (Section 7)</label>
              <select
                value={eolAllocationMethod}
                onChange={e => setEolAllocationMethod(e.target.value as any)}
                className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
              >
                <option value="Cut-off (Recycled Content)">Cut-off Method (Recycled Content in BOM; 0 EoL Credit)</option>
                <option value="Avoided Burden (End-of-Life Recycling Credit)">Avoided-Burden Credit Method</option>
              </select>
              {eolAllocationMethod === 'Avoided Burden (End-of-Life Recycling Credit)' && (
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">EoL Avoided-Burden Credit Magnitude (kg CO2e)</label>
                  <input
                    type="number"
                    value={eolCreditKg}
                    onChange={e => setEolCreditKg(Number(e.target.value))}
                    className="w-full border border-slate-300 rounded px-2.5 py-1 font-mono"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Stage-by-Stage Results, Ranges & Guardrails */}
        <div className="lg:col-span-7 space-y-5">
          {calcResult && (
            <>
              {/* Top KPI Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800">
                  <div className="text-xs font-mono uppercase text-emerald-400">Total Lifecycle Footprint</div>
                  <div className="text-2xl font-bold font-mono mt-1">
                    {(calcResult.totals.total_kgco2e.point / 1000).toFixed(2)} t CO2e
                  </div>
                  <div className="text-xs font-mono text-slate-300 mt-1">
                    Range: {calcResult.totals.total_kgco2e.min.toLocaleString()} – {calcResult.totals.total_kgco2e.max.toLocaleString()} kg CO2e
                  </div>
                </div>

                <div className="bg-emerald-900 text-white p-4 rounded-xl border border-emerald-800">
                  <div className="text-xs font-mono uppercase text-emerald-300">Intensity per Kilometre</div>
                  <div className="text-2xl font-bold font-mono mt-1">
                    {calcResult.totals.g_co2e_per_km.point.toFixed(1)} g CO2e/km
                  </div>
                  <div className="text-xs font-mono text-emerald-200 mt-1">
                    Range: {calcResult.totals.g_co2e_per_km.min.toFixed(1)} – {calcResult.totals.g_co2e_per_km.max.toFixed(1)} g/km
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                  <div className="text-xs font-semibold uppercase text-slate-500">Scenario Provenance</div>
                  <div className="my-1">
                    <QualityBadge status={calcResult.data_quality_label} />
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Functional Unit: {calcResult.lifetime_distance_km.toLocaleString()} km
                  </div>
                </div>
              </div>

              {/* Active Double-Counting Guards & Warnings */}
              {calcResult.double_counting_guards_triggered.length > 0 && (
                <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-900">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    <span>Double-Counting Prevention Guards Active</span>
                  </div>
                  <ul className="list-disc list-inside text-xs text-emerald-900 space-y-1">
                    {calcResult.double_counting_guards_triggered.map((g: string, i: number) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                </div>
              )}

              {calcResult.missing_data_warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-700" />
                    <span>Data Completeness & Boundary Notes</span>
                  </div>
                  <ul className="list-disc list-inside text-xs text-amber-900 space-y-1">
                    {calcResult.missing_data_warnings.map((w: string, i: number) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Stage-by-Stage Chart */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                  Lifecycle Stage Breakdown (Min / Midpoint / Max Screening Bands in kg CO2e)
                </h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stageChartData} margin={{ top: 10, right: 20, left: 10, bottom: 45 }}>
                      <XAxis dataKey="stage" angle={-18} textAnchor="end" interval={0} tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend verticalAlign="top" />
                      <Bar dataKey="Min" fill="#94a3b8" />
                      <Bar dataKey="Midpoint" fill="#059669" />
                      <Bar dataKey="Max" fill="#0f172a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Detailed Stage Breakdown & Sensitivity Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-5 py-3 bg-slate-900 text-white text-xs font-bold uppercase tracking-wider">
                  Stage-by-Stage Numerical Audit & Sensitivity Analysis
                </div>
                <div className="p-4 space-y-4">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2">Lifecycle Module</th>
                        <th className="py-2 text-right font-mono">Min (kg CO2e)</th>
                        <th className="py-2 text-right font-mono">Midpoint (kg CO2e)</th>
                        <th className="py-2 text-right font-mono">Max (kg CO2e)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stageChartData.map(row => (
                        <tr key={row.stage}>
                          <td className="py-2 font-medium text-slate-800">{row.stage}</td>
                          <td className="py-2 text-right font-mono text-slate-600">{row.Min.toLocaleString()}</td>
                          <td className="py-2 text-right font-mono font-semibold text-emerald-800">{row.Midpoint.toLocaleString()}</td>
                          <td className="py-2 text-right font-mono text-slate-600">{row.Max.toLocaleString()}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 font-bold border-t-2 border-slate-300">
                        <td className="py-2.5 text-slate-900">Total Vehicle Lifecycle (kg CO2e)</td>
                        <td className="py-2.5 text-right font-mono">{calcResult.totals.total_kgco2e.min.toLocaleString()}</td>
                        <td className="py-2.5 text-right font-mono text-emerald-800">{calcResult.totals.total_kgco2e.point.toLocaleString()}</td>
                        <td className="py-2.5 text-right font-mono">{calcResult.totals.total_kgco2e.max.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="pt-2 border-t border-slate-200">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                      Parameter Sensitivity Swings
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      {calcResult.sensitivity_analysis.map((s: any, i: number) => (
                        <div key={i} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                          <div className="font-semibold text-slate-800">{s.parameter}</div>
                          <div className="font-mono text-emerald-800 font-bold mt-1">
                            Swing: ±{(s.swing_kgco2e / 2).toLocaleString()} kg CO2e
                          </div>
                          <div className="font-mono text-[11px] text-slate-500">
                            {s.low_case_total_kgco2e.toLocaleString()} → {s.high_case_total_kgco2e.toLocaleString()} kg
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
