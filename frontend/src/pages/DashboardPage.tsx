import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowUpRight,
  Atom,
  Clock,
  Layers,
  ShieldCheck,
  ShoppingBag,
  Search,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  X,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Database,
  Cpu,
} from 'lucide-react';
import { fetchJson } from '../lib/api';
import type { Stats, DiscoveryJob, Candidate, Material } from '../types';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Interactive filters and search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'screened' | 'running'>('all');
  const [selectedJob, setSelectedJob] = useState<DiscoveryJob | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      const [statsData, materialsData] = await Promise.all([
        fetchJson<Stats>('/api/dashboard/stats'),
        fetchJson<Material[]>('/api/materials').catch(() => []),
      ]);
      setStats(statsData);
      setMaterials(materialsData);
      setError(null);
    } catch {
      setError('Unable to reach the MatChain API. Make sure the backend service is running on port 8000.');
    } finally {
      setLoading(false);
      if (isManualRefresh) setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleCopy = (text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  // Filtered discovery runs based on user search and status tab
  const filteredJobs = useMemo(() => {
    if (!stats?.recent_jobs) return [];
    return stats.recent_jobs.filter((job) => {
      // Status filtering
      if (statusFilter === 'completed' && job.status !== 'completed') return false;
      if (statusFilter === 'running' && job.status !== 'running' && job.status !== 'queued') return false;
      if (statusFilter === 'screened' && (job.candidates_count > 0 || job.status !== 'completed')) return false;

      // Search matching across material names, objective, and ID
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchId = job.id.toLowerCase().includes(q);
      const matchObj = (job.objective || '').toLowerCase().includes(q);
      const matchPrimary = (job.primary_material || '').toLowerCase().includes(q);
      const matchProduced = (job.materials_produced || []).some((m) => m.toLowerCase().includes(q));
      const matchTop = (job.top_candidates || []).some((c) => c.formula.toLowerCase().includes(q));

      return matchId || matchObj || matchPrimary || matchProduced || matchTop;
    });
  }, [stats?.recent_jobs, searchQuery, statusFilter]);

  if (loading) {
    return (
      <div className="card p-16 text-center text-slate-400 font-mono text-xs">
        <div className="h-6 w-6 border-2 border-slate-600 border-t-[#38bdf8] rounded-full animate-spin mx-auto mb-4" />
        Synchronizing real-time telemetry from generative lattice…
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="card flex items-center justify-between p-6 text-amber-200 border-amber-500/30 bg-amber-500/[0.04]">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />
          <span className="text-xs font-mono">{error}</span>
        </div>
        <button
          type="button"
          onClick={() => void loadData(true)}
          className="btn-overworld text-xs py-1.5 px-3 flex items-center gap-1.5"
        >
          <RefreshCw className="h-3 w-3" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const primaryStats = stats || {
    total_candidates_generated: 0,
    structurally_valid_candidates: 0,
    thermodynamically_accepted: 0,
    registered_materials: 0,
    active_marketplace_listings: 0,
    completed_licenses: 0,
    recent_jobs: [],
    recent_transactions: [],
  };

  const metrics = [
    {
      label: 'Sampled Candidates',
      value: primaryStats.total_candidates_generated.toLocaleString(),
      icon: Atom,
      helper: 'Latent conditional samples',
    },
    {
      label: 'Geometrically Valid',
      value: primaryStats.structurally_valid_candidates.toLocaleString(),
      icon: Layers,
      helper: 'Interatomic distance verified',
    },
    {
      label: 'Thermodynamic Accepts',
      value: primaryStats.thermodynamically_accepted.toLocaleString(),
      icon: Sparkles,
      helper: 'Below convex hull threshold',
    },
    {
      label: 'On-Chain Registered',
      value: (primaryStats.registered_materials || materials.length).toLocaleString(),
      icon: ArrowUpRight,
      helper: 'Anchored in smart contract',
    },
    {
      label: 'Marketplace Listings',
      value: primaryStats.active_marketplace_listings.toLocaleString(),
      icon: ShoppingBag,
      helper: 'Active license offerings',
    },
    {
      label: 'Completed Licenses',
      value: primaryStats.completed_licenses.toLocaleString(),
      icon: ShieldCheck,
      helper: 'Transacted IP rights',
    },
  ];

  return (
    <div className="space-y-10">
      {/* Editorial Header with Live Refresh & Actions */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/[0.06] pb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#6e8799]">
              Live Materials Discovery Telemetry
            </span>
          </div>
          <h1 className="font-heading text-3xl md:text-4xl font-normal tracking-tight text-[#e9ecee]">
            Discovery Intelligence
          </h1>
          <p className="mt-1 text-xs text-[#6e8799] font-light max-w-xl">
            Real-time verification metrics, generative model throughput, and candidate crystalline phases produced across pipeline runs.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={refreshing}
            className="btn-overworld text-xs py-2 px-3.5 flex items-center gap-2"
            title="Refresh real-time pipeline telemetry"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-[#38bdf8]' : 'text-[#aab9c7]'}`} />
            <span>{refreshing ? 'Syncing…' : 'Refresh'}</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/discovery')}
            className="btn-overworld-primary text-xs py-2 px-4 flex items-center gap-2"
          >
            <Atom className="h-3.5 w-3.5" />
            <span>New Run</span>
          </button>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {metrics.map(({ label, value, icon: Icon, helper }) => (
          <div key={label} className="metric-card group">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#6e8799]">{label}</span>
              <div className="p-1.5 rounded bg-white/[0.03] border border-white/[0.06] text-[#aab9c7] group-hover:text-white group-hover:border-white/20 transition-colors">
                <Icon className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-3 font-heading text-2xl font-normal text-white tracking-tight">
              {value}
            </div>
            <div className="mt-1 text-[10px] text-[#6e8799] font-mono truncate">{helper}</div>
          </div>
        ))}
      </div>

      {/* Interactive Recent Discovery Runs Section */}
      <div className="space-y-4">
        {/* Controls Bar: Search & Status Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/[0.02] border border-white/[0.05] p-3 rounded-xl">
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-base font-normal text-white px-2">
              Recent Discovery Runs
            </h2>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-[#6e8799] border border-white/[0.06]">
              {filteredJobs.length} {filteredJobs.length === 1 ? 'Run' : 'Runs'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#6e8799]" />
              <input
                type="text"
                placeholder="Search material (e.g. TiAlV)…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#080c16]/80 border border-white/[0.08] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-[#6e8799] focus:outline-none focus:border-white/30 font-mono transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6e8799] hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center rounded-lg border border-white/[0.08] bg-[#080c16]/80 p-0.5 text-[11px] font-mono">
              {(['all', 'completed', 'screened'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1 rounded-md capitalize transition-all ${
                    statusFilter === tab
                      ? 'bg-white/10 text-white font-medium shadow-sm'
                      : 'text-[#6e8799] hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Discovery Runs Cards List */}
        {!filteredJobs.length ? (
          <div className="card p-12 text-center text-[#6e8799] font-mono text-xs">
            <SlidersHorizontal className="h-6 w-6 mx-auto mb-3 opacity-40" />
            No discovery runs match your filter query "{searchQuery}".
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filteredJobs.map((job) => {
              const primaryMat = job.primary_material || (job.materials_produced?.[0] ?? 'Screened Phase');
              const extraMats = (job.materials_produced || []).filter((m) => m !== primaryMat);
              const isCompleted = job.status === 'completed';
              const topCand = job.top_candidates?.[0];

              return (
                <div
                  key={job.id}
                  onClick={() => setSelectedJob(job)}
                  className="card p-5 cursor-pointer hover:border-white/25 hover:bg-white/[0.03] transition-all group flex flex-col justify-between relative overflow-hidden"
                >
                  {/* Subtle Accent Glow */}
                  <div className="absolute top-0 right-0 w-28 h-28 bg-[#38bdf8]/[0.02] rounded-full blur-2xl pointer-events-none group-hover:bg-[#38bdf8]/[0.06] transition-all" />

                  <div>
                    {/* Top Header: Material Produced & Status Badge */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#6e8799] mb-1">
                          Material Produced
                        </div>
                        {/* Prominent Material Name */}
                        <div className="font-heading text-xl sm:text-2xl font-medium tracking-tight text-white group-hover:text-[#38bdf8] transition-colors flex items-center gap-2">
                          <span>{primaryMat}</span>
                          {extraMats.length > 0 && (
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-[#aab9c7]">
                              +{extraMats.length}
                            </span>
                          )}
                        </div>
                      </div>

                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider border shrink-0 ${
                          isCompleted
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                            : job.status === 'failed'
                            ? 'bg-rose-500/10 text-rose-300 border-rose-500/25'
                            : 'bg-amber-500/10 text-amber-300 border-amber-500/25'
                        }`}
                      >
                        {job.status}
                      </span>
                    </div>

                    {/* Objective / Goal */}
                    <p className="text-xs text-[#aab9c7] font-light line-clamp-1 mb-4">
                      {job.objective || 'Inverse Materials Discovery'}
                    </p>

                    {/* Produced Candidates Tags Preview */}
                    {job.materials_produced && job.materials_produced.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 mb-4">
                        {job.materials_produced.slice(0, 4).map((formula) => (
                          <span
                            key={formula}
                            className="font-mono text-[10px] px-2 py-0.5 rounded bg-white/[0.03] border border-white/[0.08] text-[#e9ecee]"
                          >
                            {formula}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Key Metrics Strip */}
                    <div className="grid grid-cols-3 gap-2 py-2.5 border-y border-white/[0.05] font-mono text-[10px] text-[#6e8799]">
                      <div>
                        <div>CANDIDATES</div>
                        <div className="text-xs text-[#e9ecee] font-medium mt-0.5">
                          {job.candidates_count || job.top_candidates?.length || 0}
                        </div>
                      </div>
                      <div>
                        <div>E_HULL</div>
                        <div className="text-xs text-[#e9ecee] font-medium mt-0.5">
                          {topCand?.e_hull !== undefined ? `${topCand.e_hull.toFixed(3)} eV` : '—'}
                        </div>
                      </div>
                      <div>
                        <div>RUNTIME</div>
                        <div className="text-xs text-[#e9ecee] font-medium mt-0.5">
                          {job.elapsed ? `${job.elapsed.toFixed(1)}s` : '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer Action Prompt */}
                  <div className="mt-4 pt-2 flex items-center justify-between text-xs text-[#6e8799] font-mono">
                    <span className="text-[10px] text-[#4b6070]">
                      {new Date(job.created_at * 1000).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedJob(job);
                      }}
                      className="flex items-center gap-1 text-[11px] text-[#38bdf8] group-hover:translate-x-1 transition-transform cursor-pointer"
                    >
                      <span>Inspect Candidate</span>
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Validated Materials Ledger & Crystalline Repository */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div>
            <h2 className="font-heading text-lg font-normal text-white">
              Crystalline Materials Registry
            </h2>
            <p className="text-xs text-[#6e8799]">
              Surrogate-validated phases ready for smart contract anchoring and marketplace licensing.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/registry')}
            className="btn-overworld text-xs py-1.5 px-3 flex items-center gap-1.5"
          >
            <span>Open Registry</span>
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>

        {!materials.length ? (
          <div className="card p-8 text-center text-[#6e8799] font-mono text-xs">
            No validated material structures currently in local repository.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {materials.map((mat) => (
              <div
                key={mat.id}
                className="card p-4 hover:border-white/20 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-heading text-lg text-white font-medium">
                      {mat.formula}
                    </span>
                    <span className="font-mono text-[9px] uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                      Validated
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-[#6e8799] space-y-1 mb-3">
                    <div className="flex justify-between">
                      <span>Density:</span>
                      <span className="text-[#e9ecee]">{mat.density.toFixed(2)} g/cm³</span>
                    </div>
                    <div className="flex justify-between">
                      <span>E_hull:</span>
                      <span className="text-[#e9ecee]">{mat.e_hull.toFixed(4)} eV/atom</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Form. Energy:</span>
                      <span className="text-[#e9ecee]">
                        {mat.predicted_formation_energy !== undefined
                          ? `${mat.predicted_formation_energy.toFixed(3)} eV`
                          : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between">
                  <span className="font-mono text-[9px] text-[#4b6070] truncate max-w-[120px]">
                    {mat.material_hash?.slice(0, 10)}…
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate('/registry')}
                    className="text-[10px] font-mono text-[#38bdf8] hover:underline flex items-center gap-1"
                  >
                    <span>Anchor</span>
                    <ArrowUpRight className="h-2.5 w-2.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Interactive Candidate Inspection Drawer / Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="card max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 border-white/20 shadow-2xl space-y-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[#6e8799]">
                    Discovery Job Telemetry
                  </span>
                  <span className="text-[#4b6070]">•</span>
                  <span className="font-mono text-[10px] text-[#aab9c7]">
                    {selectedJob.id}
                  </span>
                </div>
                <h3 className="font-heading text-2xl font-normal text-white flex items-center gap-3">
                  <span>{selectedJob.primary_material || 'Evaluated Phase Run'}</span>
                  <span
                    className={`text-xs font-mono uppercase px-2.5 py-0.5 rounded-full border ${
                      selectedJob.status === 'completed'
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    }`}
                  >
                    {selectedJob.status}
                  </span>
                </h3>
                <p className="text-xs text-[#aab9c7] mt-1 font-light">
                  {selectedJob.objective || 'Inverse Materials Discovery'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="p-1.5 rounded-lg border border-white/[0.08] text-[#6e8799] hover:text-white hover:border-white/20 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Target Criteria vs Actual */}
            {selectedJob.target_condition && (
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                <div className="text-[10px] font-mono uppercase tracking-wider text-[#6e8799] mb-2 flex items-center gap-2">
                  <SlidersHorizontal className="h-3 w-3" />
                  <span>Target Optimization Constraints</span>
                </div>
                <div className="grid grid-cols-3 gap-4 font-mono text-xs">
                  <div>
                    <div className="text-[10px] text-[#6e8799]">Target Form. Energy</div>
                    <div className="text-white mt-0.5 font-medium">
                      {selectedJob.target_condition.formation_energy_per_atom !== undefined
                        ? `${selectedJob.target_condition.formation_energy_per_atom} eV/atom`
                        : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#6e8799]">Target Density</div>
                    <div className="text-white mt-0.5 font-medium">
                      {selectedJob.target_condition.density !== undefined
                        ? `${selectedJob.target_condition.density} g/cm³`
                        : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#6e8799]">Target Band Gap</div>
                    <div className="text-white mt-0.5 font-medium">
                      {selectedJob.target_condition.band_gap !== undefined
                        ? `${selectedJob.target_condition.band_gap} eV`
                        : '—'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Produced Materials & Candidates Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-heading text-base font-normal text-white flex items-center gap-2">
                  <Atom className="h-4 w-4 text-[#38bdf8]" />
                  <span>Produced Candidate Phases</span>
                </h4>
                <span className="font-mono text-xs text-[#6e8799]">
                  {selectedJob.top_candidates?.length || 0} Evaluated Candidates
                </span>
              </div>

              {!selectedJob.top_candidates?.length ? (
                <div className="p-6 text-center text-[#6e8799] font-mono text-xs border border-white/[0.06] rounded-xl">
                  Candidates in this run did not satisfy strict convex hull cutoff (&lt; 0.05 eV/atom).
                  Check diagnostics below for screened stoichiometry errors.
                </div>
              ) : (
                <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#080c16]/60">
                  <table className="w-full text-left font-mono text-xs">
                    <thead className="bg-white/[0.03] border-b border-white/[0.06] text-[10px] text-[#6e8799] uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 px-4">Formula</th>
                        <th className="py-2.5 px-4">E_hull</th>
                        <th className="py-2.5 px-4">Form. Energy</th>
                        <th className="py-2.5 px-4">Consensus Spread</th>
                        <th className="py-2.5 px-4">Fingerprint</th>
                        <th className="py-2.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {selectedJob.top_candidates.map((cand, index) => (
                        <tr key={`${cand.formula}-${index}`} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-2.5 px-4 font-medium text-white flex items-center gap-2">
                            <span>{cand.formula}</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/[0.05] text-[#38bdf8]">
                              {cand.status || 'valid'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-[#e9ecee]">
                            {cand.e_hull !== undefined ? `${cand.e_hull.toFixed(4)} eV` : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-[#e9ecee]">
                            {cand.predicted_formation_energy !== undefined
                              ? `${cand.predicted_formation_energy.toFixed(3)} eV`
                              : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-[#e9ecee]">
                            {cand.consensus_spread !== undefined
                              ? `${cand.consensus_spread.toFixed(3)}`
                              : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-[#6e8799]">
                            {cand.material_hash ? (
                              <button
                                type="button"
                                onClick={() => handleCopy(cand.material_hash)}
                                className="flex items-center gap-1 hover:text-white transition"
                                title="Click to copy hash"
                              >
                                <span>{cand.material_hash.slice(0, 8)}…</span>
                                {copiedHash === cand.material_hash ? (
                                  <Check className="h-3 w-3 text-emerald-400" />
                                ) : (
                                  <Copy className="h-3 w-3 opacity-60" />
                                )}
                              </button>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedJob(null);
                                navigate('/registry');
                              }}
                              className="text-[10px] text-[#38bdf8] hover:underline"
                            >
                              Anchor
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Diagnostic Details Strip */}
            {selectedJob.diagnostics && (
              <div className="space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-wider text-[#6e8799] flex items-center gap-2">
                  <Cpu className="h-3 w-3" />
                  <span>Surrogate Model Diagnostics</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                  <div className="p-3 rounded-lg border border-white/[0.05] bg-white/[0.01]">
                    <div className="text-[10px] text-[#6e8799]">GENERATED</div>
                    <div className="text-white mt-1 font-medium">
                      {selectedJob.diagnostics.generated ?? '—'}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-white/[0.05] bg-white/[0.01]">
                    <div className="text-[10px] text-[#6e8799]">GEOM VALID</div>
                    <div className="text-white mt-1 font-medium">
                      {selectedJob.diagnostics.geometry_valid ?? '—'}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-white/[0.05] bg-white/[0.01]">
                    <div className="text-[10px] text-[#6e8799]">E_HULL PASSED</div>
                    <div className="text-white mt-1 font-medium">
                      {selectedJob.diagnostics.e_hull_passed ?? 0}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-white/[0.05] bg-white/[0.01]">
                    <div className="text-[10px] text-[#6e8799]">AVG SPREAD</div>
                    <div className="text-white mt-1 font-medium">
                      {selectedJob.diagnostics.ensemble_stats?.avg_spread !== undefined
                        ? selectedJob.diagnostics.ensemble_stats.avg_spread.toFixed(3)
                        : '—'}
                    </div>
                  </div>
                </div>

                {/* Thermodynamic error examples if none passed */}
                {selectedJob.diagnostics.errors?.thermodynamic && selectedJob.diagnostics.errors.thermodynamic.length > 0 && (
                  <div className="p-3 rounded-lg border border-white/[0.05] bg-white/[0.01] text-[10px] font-mono text-[#6e8799]">
                    <div className="text-white/80 font-medium mb-1">Screened Candidate Notes:</div>
                    <ul className="space-y-0.5 list-disc list-inside">
                      {selectedJob.diagnostics.errors.thermodynamic.slice(0, 3).map((err, idx) => (
                        <li key={idx} className="truncate">{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="btn-overworld text-xs py-2 px-4"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedJob(null);
                  navigate('/registry');
                }}
                className="btn-overworld-primary text-xs py-2 px-4 flex items-center gap-1.5"
              >
                <span>Anchor Discovery to Blockchain</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
