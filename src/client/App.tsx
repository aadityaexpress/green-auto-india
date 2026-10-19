import React, { useState } from 'react';
import {
  LayoutDashboard,
  Search,
  Layers,
  Cpu,
  Factory,
  Zap,
  Car,
  Calculator,
  Scale,
  BookOpen,
  FileSpreadsheet,
  FileCheck2,
  Leaf,
  Menu,
  X
} from 'lucide-react';
import { OverviewView } from './components/OverviewView.js';
import { ExploreDatabaseView } from './components/ExploreDatabaseView.js';
import { MaterialsExplorerView } from './components/MaterialsExplorerView.js';
import { ComponentsExplorerView } from './components/ComponentsExplorerView.js';
import { ProcessesExplorerView } from './components/ProcessesExplorerView.js';
import { EnergyLogisticsView } from './components/EnergyLogisticsView.js';
import { VehicleExplorerView } from './components/VehicleExplorerView.js';
import { LifecycleCalculatorView } from './components/LifecycleCalculatorView.js';
import { CompareVehiclesView } from './components/CompareVehiclesView.js';
import { SourcesMethodologyView } from './components/SourcesMethodologyView.js';
import { DataIngestionView } from './components/DataIngestionView.js';
import { CaseStudyView } from './components/CaseStudyView.js';

const NAV_ITEMS = [
  { id: 'overview', label: '1. Overview', icon: LayoutDashboard },
  { id: 'explore', label: '2. Explore Database', icon: Search },
  { id: 'materials', label: '3. Materials Explorer', icon: Layers },
  { id: 'components', label: '4. Components Explorer', icon: Cpu },
  { id: 'processes', label: '5. Manufacturing Processes', icon: Factory },
  { id: 'energy', label: '6. Energy & Logistics', icon: Zap },
  { id: 'vehicles', label: '7. Vehicle Explorer', icon: Car },
  { id: 'calculator', label: '8. Lifecycle Calculator', icon: Calculator },
  { id: 'compare', label: '9. Compare Vehicles', icon: Scale },
  { id: 'casestudy', label: '10. India LCA Case Study', icon: FileCheck2 },
  { id: 'sources', label: '11. Sources & Methodology', icon: BookOpen },
  { id: 'ingestion', label: '12. CSV Ingestion & Audit', icon: FileSpreadsheet }
];

export function App() {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');
  const [headerSearchInput, setHeaderSearchInput] = useState<string>('');
  const [preselectedVehicle, setPreselectedVehicle] = useState<any | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const handleGlobalSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalSearchQuery(headerSearchInput);
    setActiveTab('explore');
  };

  const triggerSearchFromOverview = (q: string) => {
    setHeaderSearchInput(q);
    setGlobalSearchQuery(q);
    setActiveTab('explore');
  };

  const openVehicleInCalculator = (v: any) => {
    setPreselectedVehicle(v);
    setActiveTab('calculator');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Engineering Header Bar */}
      <header className="sticky top-0 z-40 bg-slate-900 text-white border-b border-slate-800 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              className="lg:hidden p-1.5 rounded-lg text-slate-300 hover:bg-slate-800"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div
              onClick={() => setActiveTab('overview')}
              className="flex items-center gap-2.5 cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
                <Leaf className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-sm tracking-tight leading-none">
                  GREEN AUTO INDIA
                </div>
                <div className="text-[10px] font-mono text-emerald-400 tracking-wider mt-0.5">
                  AUTOMOTIVE LCA DATA PLATFORM • IITB TECHFEST 2026–27
                </div>
              </div>
            </div>
          </div>

          {/* Persistent Global Search Bar (Desktop) */}
          <form onSubmit={handleGlobalSearchSubmit} role="search" className="hidden md:flex flex-1 max-w-xl">
            <div className="relative w-full flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5" />
              <input
                type="search"
                aria-label="Global database search"
                value={headerSearchInput}
                onChange={e => setHeaderSearchInput(e.target.value)}
                placeholder="Global Search: 'Steel emission factor in India', 'Recycled aluminium', 'Casting energy'..."
                className="w-full pl-9 pr-20 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="absolute right-1.5 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-[11px] font-semibold text-white"
              >
                Search DB
              </button>
            </div>
          </form>

          <div className="hidden sm:flex items-center gap-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-emerald-400">
              SQLite WAL • Persistent
            </span>
          </div>
        </div>

        {/* Mobile Global Search Bar */}
        <form onSubmit={handleGlobalSearchSubmit} role="search" className="md:hidden px-4 pb-2.5">
          <div className="relative w-full flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3" />
            <input
              type="search"
              aria-label="Global database search mobile"
              value={headerSearchInput}
              onChange={e => setHeaderSearchInput(e.target.value)}
              placeholder="Search materials, processes, vehicles..."
              className="w-full pl-9 pr-20 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              className="absolute right-1.5 px-2.5 py-1 rounded bg-emerald-600 text-[11px] font-semibold text-white"
            >
              Search
            </button>
          </div>
        </form>
      </header>

      {/* Main Workspace Container */}
      <div className="flex-1 max-w-[1600px] w-full mx-auto flex">
        {/* Left Navigation Sidebar */}
        <aside
          className={`${
            mobileMenuOpen ? 'fixed inset-y-0 left-0 z-40 w-64 bg-white shadow-2xl pt-16' : 'hidden'
          } lg:block lg:w-64 shrink-0 bg-white border-r border-slate-200 p-3 space-y-1`}
        >
          <div className="px-3 py-2 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">
            Platform Modules (12)
          </div>
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition ${
                  isActive
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}

          <div className="mt-6 p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-[11px] text-slate-600">
            <div className="font-bold text-slate-800">Scientific Provenance Guard</div>
            <p className="leading-relaxed">
              Every record preserves its original unit, boundary, geography, reference year, and source link. Screening ranges are never collapsed into single values.
            </p>
          </div>
        </aside>

        {/* Main Content View */}
        <main key={refreshKey} className="flex-1 p-4 sm:p-6 overflow-x-hidden">
          {activeTab === 'overview' && (
            <OverviewView
              onNavigate={tab => setActiveTab(tab)}
              onTriggerSearch={triggerSearchFromOverview}
            />
          )}
          {activeTab === 'explore' && (
            <ExploreDatabaseView
              initialQuery={globalSearchQuery}
              onClearInitialQuery={() => {
                setGlobalSearchQuery('');
                setHeaderSearchInput('');
              }}
            />
          )}
          {activeTab === 'materials' && <MaterialsExplorerView />}
          {activeTab === 'components' && <ComponentsExplorerView />}
          {activeTab === 'processes' && <ProcessesExplorerView />}
          {activeTab === 'energy' && <EnergyLogisticsView />}
          {activeTab === 'vehicles' && (
            <VehicleExplorerView onOpenInCalculator={openVehicleInCalculator} />
          )}
          {activeTab === 'calculator' && (
            <LifecycleCalculatorView preselectedVehicle={preselectedVehicle} />
          )}
          {activeTab === 'compare' && <CompareVehiclesView />}
          {activeTab === 'casestudy' && <CaseStudyView />}
          {activeTab === 'sources' && <SourcesMethodologyView />}
          {activeTab === 'ingestion' && (
            <DataIngestionView onDatabaseUpdated={() => setRefreshKey(k => k + 1)} />
          )}
        </main>
      </div>
    </div>
  );
}
