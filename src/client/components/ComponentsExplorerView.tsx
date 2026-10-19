import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { QualityBadge, GeographyBadge, RecordDetailModal } from './SharedBadges.js';
import { Info } from 'lucide-react';

export function ComponentsExplorerView() {
  const [components, setComponents] = useState<any[]>([]);
  const [selectedPowertrainId, setSelectedPowertrainId] = useState('COMP-BOM-ICEV-EU');
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

  useEffect(() => {
    fetch('/api/components')
      .then(r => r.json())
      .then(d => setComponents(d))
      .catch(() => {});
  }, []);

  const wholeBoms = components.filter(c => c.component_category === 'Whole Vehicle Representative BOM');
  const subsystems = components.filter(c => c.component_category !== 'Whole Vehicle Representative BOM');

  const activeBom = wholeBoms.find(b => b.component_id === selectedPowertrainId) || wholeBoms[0];

  // Build side-by-side comparison data across ICEV, HEV, PHEV, BEV for Section 3 Table
  const materialNames = [
    'Steel',
    'Cast iron',
    'Wrought aluminium',
    'Cast aluminium',
    'Copper',
    'Magnesium',
    'Manganese',
    'Glass',
    'Average plastics',
    'Rubber',
    'Glass-fibre reinforced plastic',
    'Other'
  ];

  const comparisonRows = materialNames.map(matName => {
    const getKg = (id: string) => {
      const bom = wholeBoms.find(b => b.component_id === id);
      if (!bom || !bom.material_breakdown) return 0;
      const found = bom.material_breakdown.find((m: any) => m.material_name === matName);
      return found ? found.mass_kg : 0;
    };
    return {
      material: matName,
      ICEV: getKg('COMP-BOM-ICEV-EU'),
      HEV: getKg('COMP-BOM-HEV-EU'),
      PHEV: getKg('COMP-BOM-PHEV-EU'),
      BEV: getKg('COMP-BOM-BEV-EU')
    };
  });

  return (
    <div className="space-y-6">
      {/* Header & Section 3 Provenance Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Components & Representative Vehicle Material Composition (Section 3)
            </h2>
            <p className="text-xs text-slate-500">
              Source: European Commission SWD(2023) 256 based on JRC-RMIS and Argonne GREET (2021), scaled to 1,137 kg after depollution.
            </p>
          </div>
          <GeographyBadge geo="European Union (EU Average Baseline)" />
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3.5 flex items-start gap-2.5 text-xs text-blue-900">
          <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
          <div>
            <strong>Important Scientific Limitation (Section 3):</strong> These masses are a published European end-of-life passenger-car composition dataset (1,137 kg depolluted baseline). They are useful as a transparent representative baseline across <strong>ICEV, HEV, PHEV, and BEV</strong>, NOT an exact disclosed bill of materials (BOM) for a named Indian retail car.
          </div>
        </div>

        {/* Grouped Bar Chart Comparing Powertrain Material Shifts */}
        <div className="h-80 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparisonRows} margin={{ top: 10, right: 20, left: 10, bottom: 45 }}>
              <XAxis dataKey="material" angle={-22} textAnchor="end" interval={0} tick={{ fontSize: 11 }} />
              <YAxis label={{ value: 'Mass (kg / 1,137 kg vehicle)', angle: -90, position: 'insideLeft', fontSize: 11 }} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend verticalAlign="top" />
              <Bar dataKey="ICEV" fill="#475569" />
              <Bar dataKey="HEV" fill="#0ea5e9" />
              <Bar dataKey="PHEV" fill="#6366f1" />
              <Bar dataKey="BEV" fill="#059669" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Interactive Powertrain Selector & Complete Section 3 Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider">
                Section 3 Table: Representative Vehicle Material Composition (kg)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                All four powertrains total 1,137 kg after depollution (SWD(2023) 256)
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <th className="py-2.5 px-4">Material (kg)</th>
                  <th className="py-2.5 px-4 text-right font-mono">ICEV</th>
                  <th className="py-2.5 px-4 text-right font-mono">HEV</th>
                  <th className="py-2.5 px-4 text-right font-mono">PHEV</th>
                  <th className="py-2.5 px-4 text-right font-mono text-emerald-800">BEV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {comparisonRows.map(r => (
                  <tr key={r.material} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-medium text-slate-900">{r.material}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-700">{r.ICEV}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-700">{r.HEV}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-700">{r.PHEV}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-emerald-800">{r.BEV}</td>
                  </tr>
                ))}
                <tr className="bg-slate-900 text-white font-bold">
                  <td className="py-3 px-4">Total (Depolluted Baseline)</td>
                  <td className="py-3 px-4 text-right font-mono">1,137 kg</td>
                  <td className="py-3 px-4 text-right font-mono">1,137 kg</td>
                  <td className="py-3 px-4 text-right font-mono">1,137 kg</td>
                  <td className="py-3 px-4 text-right font-mono text-emerald-400">1,137 kg</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Powertrain Cradle-to-Gate Material Screening Preview */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Inspect Powertrain BOM & Mass Fractions
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {wholeBoms.map(b => (
                <button
                  key={b.component_id}
                  onClick={() => setSelectedPowertrainId(b.component_id)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border text-left transition ${
                    selectedPowertrainId === b.component_id
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {b.applicable_powertrain}
                </button>
              ))}
            </div>

            {activeBom && (
              <div className="space-y-2 pt-2">
                <div className="text-xs font-semibold text-slate-900">{activeBom.component_name}</div>
                <QualityBadge status={activeBom.confidence_status} />
                <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 mt-2">
                  {(activeBom.material_breakdown || []).map((m: any, i: number) => (
                    <div key={i} className="px-3 py-2 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-medium text-slate-800">{m.material_name}</span>
                        <span className="text-slate-400 font-mono ml-1.5">({m.mass_fraction_pct}%)</span>
                      </div>
                      <div className="font-mono font-semibold text-slate-900">{m.mass_kg} kg</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {activeBom && (
            <button
              onClick={() => setSelectedRecord(activeBom)}
              className="w-full py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition"
            >
              View Full Provenance & JSON Split
            </button>
          )}
        </div>
      </div>

      {/* Qualitative Subsystem Mappings from Section 3 */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
            Automotive Subsystem Material & Process Mapping (Section 3 Qualitative Guidance)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Representative material mix by major vehicle system. Do not assign generic component percentages to a named retail model unless the source supports it.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subsystems.map(sub => {
            let parsedMix: any[] = [];
            try {
              parsedMix = JSON.parse(sub.material_composition_json || '[]');
            } catch {}
            return (
              <div
                key={sub.component_id}
                onClick={() => setSelectedRecord(sub)}
                className="p-4 rounded-xl border border-slate-200 hover:border-emerald-400 cursor-pointer transition bg-slate-50/50 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-sm text-slate-900">{sub.component_name}</div>
                  <span className="text-[11px] font-mono text-slate-400">{sub.component_id}</span>
                </div>
                <div className="text-xs text-emerald-800 font-medium">{sub.applicable_powertrain}</div>
                <div className="space-y-1">
                  {parsedMix.map((item, idx) => (
                    <div key={idx} className="text-xs text-slate-700 bg-white px-2.5 py-1.5 rounded border border-slate-200">
                      <strong>{item.material_name}:</strong> {item.role}
                    </div>
                  ))}
                </div>
                <div className="text-[11px] text-slate-500 pt-1">
                  <strong>Processes:</strong> {sub.manufacturing_processes}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <RecordDetailModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
    </div>
  );
}
