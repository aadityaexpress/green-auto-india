import React, { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import {
  FileCheck2,
  Save,
  Download,
  RotateCcw,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Sliders,
  Layers,
  History
} from 'lucide-react';
import { QualityBadge, GeographyBadge } from './SharedBadges.js';

export function CaseStudyView() {
  const [config, setConfig] = useState<any | null>(null);
  const [report, setReport] = useState<any | null>(null);
  const [savedRuns, setSavedRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [savedToast, setSavedToast] = useState<string>('');
  const [errorBanner, setErrorBanner] = useState<string>('');
  const [activeSensitivityTab, setActiveSensitivityTab] = useState<string>('Grid Carbon Intensity');

  const fetchSavedRuns = () => {
    fetch('/api/case-study/saved')
      .then(r => r.json())
      .then(d => setSavedRuns(Array.isArray(d) ? d : []))
      .catch(() => {});
  };

  const executeRun = (cfgToRun: any, saveToDb = false) => {
    setLoading(true);
    setErrorBanner('');
    fetch('/api/case-study/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: cfgToRun, save_to_db: saveToDb })
    })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Failed to execute case study');
        return d;
      })
      .then(d => {
        setReport(d);
        setLoading(false);
        if (saveToDb) {
          setSavedToast(`Saved reproducible run ${d.run_id} to SQLite (case_study_runs & vehicle_lca_results).`);
          fetchSavedRuns();
          setTimeout(() => setSavedToast(''), 4500);
        }
      })
      .catch(err => {
        setErrorBanner(err.message || 'Calculation error occurred');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetch('/api/case-study/default-config')
      .then(r => r.json())
      .then(defaultCfg => {
        setConfig(defaultCfg);
        executeRun(defaultCfg, false);
      });
    fetchSavedRuns();
  }, []);

  const handleResetDefaults = () => {
    fetch('/api/case-study/default-config')
      .then(r => r.json())
      .then(defaultCfg => {
        setConfig(defaultCfg);
        executeRun(defaultCfg, false);
      });
  };

  const updatePowertrainField = (code: string, field: string, val: any) => {
    if (!config) return;
    if (field === 'enabled' && val === false) {
      const enabledCount = Object.values(config.powertrains).filter((p: any) => p.enabled).length;
      if (enabledCount <= 1) {
        setErrorBanner('At least one powertrain scenario must remain enabled for comparative analysis.');
        return;
      }
    }
    const nextCfg = {
      ...config,
      powertrains: {
        ...config.powertrains,
        [code]: {
          ...config.powertrains[code],
          [field]: val
        }
      }
    };
    setConfig(nextCfg);
    executeRun(nextCfg, false);
  };

  const updateTopField = (field: string, val: any) => {
    if (!config) return;
    const nextCfg = { ...config, [field]: val };
    setConfig(nextCfg);
    executeRun(nextCfg, false);
  };

  const handleDownloadMarkdown = () => {
    if (!config) return;
    fetch('/api/case-study/export-markdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config })
    })
      .then(r => r.text())
      .then(mdText => {
        const blob = new Blob([mdText], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `GreenAutoIndia_CaseStudy_${report?.run_id || 'Report'}.md`;
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  const handleDownloadJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GreenAutoIndia_CaseStudy_${report.run_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadHistoricalRun = (savedRow: any) => {
    try {
      const parsedCfg = JSON.parse(savedRow.config_json);
      setConfig(parsedCfg);
      executeRun(parsedCfg, false);
    } catch {}
  };

  if (!config || !report) {
    return (
      <div className="p-10 text-center text-sm font-mono text-slate-500">
        Executing reproducible case study against SQLite database...
      </div>
    );
  }

  // Build Stacked Stage Chart Data
  const stackedStageData = report.scenarios.map((sc: any) => {
    const st = sc.result.stages;
    return {
      name: `${sc.code} (${sc.label.replace(/^\d+\.\s*/, '').split('(')[0].trim()})`,
      code: sc.code,
      Materials_CradleToGate: st.material_production.point,
      Traction_Battery_Pack: st.battery_pack_production.point,
      Component_and_Plant_Mfg: st.component_and_process_manufacturing.point,
      Logistics: st.logistics_and_transport.point,
      Use_Tailpipe_TTW: st.use_phase_tailpipe.point,
      Use_Upstream_WTT_Grid: st.use_phase_upstream.point,
      Maintenance_and_EoL: st.maintenance.point + st.end_of_life_net.point
    };
  });

  // Build Min / Midpoint / Max Range Comparison Chart Data
  const rangeChartData = report.scenarios.map((sc: any) => ({
    name: sc.code,
    Min_kgCO2e: sc.result.totals.total_kgco2e.min,
    Midpoint_kgCO2e: sc.result.totals.total_kgco2e.point,
    Max_kgCO2e: sc.result.totals.total_kgco2e.max
  }));

  const sensitivityDimensions = [
    'Grid Carbon Intensity',
    'Lifetime Distance (Functional Unit)',
    'Recycled Material Shares',
    'Battery Pack Manufacturing Intensity'
  ];

  const filteredSensitivityRows = report.sensitivity_suites.filter(
    (s: any) => s.dimension === activeSensitivityTab
  );

  return (
    <div className="space-y-6">
      {/* 1. Title & Scientific Framing Header */}
      <div className="bg-slate-900 text-white rounded-xl p-6 border border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-2 max-w-4xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>REPRODUCIBLE ENGINEERING CASE STUDY • {report.engine_version}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              {report.study_title}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              <strong>Research Question:</strong> {report.research_question}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => executeRun(config, true)}
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Run to SQLite</span>
            </button>
            <button
              onClick={handleDownloadMarkdown}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Report (.MD)</span>
            </button>
            <button
              onClick={handleDownloadJson}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
          </div>
        </div>

        {/* Modelled Archetype Framing Notice */}
        <div className="p-3.5 rounded-lg bg-slate-800/90 border border-slate-700 text-xs text-slate-300 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            {report.scientific_framing_note}
          </div>
        </div>

        {savedToast && (
          <div className="p-3 rounded-lg bg-emerald-950/90 border border-emerald-500/40 text-xs text-emerald-200 flex items-center gap-2 font-mono">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{savedToast}</span>
          </div>
        )}

        {errorBanner && (
          <div role="alert" className="p-3 rounded-lg bg-rose-950/90 border border-rose-500/40 text-xs text-rose-200 flex items-center justify-between gap-2">
            <span>{errorBanner}</span>
            <button onClick={() => setErrorBanner('')} className="text-rose-300 hover:text-white font-mono text-[11px]">Dismiss</button>
          </div>
        )}

        {loading && (
          <div className="text-[11px] font-mono text-emerald-400">
            Recalculating scenarios from SQLite database...
          </div>
        )}
      </div>

      {/* 2. Interactive Scenario Configuration Panel */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-emerald-700" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Scenario Configuration (Bound to SQLite Archetypes & LCA Calculation Engine)
            </h2>
          </div>
          <button
            onClick={handleResetDefaults}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to 150,000 km Baseline</span>
          </button>
        </div>

        {/* Global Study Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
            <div className="flex justify-between font-semibold text-slate-800">
              <span>Functional Unit Distance</span>
              <span className="font-mono text-emerald-700">{config.lifetime_distance_km.toLocaleString()} km</span>
            </div>
            <input
              type="range"
              min={80000}
              max={250000}
              step={5000}
              value={config.lifetime_distance_km}
              onChange={e => updateTopField('lifetime_distance_km', Number(e.target.value))}
              className="w-full accent-emerald-600"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-400">
              <button onClick={() => updateTopField('lifetime_distance_km', 80000)} className="hover:text-slate-800 underline">80,000 km</button>
              <button onClick={() => updateTopField('lifetime_distance_km', 150000)} className="hover:text-slate-800 underline">150,000 km</button>
              <button onClick={() => updateTopField('lifetime_distance_km', 250000)} className="hover:text-slate-800 underline">250,000 km</button>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
            <div className="flex justify-between font-semibold text-slate-800">
              <span>Indian Grid Factor (CEA)</span>
              <span className="font-mono text-emerald-700">{config.grid_factor_kgco2e_per_kwh} kg/kWh</span>
            </div>
            <input
              type="range"
              min={0.20}
              max={1.00}
              step={0.01}
              value={config.grid_factor_kgco2e_per_kwh}
              onChange={e => updateTopField('grid_factor_kgco2e_per_kwh', Number(e.target.value))}
              className="w-full accent-emerald-600"
            />
            <input
              type="text"
              value={config.grid_reference_year_label}
              onChange={e => updateTopField('grid_reference_year_label', e.target.value)}
              className="w-full text-[11px] border border-slate-300 rounded px-2 py-1 bg-white font-mono"
              title="CEA Reference Year & Margin Type"
            />
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
            <div className="flex justify-between font-semibold text-slate-800">
              <span>Recycled Steel / Al Shares</span>
              <span className="font-mono text-emerald-700">
                Fe: {config.recycled_steel_share_pct}% | Al: {config.recycled_alu_share_pct}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 w-12">Steel:</span>
              <input
                type="range"
                min={0}
                max={100}
                value={config.recycled_steel_share_pct}
                onChange={e => updateTopField('recycled_steel_share_pct', Number(e.target.value))}
                className="flex-1 accent-emerald-600"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 w-12">Alum:</span>
              <input
                type="range"
                min={0}
                max={100}
                value={config.recycled_alu_share_pct}
                onChange={e => updateTopField('recycled_alu_share_pct', Number(e.target.value))}
                className="flex-1 accent-emerald-600"
              />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
            <label className="block font-semibold text-slate-800">Reference Scenario & EoL Allocation</label>
            <div className="grid grid-cols-2 gap-1.5">
              <select
                value={config.reference_powertrain}
                onChange={e => updateTopField('reference_powertrain', e.target.value)}
                className="border border-slate-300 rounded px-2 py-1 bg-white font-semibold"
              >
                <option value="ICEV">Ref: Petrol ICEV</option>
                <option value="HEV">Ref: Full Hybrid HEV</option>
                <option value="BEV">Ref: Battery Electric BEV</option>
                <option value="CNG">Ref: CNG Car</option>
              </select>
              <select
                value={config.eol_allocation_method}
                onChange={e => updateTopField('eol_allocation_method', e.target.value)}
                className="border border-slate-300 rounded px-2 py-1 bg-white"
              >
                <option value="Cut-off (Recycled Content)">EoL: Cut-off</option>
                <option value="Avoided Burden (End-of-Life Recycling Credit)">EoL: Avoided Burden</option>
              </select>
            </div>
            <label className="flex items-center gap-1.5 text-[11px] text-slate-600 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={config.include_logistics_stage}
                onChange={e => {
                  const checked = e.target.checked;
                  const next = {
                    ...config,
                    include_logistics_stage: checked,
                    logistics_distance_km: checked ? 800 : null,
                    logistics_factor_kgco2e_per_tkm: checked ? 0.068 : null
                  };
                  setConfig(next);
                  executeRun(next, false);
                }}
                className="rounded accent-emerald-600"
              />
              <span>Enable Optional Freight Scenario (800 km @ 0.068 kg/t-km)</span>
            </label>
          </div>
        </div>

        {/* Per-Powertrain Cards (ICEV, HEV, BEV, CNG) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {(['ICEV', 'HEV', 'BEV', 'CNG'] as const).map(code => {
            const pt = config.powertrains[code];
            return (
              <div
                key={code}
                className={`p-3.5 rounded-xl border transition space-y-2.5 ${
                  pt.enabled
                    ? 'bg-white border-slate-300 shadow-2xs'
                    : 'bg-slate-50 border-slate-200 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 font-bold text-slate-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pt.enabled}
                      onChange={e => updatePowertrainField(code, 'enabled', e.target.checked)}
                      className="rounded accent-emerald-600"
                    />
                    <span>{code} Scenario</span>
                  </label>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                    {pt.vehicle_id}
                  </span>
                </div>

                {code === 'BEV' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-500">Electricity (kWh/km)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={pt.electricity_consumption_kwh_per_km}
                        onChange={e => updatePowertrainField(code, 'electricity_consumption_kwh_per_km', Number(e.target.value))}
                        className="w-full border border-slate-300 rounded px-2 py-1 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500">Battery (kWh)</label>
                      <input
                        type="number"
                        step="1"
                        value={pt.battery_capacity_kwh}
                        onChange={e => updatePowertrainField(code, 'battery_capacity_kwh', Number(e.target.value))}
                        className="w-full border border-slate-300 rounded px-2 py-1 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500">Pack Min (kg/kWh)</label>
                      <input
                        type="number"
                        value={pt.battery_factor_min}
                        onChange={e => updatePowertrainField(code, 'battery_factor_min', Number(e.target.value))}
                        className="w-full border border-slate-300 rounded px-2 py-1 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500">Pack Max (kg/kWh)</label>
                      <input
                        type="number"
                        value={pt.battery_factor_max}
                        onChange={e => updatePowertrainField(code, 'battery_factor_max', Number(e.target.value))}
                        className="w-full border border-slate-300 rounded px-2 py-1 font-mono"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-500">Economy (km/{pt.fuel_unit})</label>
                      <input
                        type="number"
                        step="0.5"
                        value={pt.fuel_economy_km_per_unit}
                        onChange={e => updatePowertrainField(code, 'fuel_economy_km_per_unit', Number(e.target.value))}
                        className="w-full border border-slate-300 rounded px-2 py-1 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500">Tailpipe TTW (kg/{pt.fuel_unit})</label>
                      <input
                        type="number"
                        step="0.05"
                        value={pt.fuel_tailpipe_factor}
                        onChange={e => updatePowertrainField(code, 'fuel_tailpipe_factor', Number(e.target.value))}
                        className="w-full border border-slate-300 rounded px-2 py-1 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500">Upstream WTT (kg/{pt.fuel_unit})</label>
                      <input
                        type="number"
                        step="0.05"
                        value={pt.fuel_upstream_factor}
                        onChange={e => updatePowertrainField(code, 'fuel_upstream_factor', Number(e.target.value))}
                        className="w-full border border-slate-300 rounded px-2 py-1 font-mono"
                      />
                    </div>
                    {code === 'HEV' && (
                      <div>
                        <label className="block text-[10px] text-slate-500">HEV Buffer (kWh)</label>
                        <input
                          type="number"
                          step="0.5"
                          value={pt.battery_capacity_kwh}
                          onChange={e => updatePowertrainField(code, 'battery_capacity_kwh', Number(e.target.value))}
                          className="w-full border border-slate-300 rounded px-2 py-1 font-mono"
                        />
                      </div>
                    )}
                    {code === 'CNG' && (
                      <div>
                        <label className="block text-[10px] text-slate-500">CNG Cylinder (kg)</label>
                        <input
                          type="number"
                          value={pt.cng_cylinder_extra_steel_kg}
                          onChange={e => updatePowertrainField(code, 'cng_cylinder_extra_steel_kg', Number(e.target.value))}
                          className="w-full border border-slate-300 rounded px-2 py-1 font-mono"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Executive KPI Cards for Each Evaluated Powertrain */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {report.scenarios.map((sc: any) => {
          const isRef = sc.code === report.reference_powertrain;
          const diffPct = sc.comparison_vs_reference.diff_pct_point;
          const totalKg = sc.result.totals.total_kgco2e.point;
          const totalTonnes = (totalKg / 1000).toFixed(2);
          const gKm = sc.result.totals.g_co2e_per_km.point;

          return (
            <div
              key={sc.code}
              className={`rounded-xl p-4 border shadow-xs flex flex-col justify-between space-y-3 ${
                isRef
                  ? 'bg-slate-900 text-white border-slate-800'
                  : 'bg-white text-slate-900 border-slate-200'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-500">
                    {sc.code} ARCHETYPE
                  </span>
                  {isRef ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono">
                      REFERENCE BASELINE
                    </span>
                  ) : (
                    <span
                      className={`px-2 py-0.5 rounded font-mono text-xs font-bold ${
                        diffPct < 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {diffPct > 0 ? `+${diffPct}%` : `${diffPct}%`} vs {report.reference_powertrain}
                    </span>
                  )}
                </div>
                <div className="text-xs opacity-75 mt-0.5 truncate">{sc.label}</div>
              </div>

              <div>
                <div className="text-2xl font-bold font-mono">
                  {totalTonnes} t CO2e
                </div>
                <div className="text-xs font-mono opacity-80">
                  {totalKg.toLocaleString()} kg CO2e • <strong>{gKm.toFixed(1)} g CO2e/km</strong>
                </div>
                <div className="text-[11px] font-mono opacity-75 mt-1">
                  Screening Band: {sc.result.totals.total_kgco2e.min.toLocaleString()} – {sc.result.totals.total_kgco2e.max.toLocaleString()} kg
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/20 text-[11px] flex items-center justify-between">
                <span>BOM: {sc.bom_component_id}</span>
                {sc.comparison_vs_reference.break_even_km_vs_reference && (
                  <span className="font-mono text-emerald-600 font-semibold">
                    Payback: {sc.comparison_vs_reference.break_even_km_vs_reference.toLocaleString()} km
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Side-by-Side Charts: Stage Breakdown + Min/Midpoint/Max Screening Bands */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
            Stage-by-Stage Lifecycle Breakdown (Midpoint kg CO2e over {config.lifetime_distance_km.toLocaleString()} km)
          </h3>
          <p className="text-xs text-slate-500">
            Separates Cradle-to-Gate Materials, Traction Battery Pack, Component Manufacturing, Tailpipe (TTW), and Upstream Fuel/Electricity (WTT/Grid).
          </p>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stackedStageData} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
                <XAxis dataKey="code" tick={{ fontSize: 12, fontWeight: 600 }} />
                <YAxis tick={{ fontSize: 11 }} label={{ value: 'kg CO2e / vehicle', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                <Tooltip />
                <Legend verticalAlign="top" wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="Materials_CradleToGate" name="Cradle-to-Gate Materials" stackId="a" fill="#475569" />
                <Bar dataKey="Traction_Battery_Pack" name="Traction Battery Pack" stackId="a" fill="#0d9488" />
                <Bar dataKey="Component_and_Plant_Mfg" name="Component & Plant Mfg" stackId="a" fill="#64748b" />
                <Bar dataKey="Use_Tailpipe_TTW" name="Use Phase: Tailpipe (TTW)" stackId="a" fill="#e11d48" />
                <Bar dataKey="Use_Upstream_WTT_Grid" name="Use Phase: Upstream / Grid (WTT)" stackId="a" fill="#f59e0b" />
                <Bar dataKey="Maintenance_and_EoL" name="Maintenance & EoL Net" stackId="a" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
            Uncertainty & Screening Range Propagation (Min / Midpoint / Max Total kg CO2e)
          </h3>
          <p className="text-xs text-slate-500">
            Reflects Section 2 material screening ranges (e.g. Steel 1.5–2.8, Primary Al 8–18, Secondary Al 0.5–2.5 kg CO2e/kg) and battery pack factor bounds.
          </p>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rangeChartData} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 600 }} />
                <YAxis tick={{ fontSize: 11 }} label={{ value: 'Total Lifecycle kg CO2e', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                <Tooltip />
                <Legend verticalAlign="top" wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="Min_kgCO2e" name="Lower Screening Bound (Min)" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Midpoint_kgCO2e" name="Midpoint Estimate" fill="#059669" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Max_kgCO2e" name="Upper Screening Bound (Max)" fill="#0f172a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 5. Comprehensive Stage-by-Stage Numerical Results Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider">
              Complete Stage-by-Stage Comparative Results Table ({config.lifetime_distance_km.toLocaleString()} vehicle-km Functional Unit)
            </h3>
            <p className="text-[11px] text-slate-400">
              All figures generated dynamically from SQLite records via {report.engine_version} • Reference Powertrain: {report.reference_powertrain}
            </p>
          </div>
          <span className="font-mono text-xs text-emerald-400">{report.run_id}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <th className="py-3 px-4">Lifecycle Stage / Metric</th>
                {report.scenarios.map((sc: any) => (
                  <th key={sc.code} className="py-3 px-4 text-right font-mono">
                    {sc.code} ({sc.vehicle_record.powertrain})
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="py-2.5 px-4 font-medium text-slate-800">
                  1. Cradle-to-Gate Materials (Midpoint [Min–Max] kg CO2e)
                </td>
                {report.scenarios.map((sc: any) => {
                  const m = sc.result.stages.material_production;
                  return (
                    <td key={sc.code} className="py-2.5 px-4 text-right font-mono">
                      <div className="font-bold text-slate-900">{m.point.toLocaleString()} kg</div>
                      <div className="text-[11px] text-slate-500">[{m.min.toLocaleString()} – {m.max.toLocaleString()}]</div>
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-medium text-slate-800">
                  2. Traction Battery Pack Manufacturing (Midpoint [Min–Max] kg CO2e)
                </td>
                {report.scenarios.map((sc: any) => {
                  const b = sc.result.stages.battery_pack_production;
                  return (
                    <td key={sc.code} className="py-2.5 px-4 text-right font-mono">
                      <div className="font-bold text-teal-800">{b.point.toLocaleString()} kg</div>
                      <div className="text-[11px] text-slate-500">[{b.min.toLocaleString()} – {b.max.toLocaleString()}]</div>
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-medium text-slate-800">
                  3. Component Fabrication & Plant Assembly (kg CO2e)
                </td>
                {report.scenarios.map((sc: any) => (
                  <td key={sc.code} className="py-2.5 px-4 text-right font-mono text-slate-800">
                    {sc.result.stages.component_and_process_manufacturing.point.toLocaleString()} kg
                  </td>
                ))}
              </tr>
              <tr className="bg-slate-50/70 font-semibold">
                <td className="py-2.5 px-4 text-slate-900">
                  Subtotal: Total Vehicle & Battery Manufacturing (kg CO2e)
                </td>
                {report.scenarios.map((sc: any) => {
                  const mf = sc.result.stages.manufacturing_total;
                  return (
                    <td key={sc.code} className="py-2.5 px-4 text-right font-mono text-slate-900">
                      {mf.point.toLocaleString()} kg
                      <div className="text-[10px] font-normal text-slate-500">[{mf.min.toLocaleString()} – {mf.max.toLocaleString()}]</div>
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-medium text-slate-800">
                  4. Transportation & Logistics (kg CO2e)
                </td>
                {report.scenarios.map((sc: any) => (
                  <td key={sc.code} className="py-2.5 px-4 text-right font-mono text-slate-600">
                    {sc.result.stages.logistics_and_transport.point > 0
                      ? `${sc.result.stages.logistics_and_transport.point.toLocaleString()} kg`
                      : '0 kg (Flagged Data Gap)'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-medium text-slate-800">
                  5a. Vehicle Operation: Tailpipe Combustion (Tank-to-Wheel kg CO2e)
                </td>
                {report.scenarios.map((sc: any) => (
                  <td key={sc.code} className="py-2.5 px-4 text-right font-mono text-rose-700 font-semibold">
                    {sc.result.stages.use_phase_tailpipe.point.toLocaleString()} kg
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-medium text-slate-800">
                  5b. Fuel / Electricity Production: Upstream (Well-to-Tank / Grid kg CO2e)
                </td>
                {report.scenarios.map((sc: any) => (
                  <td key={sc.code} className="py-2.5 px-4 text-right font-mono text-amber-800 font-semibold">
                    {sc.result.stages.use_phase_upstream.point.toLocaleString()} kg
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-medium text-slate-800">
                  6. Maintenance & Replacement Parts (kg CO2e)
                </td>
                {report.scenarios.map((sc: any) => (
                  <td key={sc.code} className="py-2.5 px-4 text-right font-mono text-slate-700">
                    {sc.result.stages.maintenance.point.toLocaleString()} kg
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2.5 px-4 font-medium text-slate-800">
                  7. End-of-Life Dismantling & Net Recycling Allocation (kg CO2e)
                </td>
                {report.scenarios.map((sc: any) => (
                  <td key={sc.code} className="py-2.5 px-4 text-right font-mono text-slate-700">
                    {sc.result.stages.end_of_life_net.point.toLocaleString()} kg
                  </td>
                ))}
              </tr>
              <tr className="bg-slate-900 text-white font-bold">
                <td className="py-3 px-4">
                  Total Lifecycle Emissions (kg CO2e & tonnes CO2e)
                </td>
                {report.scenarios.map((sc: any) => {
                  const tot = sc.result.totals.total_kgco2e;
                  return (
                    <td key={sc.code} className="py-3 px-4 text-right font-mono">
                      <div className="text-emerald-400 text-sm">
                        {tot.point.toLocaleString()} kg ({(tot.point / 1000).toFixed(2)} t)
                      </div>
                      <div className="text-[11px] font-normal text-slate-300">
                        Range: {tot.min.toLocaleString()} – {tot.max.toLocaleString()} kg
                      </div>
                    </td>
                  );
                })}
              </tr>
              <tr className="bg-emerald-50 font-bold text-emerald-950">
                <td className="py-3 px-4">
                  Lifecycle Carbon Intensity (g CO2e / km) & % Diff vs {report.reference_powertrain}
                </td>
                {report.scenarios.map((sc: any) => {
                  const g = sc.result.totals.g_co2e_per_km;
                  const d = sc.comparison_vs_reference.diff_pct_point;
                  return (
                    <td key={sc.code} className="py-3 px-4 text-right font-mono">
                      <div>{g.point.toFixed(1)} g CO2e/km [{g.min.toFixed(1)}–{g.max.toFixed(1)}]</div>
                      <div className="text-xs mt-0.5">
                        {sc.code === report.reference_powertrain
                          ? '0.0% (Reference)'
                          : `${d > 0 ? '+' : ''}${d}% vs ${report.reference_powertrain}`}
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Structured Multi-Scenario Sensitivity Analysis */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Multi-Dimensional Sensitivity Analysis (Modelled Parameter Variations)
            </h3>
            <p className="text-xs text-slate-500">
              Evaluates separate scenarios across Grid Carbon Intensity, Lifetime Distance (80k / 150k / 250k km), Recycled Metal Shares, and Battery Pack Manufacturing Ranges. These represent modelled sensitivity bounds, not measured future predictions.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sensitivityDimensions.map(dim => (
              <button
                key={dim}
                onClick={() => setActiveSensitivityTab(dim)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeSensitivityTab === dim
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {dim}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-slate-200 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Sensitivity Scenario & Parameter</th>
                <th className="py-3 px-4 text-right font-mono">Petrol ICEV</th>
                <th className="py-3 px-4 text-right font-mono">Full Hybrid HEV</th>
                <th className="py-3 px-4 text-right font-mono">Battery Electric BEV</th>
                <th className="py-3 px-4 text-right font-mono">CNG Car</th>
                <th className="py-3 px-4">Engineering Interpretation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredSensitivityRows.map((row: any) => {
                const findPt = (c: string) => row.results_by_powertrain.find((x: any) => x.code === c);
                return (
                  <tr key={row.case_id} className="hover:bg-slate-50">
                    <td className="py-3.5 px-4 align-top">
                      <div className="font-bold text-slate-900">{row.scenario_label}</div>
                      <div className="font-mono text-[11px] text-slate-500 mt-0.5">{row.parameter_description}</div>
                    </td>
                    {(['ICEV', 'HEV', 'BEV', 'CNG'] as const).map(c => {
                      const cell = findPt(c);
                      if (!cell) return <td key={c} className="py-3.5 px-4 text-right font-mono text-slate-400">Disabled</td>;
                      return (
                        <td key={c} className="py-3.5 px-4 align-top text-right font-mono">
                          <div className="font-bold text-slate-900">{cell.total_kgco2e_point.toLocaleString()} kg</div>
                          <div className="text-[11px] text-slate-500">{cell.g_co2e_per_km_point.toFixed(1)} g/km</div>
                          {c !== 'ICEV' && (
                            <div
                              className={`text-[11px] font-semibold ${
                                cell.diff_vs_icev_pct < 0 ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {cell.diff_vs_icev_pct > 0 ? `+${cell.diff_vs_icev_pct}%` : `${cell.diff_vs_icev_pct}%`} vs ICEV
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-3.5 px-4 align-top max-w-sm text-slate-700 leading-relaxed">
                      {row.engineering_interpretation}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7. Stage Completeness Matrix & Reproducibility Provenance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-700" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Lifecycle Boundary Completeness & Missing-Data Transparency
            </h3>
          </div>
          <div className="space-y-2.5 text-xs">
            {report.stage_completeness_matrix.map((st: any, idx: number) => (
              <div key={idx} className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-slate-900">{st.stage_name}</span>
                  <QualityBadge status={st.status} />
                </div>
                <div className="text-slate-600">{st.boundary_description}</div>
                <div className="text-slate-700 pt-1">
                  <strong>Audit Note:</strong> {st.notes}
                </div>
                <div className="font-mono text-[11px] text-emerald-800">
                  Sources: {st.source_ids.join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {/* Traceability & Cited Sources */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                Reproducibility Metadata & Source Citations
              </h3>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono space-y-1">
              <div><strong>Engine Version:</strong> {report.engine_version}</div>
              <div><strong>Vehicle Archetype IDs:</strong> {report.traceability.selected_vehicle_ids.join(', ')}</div>
              <div><strong>BOM Component IDs:</strong> {report.traceability.selected_bom_component_ids.join(', ')}</div>
              <div><strong>Material Factor IDs:</strong> {report.traceability.selected_material_ids.join(', ')}</div>
              <div><strong>Process Factor IDs:</strong> {report.traceability.selected_process_ids.join(', ')}</div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {report.traceability.cited_sources.map((src: any) => (
                <div key={src.source_id} className="p-2.5 rounded border border-slate-200 text-xs flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-900">
                      <span className="font-mono text-emerald-800 mr-1.5">[{src.source_id}]</span>
                      {src.title}
                    </div>
                    <div className="text-slate-500 mt-0.5">
                      {src.publisher} ({src.publication_year})
                    </div>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <GeographyBadge geo={src.geography} />
                    {src.url && !src.url.startsWith('local://') && (
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-emerald-700 hover:underline font-mono"
                      >
                        <span>Source</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Saved Case Study Runs History */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-700" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                  Saved Reproducible Runs in SQLite ({savedRuns.length})
                </h3>
              </div>
            </div>
            {savedRuns.length === 0 ? (
              <div className="text-xs text-slate-500 italic">
                Click "Save Run to SQLite" at the top right to persist a timestamped snapshot of this case study.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {savedRuns.map((sr: any) => (
                  <div
                    key={sr.run_id}
                    className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-mono font-bold text-slate-900">{sr.run_id}</div>
                      <div className="text-slate-500">
                        {Number(sr.functional_unit_km).toLocaleString()} km • Ref: {sr.reference_powertrain} • {sr.created_at}
                      </div>
                    </div>
                    <button
                      onClick={() => loadHistoricalRun(sr)}
                      className="px-2.5 py-1 rounded bg-slate-900 text-white text-[11px] font-medium hover:bg-slate-800"
                    >
                      Reload Run
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
