import { useEffect, useState } from 'react';
import { Blocks, CheckCircle2, ShieldCheck, AlertTriangle, ArrowRight, Database, Hash, Share2, ExternalLink } from 'lucide-react';
import { postJson } from '../lib/api';
import { createRpcProvider, readRegistry, registerMaterial as registerOnchain, registryConfigured, shortHash } from '../services/contractClient';
import { useWallet } from '../services/wallet';
import IpfsShareModal from '../components/IpfsShareModal';

type RegistryEntry = {
  fingerprint?: string;
  structure_hash?: string;
  metadata?: string | Record<string, unknown>;
  block_number?: number;
  block_index?: number;
  verified?: boolean;
  creator?: string;
  ipfs_cid?: string;
};

export default function RegistryPage() {
  const [entries, setEntries] = useState<RegistryEntry[]>([]);
  const [error, setError] = useState('');
  const [materialHash, setMaterialHash] = useState('');
  const [formula, setFormula] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [transaction, setTransaction] = useState('');
  const [storageBackend, setStorageBackend] = useState('');
  const [storageConsent, setStorageConsent] = useState(false);
  const [shareCid, setShareCid] = useState<string | null>(null);
  const [shareFormula, setShareFormula] = useState<string | undefined>(undefined);
  const { connected, correctNetwork, connect, getSigner, address } = useWallet();

  const refresh = async () => setEntries(await readRegistry(createRpcProvider()));
  useEffect(() => { refresh().catch((reason: Error) => setError(reason.message)); }, [address, correctNetwork]);

  const formulaFor = (entry: RegistryEntry) => {
    if (typeof entry.metadata === 'object' && entry.metadata) return String(entry.metadata.formula ?? '—');
    if (typeof entry.metadata === 'string') {
      try { return String(JSON.parse(entry.metadata).formula ?? '—'); } catch { return '—'; }
    }
    return '—';
  };

  const registerMaterial = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!storageConsent) {
      setError('Confirm the public-storage disclosure before uploading registry metadata.');
      return;
    }
    setSubmitting(true);
    setError('');
    setTransaction('');
    try {
      if (!connected) await connect();
      if (!registryConfigured) throw new Error('Registry contract address is missing. Deploy the contracts and restart Vite.');
      const signer = await getSigner();
      const metadata = JSON.stringify({ formula });
      const stored = await postJson<{ storage_reference: string; storage_backend: string }>('/api/storage/upload', { content: { formula, material_hash: materialHash } });
      setStorageBackend(stored.storage_backend);
      const result = await registerOnchain(signer, { fingerprint: materialHash, storageReference: stored.storage_reference, metadata });
      setMaterialHash('');
      setFormula('');
      setTransaction(`Registered ID ${result.fingerprint}; block ${result.blockNumber}; transaction ${result.transactionHash}; event ${result.event?.name ?? 'not found'}. Storage: ${stored.storage_backend}.`);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not register material.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-white">Materials Provenance Registry</h1>
        <p className="mt-1 text-sm text-slate-400 font-light">
          On-chain cryptographic registry recording SHA-256 crystal fingerprints and IPFS metadata.
        </p>
      </div>

      {transaction && (
        <div role="status" className="card border-emerald-500/30 bg-emerald-500/[0.04] p-4 text-xs font-mono text-emerald-300 flex items-start gap-2.5">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
          <div className="break-all">{transaction}</div>
        </div>
      )}

      {error && (
        <div role="alert" className="card border-rose-500/30 bg-rose-500/[0.04] p-4 text-xs font-mono text-rose-300 flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
          <div className="break-all">{error}</div>
        </div>
      )}

      {!correctNetwork && (
        <div className="card border-amber-500/30 bg-amber-500/[0.04] p-4 text-xs font-mono text-amber-300 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
          <span>Connect MetaMask and switch to local chain 1337 to submit write transactions.</span>
        </div>
      )}

      {/* Storage Consent Notice */}
      <label className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-xs text-slate-300 leading-relaxed cursor-pointer hover:border-white/[0.12] transition-colors">
        <input
          type="checkbox"
          checked={storageConsent}
          onChange={(event) => setStorageConsent(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-700 text-amber-500 focus:ring-0"
        />
        <span>
          Registration uploads the fingerprint and formula metadata to the configured storage provider, then immutably records the reference on-chain. Public IPFS content is globally verifiable.
        </span>
      </label>

      {/* Direct Registration Form */}
      <form onSubmit={registerMaterial} className="card p-6 grid gap-4 md:grid-cols-[1fr_200px_auto]">
        <div>
          <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-1.5">
            Material SHA-256 Fingerprint
          </label>
          <input
            required
            value={materialHash}
            onChange={(event) => setMaterialHash(event.target.value)}
            placeholder="0x..."
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-xs text-white font-mono placeholder-slate-600 focus:border-amber-400/50 focus:outline-none transition-colors"
          />
        </div>

        <div>
          <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-1.5">
            Chemical Formula
          </label>
          <input
            required
            value={formula}
            onChange={(event) => setFormula(event.target.value)}
            placeholder="e.g. TiVAl"
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-xs text-white font-mono placeholder-slate-600 focus:border-amber-400/50 focus:outline-none transition-colors"
          />
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={submitting || !registryConfigured}
            className="button-primary w-full disabled:opacity-50"
          >
            {submitting ? 'Confirming in Wallet…' : 'Register on Ledger'}
          </button>
        </div>
      </form>

      {/* Verified Registry Table */}
      <div className="card p-6 overflow-hidden">
        <div className="mb-4 flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-amber-300" />
            <h2 className="font-heading text-base font-semibold text-white">Anchored Crystal Ledger</h2>
          </div>
          <span className="text-xs font-mono text-slate-500">{entries.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono text-slate-300">
            <thead>
              <tr className="border-b border-white/[0.08] text-slate-400 uppercase tracking-wider text-[11px]">
                <th className="pb-3 font-medium">Block</th>
                <th className="pb-3 font-medium">Formula</th>
                <th className="pb-3 font-medium">Fingerprint & Creator</th>
                <th className="pb-3 font-medium">Storage Reference</th>
                <th className="pb-3 font-medium text-right">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {entries.map((entry, index) => (
                <tr key={entry.fingerprint ?? entry.structure_hash ?? index} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5 text-amber-300 font-semibold">
                    #{entry.block_number ?? entry.block_index ?? '—'}
                  </td>
                  <td className="py-3.5 font-bold text-white font-heading text-sm">
                    {formulaFor(entry)}
                  </td>
                  <td className="py-3.5">
                    <span className="text-slate-200">{shortHash(entry.fingerprint ?? entry.structure_hash ?? '—')}</span>
                    {entry.creator && (
                      <div className="text-[10px] text-slate-500 truncate max-w-[180px]">
                        Creator: {entry.creator}
                      </div>
                    )}
                  </td>
                  <td className="py-3.5">
                    {(() => {
                      const isCreator = Boolean(address && entry.creator && entry.creator.toLowerCase() === address.toLowerCase());
                      const isMasked = !entry.ipfs_cid || entry.ipfs_cid.includes('[RESTRICTED');
                      if (isCreator && entry.ipfs_cid && !isMasked) {
                        return (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setShareCid(entry.ipfs_cid || null);
                                setShareFormula(formulaFor(entry));
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-amber-400/30 text-amber-300 transition"
                              title="View IPFS Gateways & Share"
                            >
                              <Share2 className="h-2.5 w-2.5 text-amber-400" />
                              <span>
                                {entry.ipfs_cid.startsWith('local-sha256:')
                                  ? 'Local cache'
                                  : `${entry.ipfs_cid.slice(0, 8)}…${entry.ipfs_cid.slice(-6)}`}
                              </span>
                            </button>
                            {!entry.ipfs_cid.startsWith('local-sha256:') && (
                              <a
                                href={`https://ipfs.io/ipfs/${entry.ipfs_cid}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-slate-500 hover:text-white p-0.5"
                                title="Open in IPFS Gateway"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        );
                      }
                      return (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono bg-slate-800/80 border border-slate-700/60 text-slate-400" title="Private storage reference. Access restricted to creator and licensed buyers.">
                          <ShieldCheck className="h-3 w-3 text-amber-400/70" />
                          <span>Protected (Creator Only)</span>
                        </span>
                      );
                    })()}
                  </td>
                  <td className="py-3.5 text-right">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" />
                      {entry.verified ? 'Verified' : 'Registered'}
                    </span>
                  </td>
                </tr>
              ))}
              {!entries.length && !error && (
                <tr>
                  <td className="py-8 text-center text-slate-500" colSpan={5}>
                    No registered materials found on the current contract state.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <IpfsShareModal
        cid={shareCid}
        formula={shareFormula}
        isOpen={Boolean(shareCid)}
        onClose={() => setShareCid(null)}
      />
    </div>
  );
}
