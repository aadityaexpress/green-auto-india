import React, { useEffect, useState } from 'react';
import { QualityBadge, GeographyBadge, RecordDetailModal } from './SharedBadges.js';
import { BookOpen, ExternalLink, Recycle, Activity, ShieldCheck } from 'lucide-react';

export function SourcesMethodologyView() {
  const [sources, setSources] = useState<any[]>([]);
  const [eolSystems, setEolSystems] = useState<any[]>([]);
  const [indicators, setIndicators] = useState<any[]>([]);
  const [filterText, setFilterText] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

  useEffect(() => {
    fetch('/api/sources').then(r => r.json()).then(setSources).catch(() => {});
    fetch('/api/eol-systems').then(r => r.json()).then(setEolSystems).catch(() => {});
    fetch('/api/indicators').then(r => r.json()).then(setIndicators).catch(() => {});
  }, []);

  const filteredSources = sources.filter(s => {
    if (!filterText) return true;
    const q = filterText.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.publisher.toLowerCase().includes(q) ||
      s.source_id.toLowerCase().includes(q) ||
      (s.notes || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Section 9 & 11 Source Registry */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-700 text-white">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Dedicated Source Registry & Data Provenance (Sections 9 & 11)
              </h2>
              <p className="text-xs text-slate-500">
                Every record in the SQLite database links to one of these registered sources. External backbone reports referenced in the PDF without inline tables are explicitly marked for further extraction.
              </p>
            </div>
          </div>

          <input
            type="text"
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            placeholder="Filter sources by title, publisher, or ID..."
            className="text-xs border border-slate-300 rounded-lg px-3 py-2 w-full md:w-72"
          />
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-slate-200 uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Source ID & Year</th>
                <th className="py-3 px-4">Title & Publisher</th>
                <th className="py-3 px-4">Page / Section & Version</th>
                <th className="py-3 px-4">Geography</th>
                <th className="py-3 px-4">Extraction Status & Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredSources.map(s => (
                <tr
                  key={s.source_id}
                  onClick={() => setSelectedRecord(s)}
                  className="hover:bg-emerald-50/40 cursor-pointer transition"
                >
                  <td className="py-3.5 px-4 align-top whitespace-nowrap">
                    <div className="font-mono font-bold text-slate-900">{s.source_id}</div>
                    <div className="font-mono text-slate-500 mt-0.5">Year: {s.publication_year}</div>
                  </td>
                  <td className="py-3.5 px-4 align-top max-w-md">
                    <div className="font-semibold text-slate-900 text-sm">{s.title}</div>
                    <div className="text-slate-600 mt-0.5">{s.publisher}</div>
                    {s.url && !s.url.startsWith('local://') && (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-emerald-700 hover:underline mt-1 font-mono text-[11px]"
                      >
                        <span>{s.url}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </td>
                  <td className="py-3.5 px-4 align-top">
                    <div className="text-slate-800">{s.page_table}</div>
                    <div className="font-mono text-[11px] text-slate-500 mt-0.5">{s.dataset_version}</div>
                  </td>
                  <td className="py-3.5 px-4 align-top whitespace-nowrap">
                    <GeographyBadge geo={s.geography} />
                  </td>
                  <td className="py-3.5 px-4 align-top max-w-sm">
                    <QualityBadge status={s.extraction_status} />
                    <p className="text-slate-600 mt-1.5 leading-snug">{s.notes}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* End-of-Life Systems & Environmental Indicators Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Recycle className="w-5 h-5 text-emerald-700" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              End-of-Life (EoL) Systems & Allocation Methods (Section 7)
            </h3>
          </div>
          <div className="space-y-3">
            {eolSystems.map(eol => (
              <div
                key={eol.eol_id}
                onClick={() => setSelectedRecord(eol)}
                className="p-3.5 rounded-lg border border-slate-200 hover:border-emerald-400 cursor-pointer bg-slate-50/60 space-y-1.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{eol.system_name}</span>
                  <span className="font-mono text-[11px] text-slate-400">{eol.eol_id}</span>
                </div>
                <div className="text-emerald-800 font-medium">Allocation: {eol.allocation_method}</div>
                <p className="text-slate-600 leading-relaxed">{eol.notes}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-700" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Environmental Impact Indicators (Sections 1 & 7)
            </h3>
          </div>
          <div className="space-y-2.5">
            {indicators.map(ind => (
              <div
                key={ind.indicator_id}
                onClick={() => setSelectedRecord(ind)}
                className="p-3 rounded-lg border border-slate-200 hover:border-emerald-400 cursor-pointer bg-slate-50/60 flex items-start justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900">
                    {ind.indicator_name} (<span className="font-mono">{ind.indicator_code}</span>)
                  </div>
                  <div className="text-slate-500 mt-0.5">
                    Method: {ind.lcia_method} • Unit: <span className="font-mono text-slate-800">{ind.unit}</span>
                  </div>
                  <div className="text-slate-600 mt-1">{ind.notes}</div>
                </div>
                <QualityBadge status={ind.status_in_pack} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Section 11 Quality Controls Checklist */}
      <div className="bg-slate-900 text-white rounded-xl p-5 border border-slate-800 space-y-3">
        <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4" />
          <span>Section 11 Quality Controls Enforced Across Platform</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-300">
          <div>• Every numeric factor is linked to a registered <code className="text-emerald-300">source_id</code> and explicit system boundary. Zero orphan values exist.</div>
          <div>• Primary and secondary/recycled material production routes are stored as distinct database rows.</div>
          <div>• Tailpipe-only (TTW), upstream fuel production (WTT), and full lifecycle (WTW) factors are separated.</div>
          <div>• Whole-vehicle manufacturing footprints are never added on top of BOM material footprints when materials are already included.</div>
        </div>
      </div>

      <RecordDetailModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
    </div>
  );
}
