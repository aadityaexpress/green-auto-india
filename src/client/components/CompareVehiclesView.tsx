import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Scale, Info } from 'lucide-react';

export function CompareVehiclesView() {
  const [lifetimeKm, setLifetimeKm] = useState<number>(150000);
  const [gridFactor, setGridFactor] = useState<number>(0.716);
  const [recycledAluShare, setRecycledAluShare] = useState<number>(35);
  const [h2Pathway, setH2Pathway] = useState<'ng' | 'coal' | 'green'>('ng');

  const [components, setComponents] = useState<any[]>([]);
  const [comparisonResults, setComparisonResults] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/components')
      .then(r => r.json())
      .then(d => setComponents(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (components.length === 0) return;

    const getBomFor = (compId: string) => {
      const comp = components.find(c => c.component_id === compId);
      if (!comp || !comp.material_breakdown) return [];
      return comp.material_breakdown.map((m: any) => {
        const isAlu = m.material_name.toLowerCase().includes('aluminium');
        return {
          material_id: m.material_id || 'MAT-OTHER',
          material_name: m.material_name,
          mass_kg: m.mass_kg,
          factor_min: m.factor_min,
          factor_max: m.factor_max,
          recycled_share_pct: isAlu ? recycledAluShare : 20,
          recycled_factor_min: isAlu ? 0.5 : 0.8,
          recycled_factor_max: isAlu ? 2.5 : 1.5
        };
      });
    };

    const h2Factor = h2Pathway === 'ng' ? 11.0 : h2Pathway === 'coal' ? 24.0 : 2.5;

    const archetypes = [
      {
        label: '1. Petrol Hatchback (ICEV)',
        powertrain: 'Petrol (ICEV)',
        bom: getBomFor('COMP-BOM-ICEV-EU'),
        batteryKwh: 0,
        fuelEconomy: 18.5,
        fuelUnit: 'L',
        ttw: 2.31,
        wtt: 0.58,
        elecUse: null,
        uf: 0
      },
      {
        label: '2. Diesel Compact SUV (ICEV)',
        powertrain: 'Diesel (ICEV)',
        bom: getBomFor('COMP-BOM-ICEV-EU'),
        batteryKwh: 0,
        fuelEconomy: 21.0,
        fuelUnit: 'L',
        ttw: 2.68,
        wtt: 0.65,
        elecUse: null,
        uf: 0
      },
      {
        label: '3. CNG Passenger Car',
        powertrain: 'CNG',
        bom: getBomFor('COMP-BOM-ICEV-EU'),
        batteryKwh: 0,
        fuelEconomy: 26.0,
        fuelUnit: 'kg',
        ttw: 2.75,
        wtt: 0.85,
        elecUse: null,
        uf: 0
      },
      {
        label: '4. Full Hybrid (HEV)',
        powertrain: 'Full Hybrid (HEV)',
        bom: getBomFor('COMP-BOM-HEV-EU'),
        batteryKwh: 1.5,
        fuelEconomy: 25.5,
        fuelUnit: 'L',
        ttw: 2.31,
        wtt: 0.58,
        elecUse: null,
        uf: 0
      },
      {
        label: '5. Plug-in Hybrid (PHEV)',
        powertrain: 'Plug-in Hybrid (PHEV)',
        bom: getBomFor('COMP-BOM-PHEV-EU'),
        batteryKwh: 14.0,
        fuelEconomy: 19.0,
        fuelUnit: 'L',
        ttw: 2.31,
        wtt: 0.58,
        elecUse: 0.15,
        uf: 0.55
      },
      {
        label: '6. Battery Electric (BEV 40kWh)',
        powertrain: 'Battery Electric (BEV)',
        bom: getBomFor('COMP-BOM-BEV-EU'),
        batteryKwh: 40.0,
        fuelEconomy: null,
        fuelUnit: 'L',
        ttw: 0,
        wtt: 0,
        elecUse: 0.14,
        uf: 1.0
      },
      {
        label: '7. Hydrogen FCEV',
        powertrain: 'Hydrogen Fuel Cell (FCEV)',
        bom: getBomFor('COMP-BOM-BEV-EU'),
        batteryKwh: 1.5,
        fuelEconomy: 100.0,
        fuelUnit: 'kg',
        ttw: 0,
        wtt: h2Factor,
        elecUse: null,
        uf: 0
      }
    ];

    Promise.all(
      archetypes.map(a =>
        fetch('/api/calculate-lca', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scenario_name: a.label,
            powertrain: a.powertrain,
            lifetime_distance_km: lifetimeKm,
            materials_bom: a.bom,
            assembly_overhead_per_vehicle_kgco2e: 850,
            battery_capacity_kwh: a.batteryKwh,
            battery_factor_kgco2e_per_kwh_min: 65,
            battery_factor_kgco2e_per_kwh_max: 100,
            fuel_economy_km_per_unit: a.fuelEconomy,
            fuel_unit: a.fuelUnit,
            fuel_tailpipe_factor_kgco2e_per_unit: a.ttw,
            fuel_upstream_factor_kgco2e_per_unit: a.wtt,
            electricity_consumption_kwh_per_km: a.elecUse,
            charging_loss_pct: 10,
            grid_factor_kgco2e_per_kwh: gridFactor,
            electric_utility_factor: a.uf,
            maintenance_kgco2e: 450,
            eol_allocation_method: 'Cut-off (Recycled Content)',
            eol_dismantling_processing_kgco2e: 180
          })
        }).then(r => r.json())
      )
    ).then(results => {
      setComparisonResults(results);
    });
  }, [components, lifetimeKm, gridFactor, recycledAluShare, h2Pathway]);

  const chartData = comparisonResults.map(r => ({
    name: r.scenario_name.replace(/^\d+\.\s*/, ''),
    Materials_and_Glider: r.stages.material_production.point + r.stages.component_and_process_manufacturing.point,
    Battery_Pack: r.stages.battery_pack_production.point,
    Use_Tailpipe_TTW: r.stages.use_phase_tailpipe.point,
    Use_Upstream_WTT_or_Grid: r.stages.use_phase_upstream.point,
    Maintenance_and_EoL: r.stages.maintenance.point + r.stages.end_of_life_net.point,
    total_min: r.totals.total_kgco2e.min,
    total_point: r.totals.total_kgco2e.point,
    total_max: r.totals.total_kgco2e.max,
    g_per_km: r.totals.g_co2e_per_km.point
  }));

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-900 text-white">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Multi-Powertrain Lifecycle Comparison (All 7 Section 8 Archetypes)
              </h2>
              <p className="text-xs text-slate-500">
                Harmonised comparison across Petrol, Diesel, CNG, HEV, PHEV, BEV, and FCEV under identical functional unit and Well-to-Wheel boundaries.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3.5 flex items-start gap-2.5 text-xs text-blue-900">
          <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
          <div>
            <strong>Boundary & Comparability Notice:</strong> All 7 archetypes below use the 1,137 kg EU SWD(2023) 256 depolluted material composition baseline and full Well-to-Wheel (TTW + WTT/Grid) energy chains over {lifetimeKm.toLocaleString()} km. Adjust the Indian grid carbon intensity or hydrogen production pathway below to observe real-time sensitivity.
          </div>
        </div>

        {/* Interactive Sensitivity Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-100 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Functional Unit Distance: <span className="font-mono text-emerald-700">{lifetimeKm.toLocaleString()} km</span>
            </label>
            <input
              type="range"
              min={80000}
              max={250000}
              step={10000}
              value={lifetimeKm}
              onChange={e => setLifetimeKm(Number(e.target.value))}
              className="w-full accent-emerald-600"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Grid Electricity Factor: <span className="font-mono text-emerald-700">{gridFactor} kg CO2/kWh</span>
            </label>
            <input
              type="range"
              min={0.05}
              max={0.95}
              step={0.02}
              value={gridFactor}
              onChange={e => setGridFactor(Number(e.target.value))}
              className="w-full accent-emerald-600"
            />
            <div className="text-[10px] text-slate-400">0.05 (Renewable) → 0.72 (India Grid) → 0.95 (Coal)</div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Recycled Aluminium Share: <span className="font-mono text-emerald-700">{recycledAluShare}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={recycledAluShare}
              onChange={e => setRecycledAluShare(Number(e.target.value))}
              className="w-full accent-emerald-600"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">FCEV Hydrogen Pathway (IEA 2024)</label>
            <select
              value={h2Pathway}
              onChange={e => setH2Pathway(e.target.value as any)}
              className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-medium"
            >
              <option value="ng">Unabated Natural Gas (~11 kg CO2e/kg H2)</option>
              <option value="coal">Unabated Coal (~24 kg CO2e/kg H2)</option>
              <option value="green">Low-Carbon Electrolytic (~2.5 kg CO2e/kg H2)</option>
            </select>
          </div>
        </div>

        {/* Stacked Lifecycle Bar Chart */}
        <div className="h-80 pt-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 45 }}>
              <XAxis dataKey="name" angle={-18} textAnchor="end" interval={0} tick={{ fontSize: 11 }} />
              <YAxis label={{ value: 'Total Lifecycle kg CO2e', angle: -90, position: 'insideLeft', fontSize: 11 }} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend verticalAlign="top" />
              <Bar dataKey="Materials_and_Glider" name="Glider Materials & Mfg" stackId="a" fill="#475569" />
              <Bar dataKey="Battery_Pack" name="Traction Battery Pack" stackId="a" fill="#0d9488" />
              <Bar dataKey="Use_Tailpipe_TTW" name="Use Phase: Tailpipe (TTW)" stackId="a" fill="#e11d48" />
              <Bar dataKey="Use_Upstream_WTT_or_Grid" name="Use Phase: Upstream Fuel / Grid Electricity" stackId="a" fill="#f59e0b" />
              <Bar dataKey="Maintenance_and_EoL" name="Maintenance & EoL" stackId="a" fill="#94a3b8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Comparison Matrix Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-slate-200 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Archetype Powertrain</th>
                <th className="py-3 px-4 text-right">Glider Materials & Mfg</th>
                <th className="py-3 px-4 text-right">Battery Pack</th>
                <th className="py-3 px-4 text-right">Tailpipe (TTW)</th>
                <th className="py-3 px-4 text-right">Upstream / Grid (WTT)</th>
                <th className="py-3 px-4 text-right">Total Range (Min–Max kg)</th>
                <th className="py-3 px-4 text-right">Intensity (g CO2e/km)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {chartData.map(row => (
                <tr key={row.name} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-bold text-slate-900">{row.name}</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-700">{row.Materials_and_Glider.toLocaleString()} kg</td>
                  <td className="py-3 px-4 text-right font-mono text-teal-800 font-semibold">{row.Battery_Pack.toLocaleString()} kg</td>
                  <td className="py-3 px-4 text-right font-mono text-rose-700">{row.Use_Tailpipe_TTW.toLocaleString()} kg</td>
                  <td className="py-3 px-4 text-right font-mono text-amber-800">{row.Use_Upstream_WTT_or_Grid.toLocaleString()} kg</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-800">
                    {row.total_min.toLocaleString()} – {row.total_max.toLocaleString()} kg
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-800 bg-emerald-50/50">
                    {row.g_per_km.toFixed(1)} g/km
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
