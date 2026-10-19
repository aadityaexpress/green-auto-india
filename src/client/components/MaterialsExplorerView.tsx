import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { QualityBadge, GeographyBadge, RecordDetailModal } from './SharedBadges.js';
import { AlertCircle } from 'lucide-react';

export function MaterialsExplorerView() {
  const [materials, setMaterials] = useState<any[]>([]);
  const [routeFilter, setRouteFilter] = useState('All');
  const [selectedMat, setSelectedMat] = useState<any | null>(null);

  useEffect(() => {
    fetch('/api/materials')
      .then(r => r.json())
      .then(d => setMaterials(d))
      .catch(() => {});
  }, []);

  const filtered = materials.filter(m => {
    if (routeFilter === 'All') return true;
    return m.primary_or_recycled === routeFilter;
  });

  const chartData = filtered
    .filter(m => typeof m.factor_min === 'number' && typeof m.factor_max === 'number')
    .map(m => ({
      name: m.name.length > 26 ? m.name.slice(0, 26) + '…' : m.name,
      fullName: m.name,
      min: m.factor_min,
      spread: Number((m.factor_max - m.factor_min).toFixed(2)),
      max: m.factor_max,
      route: m.primary_or_recycled
    }));

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Materials Explorer — Cradle-to-Gate Screening Emission Factors
            </h2>
            <p className="text-xs text-slate-500">
              Section 2 Reference Data Pack: Screening bands are displayed as explicit Min–Max ranges (kg CO2e/kg) rather than false-precision single numbers. Primary and recycled routes are strictly separated.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Route Filter:</span>
            {['All', 'Primary', 'Recycled/Secondary', 'Mixed/Unspecified', 'Pack/Assembly'].map(rt => (
              <button
                key={rt}
                onClick={() => setRouteFilter(rt)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                  routeFilter === rt ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {rt}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2.5 text-xs text-amber-900">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <strong>Range Caveat (Section 2):</strong> These are order-of-magnitude screening bands assembled from LCA literature (GREET, University of Michigan CSS 2012, Mamarikas et al. 2026), not harmonised India-specific factors. Notice the dramatic difference between <strong>Primary Aluminium (~8–18 kg CO2e/kg)</strong> and <strong>Recycled/Secondary Aluminium (~0.5–2.5 kg CO2e/kg)</strong>.
          </div>
        </div>

        {/* Min-Max Screening Band Chart */}
        <div className="h-72 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 45 }}>
              <XAxis dataKey="name" angle={-20} textAnchor="end" interval={0} tick={{ fontSize: 11 }} />
              <YAxis label={{ value: 'kg CO2e / kg material', angle: -90, position: 'insideLeft', fontSize: 11 }} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(_val: any, name: string, props: any) => {
                  const p = props.payload;
                  if (name === 'Lower Bound (Min)') return [`${p.min} kg CO2e/kg`, 'Minimum Factor'];
                  return [`${p.min} – ${p.max} kg CO2e/kg`, 'Full Screening Band'];
                }}
              />
              <Legend verticalAlign="top" />
              <Bar dataKey="min" name="Lower Bound (Min)" stackId="a" fill="#059669" />
              <Bar dataKey="spread" name="Upper Range Spread (Min → Max)" stackId="a" fill="#6ee7b7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Materials Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-slate-200 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Material & Grade</th>
                <th className="py-3 px-4">Production Route & Status</th>
                <th className="py-3 px-4">Screening Range / Value</th>
                <th className="py-3 px-4">Unit & Boundary</th>
                <th className="py-3 px-4">Geography & Year</th>
                <th className="py-3 px-4">Quality & Limitations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map(m => (
                <tr
                  key={m.material_id}
                  onClick={() => setSelectedMat(m)}
                  className="hover:bg-emerald-50/40 cursor-pointer transition"
                >
                  <td className="py-3.5 px-4 align-top">
                    <div className="font-semibold text-slate-900 text-sm">{m.name}</div>
                    <div className="text-slate-500 mt-0.5">{m.grade_or_type}</div>
                    <div className="font-mono text-[11px] text-slate-400 mt-0.5">{m.material_id}</div>
                  </td>
                  <td className="py-3.5 px-4 align-top">
                    <span
                      className={`inline-block px-2 py-0.5 rounded font-semibold text-[11px] ${
                        m.primary_or_recycled === 'Recycled/Secondary'
                          ? 'bg-emerald-100 text-emerald-900'
                          : m.primary_or_recycled === 'Primary'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {m.primary_or_recycled}
                    </span>
                    <div className="text-slate-600 mt-1">{m.production_route}</div>
                    {m.recycled_content_pct !== null && (
                      <div className="font-mono text-[11px] text-emerald-700 mt-0.5">
                        Recycled Content: {m.recycled_content_pct}%
                      </div>
                    )}
                  </td>
                  <td className="py-3.5 px-4 align-top font-mono font-bold text-slate-900 whitespace-nowrap">
                    {typeof m.factor_min === 'number' && typeof m.factor_max === 'number' ? (
                      <span className="px-2 py-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-900">
                        ~{m.factor_min} – {m.factor_max}
                      </span>
                    ) : typeof m.factor_value === 'number' ? (
                      <span>{m.factor_value}</span>
                    ) : (
                      <span className="text-amber-700 font-normal text-[11px]">{m.uncertainty_or_range}</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 align-top whitespace-nowrap">
                    <div className="font-mono text-slate-800">{m.unit}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{m.system_boundary}</div>
                  </td>
                  <td className="py-3.5 px-4 align-top whitespace-nowrap">
                    <GeographyBadge geo={m.geography} />
                    <div className="font-mono text-[11px] text-slate-500 mt-1">Year: {m.reference_year}</div>
                  </td>
                  <td className="py-3.5 px-4 align-top max-w-xs">
                    <QualityBadge status={m.data_quality_status} />
                    <p className="text-slate-600 mt-1.5 leading-snug">{m.notes_and_limitations}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <RecordDetailModal record={selectedMat} onClose={() => setSelectedMat(null)} />
    </div>
  );
}
