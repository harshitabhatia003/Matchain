import { useState, useEffect } from 'react';
import {
  X,
  Share2,
  ExternalLink,
  Copy,
  Check,
  Globe,
  HardDrive,
  Code,
  Download,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { fetchJson } from '../lib/api';
import type { IpfsShareBundle } from '../types';

interface IpfsShareModalProps {
  cid: string | null;
  formula?: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function IpfsShareModal({ cid, formula, isOpen, onClose }: IpfsShareModalProps) {
  const [bundle, setBundle] = useState<IpfsShareBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!cid || !isOpen) {
      setBundle(null);
      setError('');
      return;
    }

    setLoading(true);
    setError('');

    // Fetch share bundle from backend with server-side authorization check
    fetchJson<IpfsShareBundle>(`/api/storage/share/${encodeURIComponent(cid)}`)
      .then((data) => setBundle(data))
      .catch((err) => {
        setError(err?.message || 'Access denied: Only the material seller/owner may view or generate share links.');
        setBundle(null);
      })
      .finally(() => setLoading(false));
  }, [cid, isOpen, formula]);

  if (!isOpen || !cid) return null;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const isLocalFallback = cid.startsWith('local-sha256:');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="card max-w-xl w-full p-6 border-white/[0.12] bg-[#0c1220] shadow-2xl relative space-y-5">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-300">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-heading text-lg font-semibold text-white flex items-center gap-2">
                Share IPFS Content
                {formula && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.1] text-amber-300 font-mono">
                    {formula}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Decentralized content-addressed resource on IPFS
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Warning if local fallback hash */}
        {isLocalFallback && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-3 text-xs font-mono text-amber-200 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <span className="font-semibold block mb-0.5">Local Cache Reference</span>
              This record was saved when the IPFS daemon was offline. You can still inspect it locally or republish it to Kubo.
            </div>
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/[0.04] p-3 text-xs font-mono text-rose-300 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <div>
              <span className="font-semibold block mb-0.5">Authorization Error</span>
              {error}
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 font-mono text-xs gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
            <span>Resolving IPFS gateway links…</span>
          </div>
        ) : bundle ? (
          <div className="space-y-4">
            {/* IPFS Native URI Card */}
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
                Content Identifier (CID) & Protocol URI
              </label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={bundle.ipfs_uri}
                  className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-xs text-emerald-300 font-mono select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(bundle.ipfs_uri, 'uri')}
                  className="btn-overworld text-xs py-2.5 px-3 flex items-center gap-1.5"
                  title="Copy IPFS URI"
                >
                  {copiedKey === 'uri' ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-emerald-300">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-slate-400" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Public Gateway Access Links */}
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-2 flex items-center gap-1.5">
                <Globe className="h-3 w-3 text-cyan-400" />
                IPFS Web Gateways (Public & Local)
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(bundle.gateways).map(([label, url]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 hover:border-white/[0.12] transition"
                  >
                    <div className="truncate pr-2">
                      <span className="text-[10px] font-mono uppercase text-slate-400 block">
                        {label.replace('_', '.')}
                      </span>
                      <span className="text-xs font-mono text-slate-200 truncate block max-w-[160px]">
                        {url.replace(/^https?:\/\//, '')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(url, label)}
                        className="p-1 rounded text-slate-400 hover:text-white transition"
                        title="Copy gateway URL"
                      >
                        {copiedKey === label ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded text-amber-300 hover:text-amber-200 transition"
                        title="Open in gateway"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Academic & Markdown Embed Card */}
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1 flex items-center gap-1.5">
                <Code className="h-3 w-3 text-amber-400" />
                Citation & Markdown Share Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={bundle.markdown_link}
                  className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-xs text-slate-300 font-mono select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(bundle.markdown_link, 'markdown')}
                  className="btn-overworld text-xs py-2 px-3 flex items-center gap-1.5"
                >
                  {copiedKey === 'markdown' ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  <span>{copiedKey === 'markdown' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Direct Gateway Open Button */}
            <div className="pt-2 flex items-center justify-between border-t border-white/[0.06]">
              <span className="text-[11px] font-mono text-slate-400">
                CID: <code className="text-white">{bundle.cid.slice(0, 14)}…{bundle.cid.slice(-8)}</code>
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={bundle.primary_share_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-overworld-primary text-xs py-2 px-4 flex items-center gap-2"
                >
                  <span>Open on IPFS</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
