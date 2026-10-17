import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, TrendingDown, Cpu, AlertTriangle, Layers } from 'lucide-react';
import { fetchJson } from '../lib/api';

type Analytics = {
  job_id: string | null;
  model_availability: Record<string, boolean>;
  model_evaluation: Record<string, { r2: number; mae: number; rmse: number; n_test: number } | null>;
  vae_history: { epochs: number[]; total_loss: number[] };
};

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchJson<Analytics>('/api/analytics').then(setAnalytics).catch((reason: Error) => setError(reason.message));
  }, []);

  const modelData = Object.entries(analytics?.model_evaluation ?? {})
    .filter((entry): entry is [string, NonNullable<typeof entry[1]>] => entry[1] !== null)
    .map(([name, metrics]) => ({ name: name.toUpperCase(), ...metrics }));
  const trend = (analytics?.vae_history.epochs ?? []).map((epoch, index) => ({
    epoch,
    loss: analytics?.vae_history.total_loss[index] ?? null,
  }));

  const customTooltipStyle = {
    backgroundColor: '#0c1017',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '0.75rem',
    color: '#f8fafc',
    fontSize: '0.75rem',
    fontFamily: 'JetBrains Mono, monospace',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6)',
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-white">Neural Evaluation & Analytics</h1>
        <p className="mt-1 text-sm text-slate-400 font-light">
          Quantitative benchmarking across surrogate energy models and Crystal VAE reconstruction loss.
        </p>
      </div>

      {error && (
        <div role="alert" className="card border-rose-500/30 bg-rose-500/[0.04] p-4 text-xs font-mono text-rose-300 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>Could not load analytics metrics: {error}</span>
        </div>
      )}

      {analytics?.job_id && (
        <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          <span>Source run: <strong className="text-slate-200">{analytics.job_id}</strong>. Held-out test set evaluation; not experimental verification.</span>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Model Accuracy Benchmark Chart */}
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between border-b border-white/[0.06] pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-amber-300" />
              <h2 className="font-heading text-base font-semibold text-white">Surrogate Model R² Accuracy</h2>
            </div>
            <span className="text-xs font-mono text-slate-500">20% Held-out Test Set</span>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modelData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono' }} />
                <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono' }} domain={[0, 1]} />
                <Tooltip contentStyle={customTooltipStyle} cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }} />
                <Bar dataKey="r2" name="Held-out R²" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 pt-3 border-t border-white/[0.06] text-xs font-mono text-slate-400">
            {modelData.length
              ? modelData.map((item) => `${item.name}: MAE ${item.mae.toFixed(4)} eV/atom, n=${item.n_test}`).join(' · ')
              : 'Execute a discovery pipeline run to populate actual model benchmarks.'}
          </div>
        </div>

        {/* VAE Loss Trend */}
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between border-b border-white/[0.06] pb-3">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-cyan-300" />
              <h2 className="font-heading text-base font-semibold text-white">Crystal VAE Reconstruction Loss</h2>
            </div>
            <span className="text-xs font-mono text-slate-500">Latent Convergence</span>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                <XAxis dataKey="epoch" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono' }} />
                <YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'JetBrains Mono' }} />
                <Tooltip contentStyle={customTooltipStyle} />
                <Line type="monotone" dataKey="loss" stroke="#38bdf8" strokeWidth={2} dot={{ fill: '#38bdf8', r: 3 }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 pt-3 border-t border-white/[0.06] text-xs font-mono text-slate-400">
            {!trend.length ? 'Convergence telemetry recorded during active model training passes.' : `Total recorded epochs: ${trend.length}`}
          </div>
        </div>
      </div>
    </div>
  );
}
