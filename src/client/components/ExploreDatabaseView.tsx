import React, { useEffect, useState } from 'react';
import { Search, Filter, RotateCcw, Sparkles, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { QualityBadge, GeographyBadge, RecordDetailModal } from './SharedBadges.js';

const ENTITY_TABS = [
  'All',
  'Material',
  'Component',
  'Manufacturing Process',
  'Energy Factor',
  'Logistics Mode',
  'Vehicle Archetype/Model',
  'End-of-Life System',
  'Environmental Indicator',
  'Source Document'
];

export function ExploreDatabaseView({
  initialQuery,
  onClearInitialQuery
}: {
  initialQuery?: string;
  onClearInitialQuery?: () => void;
}) {
  const [query, setQuery] = useState(initialQuery || '');
  const [entityType, setEntityType] = useState('All');
  const [geography, setGeography] = useState('All');
  const [qualityStatus, setQualityStatus] = useState('All');
  const [sortBy, setSortBy] = useState<'relevance' | 'year_desc' | 'source_quality' | 'alphabetical'>('relevance');
  const [page, setPage] = useState(1);

  const [searchData, setSearchData] = useState<any>({ results: [], total_results: 0, total_pages: 1 });
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

  useEffect(() => {
    if (initialQuery !== undefined && initialQuery !== query) {
      setQuery(initialQuery);
      setPage(1);
    }
  }, [initialQuery]);

  const fetchResults = () => {
    setLoading(true);
    const params = new URLSearchParams({
      q: query,
      entity_type: entityType,
      geography,
      quality_status: qualityStatus,
      sort_by: sortBy,
      page: String(page),
      limit: '20'
    });
    fetch(`/api/search?${params.toString()}`)
      .then(r => r.json())
      .then(d => {
        setSearchData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchResults();
  }, [query, entityType, geography, qualityStatus, sortBy, page]);

  useEffect(() => {
    fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`)
      .then(r => r.json())
      .then(d => setSuggestions(d.suggestions || []))
      .catch(() => {});
  }, [query]);

  const resetFilters = () => {
    setQuery('');
    setEntityType('All');
    setGeography('All');
    setQualityStatus('All');
    setSortBy('relevance');
    setPage(1);
    if (onClearInitialQuery) onClearInitialQuery();
  };

  return (
    <div className="space-y-5">
      {/* Global Search Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Explore & Search Multi-Layer Automotive LCA Database
            </h2>
            <p className="text-xs text-slate-500">
              Search in natural language or technical terms across Materials, Components/BOMs, Manufacturing Processes, Energy Pathways, Freight Modes, Vehicles, EoL Systems, and Sources.
            </p>
          </div>
          <div className="text-xs font-mono text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
            {searchData.total_results} matching SQL records
          </div>
        </div>

        {/* Search Input with Autocomplete Dropdown */}
        <div className="relative">
          <div className="flex items-center border-2 border-slate-300 focus-within:border-emerald-600 rounded-xl bg-slate-50/60 overflow-hidden transition">
            <Search className="w-5 h-5 text-slate-400 ml-4 shrink-0" />
            <input
              type="text"
              value={query}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 180)}
              onChange={e => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Try: 'Steel emission factor in India', 'Recycled aluminium versus primary aluminium', 'Casting energy consumption'..."
              className="w-full px-3.5 py-3 bg-transparent text-sm text-slate-900 focus:outline-none"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  setPage(1);
                }}
                className="text-xs text-slate-500 hover:text-slate-800 px-3 py-1 mr-2 bg-slate-200/70 rounded"
              >
                Clear
              </button>
            )}
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg py-2 max-h-64 overflow-y-auto">
              <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Suggested Engineering Queries & Records
              </div>
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  onMouseDown={() => {
                    setQuery(s);
                    setShowSuggestions(false);
                    setPage(1);
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 flex items-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{s}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Category Layer Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {ENTITY_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => {
                setEntityType(tab);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                entityType === tab
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Filter & Sort Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
              Geography Scope
            </label>
            <select
              value={geography}
              onChange={e => {
                setGeography(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white"
            >
              <option value="All">All Geographies</option>
              <option value="India">India-Specific / India Framework</option>
              <option value="European">European Union (EU SWD 2023/256)</option>
              <option value="Global">Global / US Literature (GREET / IEA)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
              Data Quality / Provenance
            </label>
            <select
              value={qualityStatus}
              onChange={e => {
                setQualityStatus(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white"
            >
              <option value="All">All Quality Statuses</option>
              <option value="Directly Extracted">Directly Extracted from PDF</option>
              <option value="Peer-Reviewed">Peer-Reviewed Published</option>
              <option value="Indicative Screening">Indicative Screening Range</option>
              <option value="Representative">Representative Published Archetype</option>
              <option value="Allocated Facility">Allocated Facility Factor (Use Cautiously)</option>
              <option value="Requires">Requires External Dataset Import</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-500 mb-1">
              Sort Order
            </label>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white"
            >
              <option value="relevance">Relevance Ranking (Concept + Geography)</option>
              <option value="source_quality">Source Quality & Traceability</option>
              <option value="year_desc">Newest Reference Year First</option>
              <option value="alphabetical">Alphabetical (A–Z)</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={resetFilters}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset All Filters</span>
            </button>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500 font-mono">
            Searching database records...
          </div>
        ) : searchData.results.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <Filter className="w-8 h-8 text-slate-400 mx-auto" />
            <div className="text-sm font-semibold text-slate-800">No matching database records found</div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Try clearing active geography or data-quality filters, or use broader technical keywords such as "steel", "aluminium", "battery", "casting", or "hydrogen".
            </p>
            <button
              onClick={resetFilters}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium"
            >
              Reset Search & Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-slate-200 uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Layer & ID</th>
                  <th className="py-3 px-4">Record Name & Match Explanation</th>
                  <th className="py-3 px-4">Factor / Value Range</th>
                  <th className="py-3 px-4">Unit & System Boundary</th>
                  <th className="py-3 px-4">Geography & Year</th>
                  <th className="py-3 px-4">Data Quality & Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {searchData.results.map((r: any) => (
                  <tr
                    key={`${r.entity_type}-${r.id}`}
                    onClick={() => setSelectedRecord(r)}
                    className="hover:bg-emerald-50/40 cursor-pointer transition"
                  >
                    <td className="py-3.5 px-4 align-top whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold text-[11px] border border-slate-200">
                        {r.entity_type}
                      </span>
                      <div className="font-mono text-[11px] text-slate-500 mt-1">{r.id}</div>
                    </td>

                    <td className="py-3.5 px-4 align-top max-w-md">
                      <div className="font-semibold text-slate-900 text-sm">{r.title}</div>
                      <div className="text-slate-600 mt-0.5">{r.subtitle}</div>
                      {query && r.match_reasons && r.match_reasons.length > 0 && (
                        <div className="mt-1.5 inline-flex flex-wrap items-center gap-1 bg-emerald-50 text-emerald-900 border border-emerald-200 px-2 py-0.5 rounded text-[11px]">
                          <Sparkles className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>
                            <strong>Why matched:</strong> {r.match_reasons.join(' • ')}
                          </span>
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 align-top font-mono font-semibold text-slate-900 whitespace-nowrap">
                      {r.value_display}
                    </td>

                    <td className="py-3.5 px-4 align-top">
                      <div className="font-mono text-slate-800">{r.unit}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{r.system_boundary}</div>
                    </td>

                    <td className="py-3.5 px-4 align-top whitespace-nowrap">
                      <GeographyBadge geo={r.geography} />
                      <div className="font-mono text-[11px] text-slate-500 mt-1">Year: {r.reference_year}</div>
                    </td>

                    <td className="py-3.5 px-4 align-top">
                      <QualityBadge status={r.data_quality_status} />
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                        <span className="truncate max-w-[180px]" title={r.source_title}>
                          {r.source_id}
                        </span>
                        {r.source_url && <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {searchData.total_pages > 1 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
            <div className="text-slate-600">
              Page <strong>{searchData.page}</strong> of <strong>{searchData.total_pages}</strong> ({searchData.total_results} total records)
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded border border-slate-300 bg-white disabled:opacity-40 inline-flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <button
                disabled={page >= searchData.total_pages}
                onClick={() => setPage(p => p + 1)}
                className="px-2.5 py-1 rounded border border-slate-300 bg-white disabled:opacity-40 inline-flex items-center gap-1"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      <RecordDetailModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
    </div>
  );
}
