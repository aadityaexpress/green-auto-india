import React, { useEffect, useState } from 'react';
import {
  Database,
  Layers,
  Cpu,
  Factory,
  Car,
  Zap,
  FileText,
  AlertTriangle,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Globe
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export function OverviewView({
  onNavigate,
  onTriggerSearch
}: {
  onNavigate: (tab: string) => void;
  onTriggerSearch: (q: string) => void;
}) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/overview')
      .then(r => r.json())
      .then(d => {
        setStats(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading || !stats) {
    return (
      <div className="p-8 text-center text-slate-500 font-mono text-sm">
        Querying SQLite database statistics...
      </div>
    );
  }

  const metricCards = [
    {
      label: 'Total Normalized SQL Records',
      value: stats.total_records,
      sub: '0 orphan records (100% source-linked)',
      icon: Database,
      tab: 'explore',
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200'
    },
    {
      label: 'Materials & Screening Ranges',
      value: stats.counts.materials,
      sub: 'Primary & recycled routes separated',
      icon: Layers,
      tab: 'materials',
      color: 'text-slate-800 bg-white border-slate-200'
    },
    {
      label: 'Vehicle Components & BOMs',
      value: `${stats.counts.components} (${stats.counts.component_materials} BOM rows)`,
      sub: '4 EU SWD(2023) 256 BOMs + 6 Subsystems',
      icon: Cpu,
      tab: 'components',
      color: 'text-slate-800 bg-white border-slate-200'
    },
    {
      label: 'Manufacturing Processes',
      value: stats.counts.manufacturing_processes,
      sub: '15 PMC10890010 processes + 1 Moulding gap',
      icon: Factory,
      tab: 'processes',
      color: 'text-slate-800 bg-white border-slate-200'
    },
    {
      label: 'Vehicle Case-Study Archetypes',
      value: stats.counts.vehicle_variants,
      sub: 'ICEV, Diesel, CNG, HEV, PHEV, BEV, FCEV',
      icon: Car,
      tab: 'vehicles',
      color: 'text-slate-800 bg-white border-slate-200'
    },
    {
      label: 'Energy & Logistics Factors',
      value: stats.counts.energy_and_logistics_total,
      sub: `${stats.counts.energy_factors} energy pathways + ${stats.counts.logistics_factors} freight modes`,
      icon: Zap,
      tab: 'energy',
      color: 'text-slate-800 bg-white border-slate-200'
    },
    {
      label: 'Registered Source Documents',
      value: stats.counts.source_documents,
      sub: `${stats.provenance_and_gaps.external_backbone_sources_registered} external backbone sources tracked`,
      icon: FileText,
      tab: 'sources',
      color: 'text-slate-800 bg-white border-slate-200'
    },
    {
      label: 'Flagged for Verification / Import',
      value: stats.provenance_and_gaps.records_requiring_external_extraction_or_review,
      sub: 'Allocated facility services & external factors',
      icon: AlertTriangle,
      tab: 'ingestion',
      color: 'text-amber-800 bg-amber-50/70 border-amber-200'
    }
  ];

  const benchmarkQueries = [
    'Steel emission factor in India',
    'Recycled aluminium versus primary aluminium',
    'Battery manufacturing emissions per kWh',
    'Casting energy consumption',
    'Indian grid electricity emission factor',
    'Material composition of an electric vehicle',
    'Manufacturing emissions for a hybrid car',
    'Road freight emissions per tonne-km',
    'End-of-life recycling of lithium-ion batteries',
    'Petrol car versus electric car lifecycle emissions'
  ];

  return (
    <div className="space-y-6">
      {/* Scientific Integrity Hero Banner */}
      <div className="bg-slate-900 text-white rounded-xl p-6 border border-slate-800 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>INDIA AUTOMOTIVE LIFE-CYCLE ASSESSMENT (LCA) REFERENCE PLATFORM • SNAPSHOT 18 OCT 2026</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Green Auto India — Traceable Engineering LCA Database & Calculator
            </h1>
            <p className="text-slate-300 text-sm leading-relaxed">
              Built directly from the supplied <strong>Automotive Life-Cycle Assessment Reference Data Pack</strong>. Every numerical range, representative EU SWD(2023) 256 BOM (1,137 kg), PMC10890010 manufacturing process factor, IEA 2024 hydrogen pathway, and CEA India grid reference is stored in a persistent relational SQLite database with strict provenance and double-counting guards.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5 shrink-0">
            <button
              onClick={() => onNavigate('casestudy')}
              className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm inline-flex items-center gap-2 transition"
            >
              <span>Open India LCA Case Study</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onNavigate('calculator')}
              className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 font-medium text-sm inline-flex items-center gap-2 transition"
            >
              <span>Launch Lifecycle Calculator</span>
            </button>
            <button
              onClick={() => onNavigate('ingestion')}
              className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 font-medium text-sm transition"
            >
              Import / Export CSV Datasets
            </button>
          </div>
        </div>
      </div>

      {/* Live SQL Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((c, idx) => {
          const Icon = c.icon;
          return (
            <button
              key={idx}
              onClick={() => onNavigate(c.tab)}
              className={`text-left p-4 rounded-xl border transition hover:shadow-md flex flex-col justify-between ${c.color}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider opacity-75">{c.label}</span>
                <Icon className="w-4 h-4 opacity-70" />
              </div>
              <div className="text-2xl font-bold font-mono my-2">{c.value}</div>
              <div className="text-xs opacity-80 flex items-center justify-between">
                <span>{c.sub}</span>
                <ArrowRight className="w-3.5 h-3.5 opacity-60" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick Natural-Language Benchmark Search Triggers */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              One-Click Engineering Search Queries (Live SQL Retrieval)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Click any technical query below to test relevance ranking, unit/boundary preservation, and match explanations in the Explore Database view.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {benchmarkQueries.map((q, i) => (
            <button
              key={i}
              onClick={() => onTriggerSearch(q)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 border border-slate-200 text-xs font-medium text-slate-700 transition"
            >
              “{q}”
            </button>
          ))}
        </div>
      </div>

      {/* Geography Coverage & Data Integrity Audit Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-emerald-700" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Geographical Scope & Proxy Transparency
            </h3>
          </div>
          <p className="text-xs text-slate-600 mb-4">
            International and EU reference values are explicitly separated from India-specific data so researchers never mistake EU SWD(2023) 256 BOMs or global IEA hydrogen estimates for domestic Indian measurements.
          </p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.geography_coverage} layout="vertical" margin={{ left: 20, right: 20 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" width={210} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {stats.geography_coverage.map((_: any, i: number) => (
                    <Cell key={i} fill={i === 0 ? '#059669' : i === 1 ? '#4f46e5' : '#64748b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Scientific Integrity & Guardrails Active in Platform
            </h3>
          </div>
          <ul className="space-y-2.5 text-xs text-slate-700">
            <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="font-mono font-bold text-emerald-700">01</span>
              <span>
                <strong>Screening Ranges Preserved:</strong> Section 2 material emission factors (~1.5–2.8 kg CO2e/kg for steel, ~8–18 for primary Al vs ~0.5–2.5 for recycled Al) are stored and plotted as min–max ranges, never reduced to false-precision single points.
              </span>
            </li>
            <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="font-mono font-bold text-emerald-700">02</span>
              <span>
                <strong>Allocated Facility Process Guard:</strong> High values in PMC10890010 Table 4 (e.g., Painting = 4,167 MJ & 268 kg CO2/kg; Welding = 920 MJ & 62 kg CO2/kg; HVAC = 3,335 MJ) are flagged and blocked from indiscriminate multiplication by total vehicle mass.
              </span>
            </li>
            <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="font-mono font-bold text-emerald-700">03</span>
              <span>
                <strong>Well-to-Tank vs Tank-to-Wheel Separation:</strong> Tailpipe combustion factors are strictly separated from upstream fuel production and lifecycle electricity so combustion-only petrol is never compared unfairly against grid electricity.
              </span>
            </li>
            <li className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span className="font-mono font-bold text-emerald-700">04</span>
              <span>
                <strong>Zero Fabricated Retail BOMs:</strong> All 7 vehicle case-study archetypes in Section 8 are labelled as representative archetypes using the 1,137 kg EU SWD(2023) 256 baseline or awaiting official Indian retail specs.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
