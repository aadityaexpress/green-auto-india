import React, { useEffect, useState } from 'react';
import { QualityBadge, RecordDetailModal } from './SharedBadges.js';
import { Car, ArrowRight, ShieldAlert, ExternalLink } from 'lucide-react';

export function VehicleExplorerView({
  onOpenInCalculator
}: {
  onOpenInCalculator: (vehicle: any) => void;
}) {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [powertrainFilter, setPowertrainFilter] = useState('All');
  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);

  useEffect(() => {
    fetch('/api/vehicles')
      .then(r => r.json())
      .then(d => setVehicles(d))
      .catch(() => {});
  }, []);

  const powertrains = ['All', ...Array.from(new Set(vehicles.map(v => v.powertrain)))];
  const filtered = vehicles.filter(v => powertrainFilter === 'All' || v.powertrain === powertrainFilter);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Vehicle Explorer — Representative Case-Study Archetypes & Retail Models (Section 8)
            </h2>
            <p className="text-xs text-slate-500">
              Separates published representative archetypes (ICEV, Diesel, CNG, HEV, PHEV, BEV, FCEV) from retail specifications.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {powertrains.map(pt => (
              <button
                key={pt}
                onClick={() => setPowertrainFilter(pt)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                  powertrainFilter === pt ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {pt}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 flex items-start gap-2.5 text-xs text-amber-900">
          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <strong>Important Limitation on Vehicle-Specific Data (Page 1 & Section 8):</strong> Manufacturers rarely publish a complete bill of materials (BOM) and factory-gate CO2e for each retail model/variant. Accordingly, the 7 entries below are <strong>evidence-backed representative archetypes</strong> (using the 1,137 kg EU SWD(2023) 256 composition baseline and GREET/India LCA methods), NOT claims that named retail cars have publicly disclosed full BOMs.
          </div>
        </div>
      </div>

      {/* Vehicle Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filtered.map(v => (
          <div
            key={v.vehicle_id}
            className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between space-y-4 hover:border-emerald-400 transition"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Car className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-mono text-slate-400">{v.vehicle_id}</span>
                    <h3 className="text-base font-bold text-slate-900">{v.model}</h3>
                    <div className="text-xs text-slate-500">
                      {v.manufacturer} • {v.variant}
                    </div>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-slate-900 text-white text-xs font-semibold whitespace-nowrap">
                  {v.powertrain}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <QualityBadge status={v.lca_data_status} />
                <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                  Glider Ref Mass: {v.glider_reference_mass_kg || 1137} kg
                </span>
                {v.battery_capacity_kwh && (
                  <span className="text-xs font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Battery: {v.battery_capacity_kwh} kWh
                  </span>
                )}
              </div>

              <div className="space-y-2 text-xs bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                <div>
                  <span className="font-semibold text-slate-800">Material / Component Coverage: </span>
                  <span className="text-slate-700">{v.material_coverage_notes}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-800">Public Data to Collect: </span>
                  <span className="text-slate-700">{v.public_data_to_collect}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-800">Manufacturing Emissions Approach: </span>
                  <span className="text-slate-700">{v.manufacturing_emissions_approach}</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                onClick={() => setSelectedVehicle(v)}
                className="text-xs font-medium text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
              >
                <span>Inspect Full SQL Record</span>
                <ExternalLink className="w-3 h-3" />
              </button>

              <button
                onClick={() => onOpenInCalculator(v)}
                className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition"
              >
                <span>Configure in Lifecycle Calculator</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <RecordDetailModal record={selectedVehicle} onClose={() => setSelectedVehicle(null)} />
    </div>
  );
}
