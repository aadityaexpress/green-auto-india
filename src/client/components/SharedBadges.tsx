import React, { useEffect } from 'react';
import { ExternalLink, ShieldCheck, AlertTriangle, Info, Database, FileText } from 'lucide-react';

export function QualityBadge({ status }: { status: string }) {
  const s = (status || '').toLowerCase();
  let bg = 'bg-slate-100 text-slate-700 border-slate-300';
  let Icon = Info;

  if (s.includes('peer-reviewed') || s.includes('officially reported') || s.includes('directly extracted')) {
    bg = 'bg-emerald-50 text-emerald-800 border-emerald-300';
    Icon = ShieldCheck;
  } else if (s.includes('indicative') || s.includes('screening') || s.includes('archetype') || s.includes('proxy')) {
    bg = 'bg-blue-50 text-blue-800 border-blue-300';
    Icon = Database;
  } else if (s.includes('allocated') || s.includes('cautiously') || s.includes('missing') || s.includes('requires') || s.includes('awaiting')) {
    bg = 'bg-amber-50 text-amber-800 border-amber-300';
    Icon = AlertTriangle;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${bg}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{status}</span>
    </span>
  );
}

export function GeographyBadge({ geo }: { geo: string }) {
  const g = (geo || '').toLowerCase();
  const isIndia = g.includes('india');
  const isEu = g.includes('european') || g.includes('eu');

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium border ${
        isIndia
          ? 'bg-emerald-100/80 text-emerald-900 border-emerald-400'
          : isEu
          ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
          : 'bg-slate-100 text-slate-700 border-slate-300'
      }`}
    >
      {geo}
    </span>
  );
}

export function RecordDetailModal({
  record,
  onClose
}: {
  record: any | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!record) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [record, onClose]);

  if (!record) return null;

  const raw = record.raw_record || record;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-modal-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[88vh] flex flex-col overflow-hidden"
      >
        <div className="px-6 py-4 bg-slate-900 text-white flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 uppercase tracking-wider">
              <span>{record.entity_type || 'Database Record'}</span>
              <span>•</span>
              <span>{record.id || raw.material_id || raw.process_id || raw.energy_id || raw.vehicle_id || raw.component_id || raw.source_id}</span>
            </div>
            <h3 id="record-modal-title" className="text-lg font-semibold mt-1">
              {record.title || raw.name || raw.process_name || raw.component_name || raw.model || raw.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close record details modal"
            className="text-slate-300 hover:text-white px-2.5 py-1 rounded border border-slate-700 hover:border-slate-500 text-xs font-mono transition"
          >
            ESC / Close
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Core Provenance Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <div>
              <div className="text-xs text-slate-500">Value / Range</div>
              <div className="font-mono font-semibold text-slate-900 mt-0.5">
                {record.value_display || raw.uncertainty_or_range || raw.factor_value || 'See Fields Below'}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Reference Unit</div>
              <div className="font-mono text-slate-800 mt-0.5">{record.unit || raw.unit || raw.reference_unit || 'N/A'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">System Boundary</div>
              <div className="font-medium text-slate-800 mt-0.5">{record.system_boundary || raw.system_boundary || raw.lifecycle_boundary || 'Stated in Source'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Geography & Year</div>
              <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                <GeographyBadge geo={record.geography || raw.geography || 'Global'} />
                <span className="font-mono text-xs text-slate-600">({record.reference_year || raw.reference_year || raw.publication_year || '2026'})</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Data Quality Status:</span>
              <QualityBadge status={record.data_quality_status || raw.data_quality_status || raw.confidence_status || raw.lca_data_status || raw.extraction_status || 'Documented'} />
            </div>
            {(record.source_url || raw.url || raw.source_url) && (
              <a
                href={record.source_url || raw.url || raw.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800 underline"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Open Cited Source URL</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {record.match_reasons && record.match_reasons.length > 0 && (
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3">
              <div className="text-xs font-semibold text-emerald-900 uppercase tracking-wider mb-1">
                Why This Record Matched Your Search Query (Score: {record.relevance_score})
              </div>
              <ul className="list-disc list-inside text-xs text-emerald-800 space-y-0.5">
                {record.match_reasons.map((r: string, i: number) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Notes & Scientific Caveats */}
          {(record.notes || raw.notes_and_limitations || raw.limitations || raw.critical_caveat || raw.notes) && (
            <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3.5">
              <div className="text-xs font-semibold text-amber-900 uppercase tracking-wider mb-1">
                Methodology, Assumptions & Scientific Limitations
              </div>
              <p className="text-slate-800 text-xs leading-relaxed">
                {record.notes || raw.notes_and_limitations || raw.limitations || raw.critical_caveat || raw.notes}
              </p>
            </div>
          )}

          {/* Raw Database Attributes Table */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Normalized SQL Record Attributes
            </div>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <tbody>
                  {Object.entries(raw).map(([k, v]) => (
                    <tr key={k} className="border-b border-slate-100 last:border-none">
                      <td className="py-2 px-3 bg-slate-50 font-mono text-slate-600 w-1/3">{k}</td>
                      <td className="py-2 px-3 font-mono text-slate-900 break-all">
                        {v === null || v === undefined ? (
                          <span className="text-slate-400 italic">NULL (Not fabricated)</span>
                        ) : typeof v === 'object' ? (
                          JSON.stringify(v)
                        ) : (
                          String(v)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
