import React, { useEffect, useState } from 'react';
import { Upload, Download, CheckCircle2, AlertTriangle, XCircle, FileSpreadsheet, Play } from 'lucide-react';

type EntityType = 'materials' | 'processes' | 'energy_factors' | 'vehicles' | 'logistics_factors' | 'sources';

export function DataIngestionView({ onDatabaseUpdated }: { onDatabaseUpdated?: () => void }) {
  const [entityType, setEntityType] = useState<EntityType>('materials');
  const [csvText, setCsvText] = useState<string>('');
  const [preview, setPreview] = useState<any | null>(null);
  const [commitMessage, setCommitMessage] = useState<string>('');
  const [reports, setReports] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const fetchReports = () => {
    fetch('/api/import-reports')
      .then(r => r.json())
      .then(setReports)
      .catch(() => {});
  };

  const loadTemplate = (type: EntityType) => {
    setEntityType(type);
    setPreview(null);
    setCommitMessage('');
    setErrorMsg('');
    fetch(`/api/ingestion/template/${type}`)
      .then(r => r.text())
      .then(t => setCsvText(t))
      .catch(() => {});
  };

  useEffect(() => {
    loadTemplate('materials');
    fetchReports();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setCsvText(String(ev.target?.result || ''));
      setPreview(null);
    };
    reader.readAsText(file);
  };

  const handlePreview = () => {
    setErrorMsg('');
    setCommitMessage('');
    fetch('/api/ingestion/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_type: entityType, csv_text: csvText })
    })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Validation failed');
        setPreview(d);
      })
      .catch(err => setErrorMsg(err.message));
  };

  const handleCommit = () => {
    if (!preview || !preview.rows) return;
    const approvable = preview.rows
      .filter((r: any) => r.status !== 'error')
      .map((r: any) => r.record);

    if (approvable.length === 0) {
      setErrorMsg('No valid rows available to import. Fix validation errors first.');
      return;
    }

    fetch('/api/ingestion/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity_type: entityType,
        rows: approvable,
        source_file_name: `Interactive_CSV_${entityType}.csv`
      })
    })
      .then(r => r.json())
      .then(d => {
        setCommitMessage(`Successfully imported ${d.importedCount} ${entityType} record(s) into persistent SQLite database.`);
        setPreview(null);
        fetchReports();
        if (onDatabaseUpdated) onDatabaseUpdated();
      })
      .catch(err => setErrorMsg(err.message));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-700 text-white">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Data Ingestion Pipeline — CSV Import, Validation, Human Review & Export (Section 6)
              </h2>
              <p className="text-xs text-slate-500">
                Persistently add new India-specific materials, CEA grid factors, processes, or vehicle models via validated CSV templates without editing code.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/ingestion/template/${entityType}`}
              download
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download {entityType} Template</span>
            </a>
            <a
              href={`/api/ingestion/export/${entityType}`}
              download
              className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Current {entityType} Table (CSV)</span>
            </a>
          </div>
        </div>

        {/* Target Table Selector */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <span className="text-xs font-semibold text-slate-600">Select Target SQL Table:</span>
          {(['materials', 'processes', 'energy_factors', 'vehicles', 'logistics_factors', 'sources'] as EntityType[]).map(t => (
            <button
              key={t}
              onClick={() => loadTemplate(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition ${
                entityType === t ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* CSV Editor & File Upload */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700">
              Edit CSV Payload or Upload File (Pre-loaded with ready-to-import India sample record):
            </span>
            <label className="cursor-pointer inline-flex items-center gap-1.5 text-emerald-700 hover:text-emerald-800 font-medium">
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Local .CSV File</span>
              <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
          <textarea
            rows={5}
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
            className="w-full font-mono text-xs p-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={handlePreview}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Step 1: Validate Schema, Units, Duplicates & Provenance</span>
          </button>

          {preview && (
            <button
              onClick={handleCommit}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Step 2: Approve & Commit to Persistent SQLite Database</span>
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {commitMessage && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{commitMessage}</span>
          </div>
        )}

        {/* Validation Preview Table */}
        {preview && (
          <div className="border border-slate-200 rounded-xl overflow-hidden space-y-2">
            <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between text-xs">
              <span className="font-bold text-slate-800">Pre-Import Validation & Human Review Staging</span>
              <div className="flex items-center gap-3 font-mono">
                <span className="text-emerald-700">Valid: {preview.valid_count}</span>
                <span className="text-blue-700">Duplicates (Upsert): {preview.duplicate_count}</span>
                <span className="text-amber-700">Flagged for Review: {preview.flagged_count}</span>
                <span className="text-rose-700">Errors: {preview.error_count}</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <th className="py-2 px-3">Row</th>
                    <th className="py-2 px-3">Validation Status</th>
                    <th className="py-2 px-3">Primary ID & Record Summary</th>
                    <th className="py-2 px-3">Audit & Review Messages</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.rows.map((r: any) => (
                    <tr key={r.row_number}>
                      <td className="py-2.5 px-3 font-mono">#{r.row_number}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-semibold text-[11px] ${
                            r.status === 'valid'
                              ? 'bg-emerald-100 text-emerald-900'
                              : r.status === 'duplicate'
                              ? 'bg-blue-100 text-blue-900'
                              : r.status === 'flagged_for_review'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-rose-100 text-rose-900'
                          }`}
                        >
                          {r.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-800">
                        {Object.values(r.record).slice(0, 3).join(' • ')}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{r.messages.join(' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Audit Log of PDF & CSV Import Reports */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
          Persistent Ingestion & Extraction Audit Reports
        </h3>
        <div className="space-y-4">
          {reports.map(rep => {
            let details: any = {};
            try {
              details = JSON.parse(rep.details_json || '{}');
            } catch {}
            return (
              <div key={rep.report_id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <div>
                    <span className="font-mono font-bold text-slate-900">{rep.report_id}</span>
                    <span className="mx-2 text-slate-400">•</span>
                    <span className="font-semibold text-emerald-800">{rep.import_source_name}</span>
                    <span className="ml-2 px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[11px]">{rep.import_type}</span>
                  </div>
                  <div className="font-mono text-slate-500">
                    Processed: <strong>{rep.total_rows_processed}</strong> | Imported: <strong className="text-emerald-700">{rep.successful_imports}</strong> | Flagged for Review: <strong className="text-amber-700">{rep.flagged_for_review}</strong>
                  </div>
                </div>

                {details.extracted_sections && (
                  <div>
                    <div className="font-semibold text-slate-800 mb-1">Extracted Data Layers from Supplied PDF:</div>
                    <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                      {details.extracted_sections.map((sec: string, idx: number) => (
                        <li key={idx}>{sec}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {details.flagged_items_for_human_review && (
                  <div className="space-y-1.5 pt-1">
                    <div className="font-semibold text-amber-900 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                      <span>Records Flagged for Human Verification & Guardrails Applied:</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {details.flagged_items_for_human_review.map((f: any, idx: number) => (
                        <div key={idx} className="p-2.5 rounded bg-amber-50/80 border border-amber-200 text-slate-800">
                          <div className="font-mono font-bold text-amber-950 text-[11px]">{f.record_id}</div>
                          <div className="mt-0.5"><strong>Issue:</strong> {f.issue}</div>
                          <div className="mt-0.5 text-emerald-900"><strong>Resolution:</strong> {f.action_taken}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
