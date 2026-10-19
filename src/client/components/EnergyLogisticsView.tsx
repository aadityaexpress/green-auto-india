import React, { useEffect, useState } from 'react';
import { QualityBadge, GeographyBadge, RecordDetailModal } from './SharedBadges.js';
import { Zap, Truck, AlertCircle, ExternalLink } from 'lucide-react';

export function EnergyLogisticsView() {
  const [energy, setEnergy] = useState<any[]>([]);
  const [logistics, setLogistics] = useState<any[]>([]);
  const [geoFilter, setGeoFilter] = useState('All');
  const [boundaryFilter, setBoundaryFilter] = useState('All');
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

  useEffect(() => {
    fetch('/api/energy-factors')
      .then(r => r.json())
      .then(d => setEnergy(d))
      .catch(() => {});
    fetch('/api/logistics-factors')
      .then(r => r.json())
      .then(d => setLogistics(d))
      .catch(() => {});
  }, []);

  const filteredEnergy = energy.filter(e => {
    if (geoFilter !== 'All' && !e.geography.toLowerCase().includes(geoFilter.toLowerCase())) return false;
    if (boundaryFilter !== 'All' && !e.lifecycle_boundary.toLowerCase().includes(boundaryFilter.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Section 5 Energy Carriers */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Energy Carriers & Fuel-Cycle Greenhouse Emissions (Section 5)
              </h2>
              <p className="text-xs text-slate-500">
                Explicitly distinguishes Tank-to-Wheel (combustion only), Well-to-Tank (upstream production & delivery), and Full Well-to-Wheel chains.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={geoFilter}
              onChange={e => setGeoFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
            >
              <option value="All">All Geographies</option>
              <option value="India">India-Specific</option>
              <option value="Global">Global (IEA 2024)</option>
            </select>

            <select
              value={boundaryFilter}
              onChange={e => setBoundaryFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
            >
              <option value="All">All Lifecycle Boundaries</option>
              <option value="Tank-to-Wheel">Tank-to-Wheel (Combustion Only)</option>
              <option value="Well-to-Tank">Well-to-Tank (Upstream Production)</option>
              <option value="Well-to-Wheel">Well-to-Wheel / Full Lifecycle</option>
              <option value="Generation Grid Mix">Generation Grid Mix (CEA)</option>
              <option value="Cradle-to-Gate H2">Cradle-to-Gate H2 Production</option>
            </select>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 flex items-start gap-2.5 text-xs text-amber-900">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <strong>Boundary Discipline (Section 5):</strong> Keep tailpipe combustion (TTW) and upstream extraction/refining (WTT) separate; <strong>never compare combustion-only petrol with lifecycle electricity</strong>. For Indian grid electricity, record the exact CEA CO2 Baseline Database fiscal year and margin type (weighted-average, operating margin, combined margin).
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-slate-200 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Energy Carrier & Pathway</th>
                <th className="py-3 px-4">Sourced Value / Guidance</th>
                <th className="py-3 px-4">Unit & Lifecycle Boundary</th>
                <th className="py-3 px-4">Geography & Year</th>
                <th className="py-3 px-4">Critical Caveat & Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredEnergy.map(e => (
                <tr
                  key={e.energy_id}
                  onClick={() => setSelectedRecord(e)}
                  className="hover:bg-emerald-50/40 cursor-pointer transition"
                >
                  <td className="py-3.5 px-4 align-top">
                    <div className="font-semibold text-slate-900 text-sm">{e.carrier}</div>
                    <div className="text-slate-600 mt-0.5">{e.pathway}</div>
                    <div className="font-mono text-[11px] text-slate-400 mt-0.5">{e.energy_id}</div>
                  </td>
                  <td className="py-3.5 px-4 align-top">
                    {typeof e.factor_min === 'number' && typeof e.factor_max === 'number' ? (
                      <span className="inline-block font-mono font-bold text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                        ~{e.factor_min} – {e.factor_max} {e.unit}
                      </span>
                    ) : typeof e.factor_value === 'number' ? (
                      <span className="font-mono font-bold text-slate-900">
                        {e.factor_value} {e.unit}
                      </span>
                    ) : (
                      <span className="text-slate-700 font-medium">{e.factor_type_details}</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 align-top">
                    <div className="font-mono text-slate-800">{e.unit}</div>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px] border border-slate-200">
                      {e.lifecycle_boundary}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 align-top whitespace-nowrap">
                    <GeographyBadge geo={e.geography} />
                    <div className="font-mono text-[11px] text-slate-500 mt-1">Ref: {e.reference_year}</div>
                  </td>
                  <td className="py-3.5 px-4 align-top max-w-sm">
                    <QualityBadge status={e.data_quality_status} />
                    <p className="text-slate-700 mt-1.5 leading-snug">{e.critical_caveat}</p>
                    {e.source_url && (
                      <div className="mt-1 text-[11px] text-emerald-700 flex items-center gap-1">
                        <span>{e.source_id}</span>
                        <ExternalLink className="w-3 h-3" />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 6 Transportation and Logistics */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-slate-100 text-slate-800">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Transportation & Logistics Emission Layers (Section 6)
            </h2>
            <p className="text-xs text-slate-500">
              Formula: <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">E_transport = freight_tonnes × distance_km × factor_kgCO2e_per_tonne_km</code>. Avoid double counting logistics already included in supplier cradle-to-gate datasets.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {logistics.map(l => (
            <div
              key={l.mode_id}
              onClick={() => setSelectedRecord(l)}
              className="p-4 rounded-xl border border-slate-200 hover:border-emerald-400 cursor-pointer transition bg-slate-50/50 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-slate-900 text-sm">{l.transport_mode}</div>
                  <div className="text-xs text-slate-600">{l.vehicle_or_ship_class}</div>
                </div>
                <GeographyBadge geo={l.geography} />
              </div>
              <div className="text-xs font-mono text-slate-800 bg-white px-3 py-2 rounded border border-slate-200">
                {typeof l.factor_kgco2e_per_tonne_km === 'number'
                  ? `Factor: ${l.factor_kgco2e_per_tonne_km} ${l.unit}`
                  : `Unit: ${l.unit} • Traction: ${l.fuel_or_traction}`}
              </div>
              <QualityBadge status={l.data_quality_status} />
              <p className="text-xs text-slate-600 leading-relaxed pt-1">{l.notes}</p>
            </div>
          ))}
        </div>
      </div>

      <RecordDetailModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
    </div>
  );
}
