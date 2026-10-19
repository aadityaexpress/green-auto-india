import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { QualityBadge, GeographyBadge, RecordDetailModal } from './SharedBadges.js';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

export function ProcessesExplorerView() {
  const [processes, setProcesses] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'direct' | 'allocated' | 'all'>('direct');
  const [selectedProc, setSelectedProc] = useState<any | null>(null);

  useEffect(() => {
    fetch('/api/processes')
      .then(r => r.json())
      .then(d => setProcesses(d))
      .catch(() => {});
  }, []);

  const directProcesses = processes.filter(p => p.is_allocated_facility_service === 0 && p.process_emissions_kgco2e !== null);
  const allocatedProcesses = processes.filter(p => p.is_allocated_facility_service === 1);

  const displayedTable = processes.filter(p => {
    if (viewMode === 'direct') return p.is_allocated_facility_service === 0;
    if (viewMode === 'allocated') return p.is_allocated_facility_service === 1;
    return true;
  });

  const chartData = (viewMode === 'allocated' ? allocatedProcesses : directProcesses).map(p => ({
    name: p.process_name.length > 22 ? p.process_name.slice(0, 22) + '…' : p.process_name,
    energy_mj: p.energy_consumption_mj,
    co2_kg: p.process_emissions_kgco2e
  }));

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Manufacturing Process Energy & Emissions (Section 4 — PMC10890010 Table 4)
            </h2>
            <p className="text-xs text-slate-500">
              Values reproduced from peer-reviewed open-access study (2024) citing GREET and literature for a 1,532 kg reference passenger car.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setViewMode('direct')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                viewMode === 'direct' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Direct Component Processes (10)
            </button>
            <button
              onClick={() => setViewMode('allocated')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                viewMode === 'allocated' ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Allocated Facility Services (6)
            </button>
            <button
              onClick={() => setViewMode('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                viewMode === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All 16 Records
            </button>
          </div>
        </div>

        {/* Critical Scientific Caveats from Section 4 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 flex items-start gap-2.5 text-xs text-amber-900">
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong>Allocated Facility Services Warning (Section 4):</strong> Very high values in Table 4 (e.g., <strong>Painting = 4,167 MJ & 268 kg CO2/kg</strong>; <strong>Welding = 920 MJ & 62 kg CO2/kg</strong>; <strong>HVAC & lighting = 3,335 MJ & 225 kg CO2/kg</strong>) represent allocated facility energy/services per reference unit, NOT direct per-kg vehicle mass factors. Never multiply them by total vehicle mass!
            </div>
          </div>

          <div className="bg-slate-100 border border-slate-300 rounded-lg p-3.5 flex items-start gap-2.5 text-xs text-slate-800">
            <AlertTriangle className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
            <div>
              <strong>Polymer Injection Moulding Data Gap (Section 4):</strong> Moulding is NOT separately listed in Table 4. For polymer injection moulding, use a process-specific inventory (polymer type, machine energy, part mass, cycle time, scrap rate) — <strong>do NOT silently substitute the generic machining factor (2.015 MJ/kg)</strong>.
            </div>
          </div>
        </div>

        {/* Process Energy & CO2 Chart */}
        <div className="h-72 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 45 }}>
              <XAxis dataKey="name" angle={-20} textAnchor="end" interval={0} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" orientation="left" stroke="#059669" tick={{ fontSize: 11 }} label={{ value: 'kg CO2 / kg processed', angle: -90, position: 'insideLeft', fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" stroke="#475569" tick={{ fontSize: 11 }} label={{ value: 'Energy (MJ / kg)', angle: 90, position: 'insideRight', fontSize: 11 }} />
              <Tooltip />
              <Legend verticalAlign="top" />
              <Bar yAxisId="left" dataKey="co2_kg" name="Process CO2 (kg CO2/kg processed)" fill="#059669" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="energy_mj" name="Process Energy (MJ/kg processed)" fill="#64748b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Processes Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-slate-200 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Process Name & Category</th>
                <th className="py-3 px-4">Material / Component Applicability</th>
                <th className="py-3 px-4 text-right">Energy (MJ/unit)</th>
                <th className="py-3 px-4 text-right">Emissions (kg CO2/unit)</th>
                <th className="py-3 px-4">Reference Unit & Boundary</th>
                <th className="py-3 px-4">Status & Limitations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {displayedTable.map(p => (
                <tr
                  key={p.process_id}
                  onClick={() => setSelectedProc(p)}
                  className={`cursor-pointer transition ${
                    p.is_allocated_facility_service
                      ? 'bg-amber-50/30 hover:bg-amber-50/70'
                      : 'hover:bg-emerald-50/40'
                  }`}
                >
                  <td className="py-3.5 px-4 align-top">
                    <div className="font-semibold text-slate-900 text-sm">{p.process_name}</div>
                    <div className="text-slate-500 mt-0.5">{p.process_category}</div>
                    <div className="font-mono text-[11px] text-slate-400 mt-0.5">{p.process_id}</div>
                  </td>
                  <td className="py-3.5 px-4 align-top max-w-xs text-slate-700">
                    {p.applicability}
                    <div className="mt-1">
                      <GeographyBadge geo={p.geography} />
                    </div>
                  </td>
                  <td className="py-3.5 px-4 align-top text-right font-mono font-semibold text-slate-800 whitespace-nowrap">
                    {p.energy_consumption_mj !== null ? `${p.energy_consumption_mj.toLocaleString()} MJ` : 'MISSING'}
                  </td>
                  <td className="py-3.5 px-4 align-top text-right font-mono font-bold text-emerald-900 whitespace-nowrap">
                    {p.process_emissions_kgco2e !== null ? `${p.process_emissions_kgco2e} kg CO2` : 'MISSING'}
                  </td>
                  <td className="py-3.5 px-4 align-top">
                    <div className="font-mono text-slate-800">{p.reference_unit}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{p.system_boundary}</div>
                  </td>
                  <td className="py-3.5 px-4 align-top max-w-sm">
                    <QualityBadge status={p.data_quality_status} />
                    <p className="text-slate-600 mt-1.5 leading-snug">{p.limitations}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <RecordDetailModal record={selectedProc} onClose={() => setSelectedProc(null)} />
    </div>
  );
}
