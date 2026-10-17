import { useEffect, useState } from 'react';
import { Wrench, CheckCircle2, XCircle, AlertTriangle, Cpu, Terminal, Key, ExternalLink } from 'lucide-react';
import { fetchJson } from '../lib/api';

type Health = {
  status: string;
  blockchain: string;
  chain_id: number | null;
  registry_contract: string | null;
  marketplace_contract: string | null;
  backend_signing_enabled: boolean;
  storage_backend: string;
  materials_project_configured: boolean;
};

type Analytics = {
  model_availability: Record<string, boolean>;
};

export default function SettingsPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [modelAvailability, setModelAvailability] = useState<Record<string, boolean> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchJson<Health>('/api/health').then(setHealth).catch((reason: Error) => setError(reason.message));
    fetchJson<Analytics>('/api/analytics').then((data) => setModelAvailability(data.model_availability)).catch(() => setModelAvailability(null));
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-white">Environment & Infrastructure</h1>
        <p className="mt-1 text-sm text-slate-400 font-light">
          Runtime connectivity across Python FastAPI backend, EVM contracts, IPFS storage, and neural surrogate models.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Environment Status Card */}
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between border-b border-white/[0.06] pb-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-amber-300" />
              <h2 className="font-heading text-base font-semibold text-white">Service Health Matrix</h2>
            </div>
            <span className="text-xs font-mono text-slate-500">Live Diagnostics</span>
          </div>

          <ul className="space-y-2.5 text-xs font-mono text-slate-300">
            <li className="flex justify-between items-center py-1.5 border-b border-white/[0.04]">
              <span className="text-slate-400">FastAPI Backend:</span>
              <span className="text-slate-200">{health?.status ?? (error ? 'Unavailable' : 'Connecting…')}</span>
            </li>
            <li className="flex justify-between items-center py-1.5 border-b border-white/[0.04]">
              <span className="text-slate-400">Ganache Local RPC:</span>
              <span className="text-slate-200">
                {health?.blockchain ?? 'Checking…'}
                {health?.chain_id ? ` (Chain ${health.chain_id})` : ''}
              </span>
            </li>
            <li className="flex justify-between items-center py-1.5 border-b border-white/[0.04]">
              <span className="text-slate-400">Registry Contract:</span>
              <span className="text-slate-200">{health?.registry_contract ?? 'Not deployed'}</span>
            </li>
            <li className="flex justify-between items-center py-1.5 border-b border-white/[0.04]">
              <span className="text-slate-400">Marketplace Contract:</span>
              <span className="text-slate-200">{health?.marketplace_contract ?? 'Not deployed'}</span>
            </li>
            <li className="flex justify-between items-center py-1.5 border-b border-white/[0.04]">
              <span className="text-slate-400">Signing Mode:</span>
              <span className="text-slate-200">
                {health?.backend_signing_enabled ? 'Backend account' : 'Frontend MetaMask (EIP-1193)'}
              </span>
            </li>
            <li className="flex justify-between items-center py-1.5 border-b border-white/[0.04]">
              <span className="text-slate-400">Storage Provider:</span>
              <span className="text-slate-200">{health?.storage_backend ?? 'Checking…'}</span>
            </li>
            <li className="flex justify-between items-center py-1.5">
              <span className="text-slate-400">Materials Project API:</span>
              <span className="text-slate-200">
                {health ? (health.materials_project_configured ? 'Configured' : 'Synthetic fallback dataset') : 'Checking…'}
              </span>
            </li>
          </ul>

          {error && (
            <div role="alert" className="mt-4 rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs font-mono text-rose-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Model Availability Status */}
        <div className="card p-6 flex flex-col justify-between">
          <div>
            <div className="mb-4 flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-cyan-300" />
                <h2 className="font-heading text-base font-semibold text-white">Neural Model Availability</h2>
              </div>
              <span className="text-xs font-mono text-slate-500">Inference Engines</span>
            </div>

            <div className="space-y-3">
              {modelAvailability ? (
                Object.entries(modelAvailability).map(([name, available]) => (
                  <div key={name} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs font-mono">
                    <span className="font-semibold text-white uppercase">{name}</span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 border ${
                        available
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                      }`}
                    >
                      {available ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                      {available ? 'Active Engine' : 'Unavailable'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-xs font-mono text-slate-500 py-6 text-center">
                  Model availability reported dynamically upon completion of first discovery run.
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/[0.06] text-[11px] font-mono text-slate-400">
            CHGNet & M3GNet evaluate potential energy surfaces; XGBoost provides Magpie composition feature predictions.
          </div>
        </div>

        {/* Local Chain Setup Card (Zero emojis) */}
        <div className="card p-6 md:col-span-2">
          <div className="mb-4 flex items-center justify-between border-b border-white/[0.06] pb-3">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-amber-300" />
              <h2 className="font-heading text-base font-semibold text-white">Local Ganache & MetaMask Workflow</h2>
            </div>
            <span className="text-xs font-mono text-slate-500">Development Chain</span>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <ol className="space-y-3 text-xs font-mono text-slate-300 list-decimal list-inside leading-relaxed">
              <li>
                Install the{' '}
                <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="text-amber-300 underline inline-flex items-center gap-1">
                  MetaMask Extension <ExternalLink className="h-3 w-3 inline" />
                </a>.
              </li>
              <li>Open MetaMask → Settings → Networks → Add network manually.</li>
              <li>
                Configure RPC: Network: <code className="text-amber-200">Ganache Local</code> · RPC URL: <code className="text-amber-200">http://127.0.0.1:8545</code> · Chain ID: <code className="text-amber-200">1337</code> · Currency: <code className="text-amber-200">ETH</code>.
              </li>
              <li>Save and switch to the Ganache network.</li>
              <li>Import the development test key below into MetaMask:</li>
            </ol>

            <div className="space-y-3">
              <div className="rounded-xl border border-white/[0.08] bg-black/50 p-3 text-xs font-mono">
                <span className="text-[10px] uppercase text-slate-500 block mb-1">Development Private Key (Account #0)</span>
                <code className="break-all text-amber-200 text-[11px] select-all">
                  0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
                </code>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3 text-xs font-mono text-amber-200/90 flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                <span>
                  Development keys are publicly known and restricted strictly to local chain testing. Never export or deposit real assets.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
