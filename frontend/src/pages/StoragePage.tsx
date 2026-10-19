import { useEffect, useState, useRef } from 'react';
import {
  HardDrive,
  Upload,
  Download,
  Share2,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Database,
  RefreshCw,
  Copy,
  Check,
  Globe,
  Terminal,
  Search,
  Eye,
  Loader2,
  Cpu,
  Layers,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { fetchJson, postJson, uploadFile } from '../lib/api';
import type { IpfsStatus, IpfsStoredItem } from '../types';
import IpfsShareModal from '../components/IpfsShareModal';
import { useWallet } from '../services/wallet';

export default function StoragePage() {
  const [status, setStatus] = useState<IpfsStatus | null>(null);
  const [storedItems, setStoredItems] = useState<IpfsStoredItem[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Upload state
  const [uploadMode, setUploadMode] = useState<'file' | 'json'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [jsonContent, setJsonContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadedResult, setUploadedResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Retrieval / Inspection state
  const [lookupCid, setLookupCid] = useState('');
  const [retrieving, setRetrieving] = useState(false);
  const [inspectedContent, setInspectedContent] = useState<any>(null);
  const [inspectError, setInspectError] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const retrievePanelRef = useRef<HTMLDivElement | null>(null);

  // Share modal state
  const [shareCid, setShareCid] = useState<string | null>(null);
  const [shareFormula, setShareFormula] = useState<string | undefined>(undefined);

  const refreshAll = async () => {
    setLoadingStatus(true);
    try {
      const [nodeStatus, pins] = await Promise.all([
        fetchJson<IpfsStatus>('/api/storage/status').catch(() => null),
        fetchJson<IpfsStoredItem[]>('/api/storage/pins').catch(() => []),
      ]);
      setStatus(nodeStatus);
      setStoredItems(pins);
    } catch (err: any) {
      setError(err?.message || 'Failed to load IPFS storage data.');
    } finally {
      setLoadingStatus(false);
    }
  };

  const { address, connected } = useWallet();

  useEffect(() => {
    refreshAll();
  }, [address]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a file to upload to IPFS.');
      return;
    }

    if (!connected || !address) {
      setError('Connect your seller wallet before uploading confidential crystal files.');
      return;
    }

    setUploading(true);
    setError('');
    setSuccessMsg('');
    setUploadedResult(null);

    try {
      const res = await uploadFile<any>('/api/storage/upload-file', selectedFile);
      setUploadedResult(res);
      setSuccessMsg(`File "${res.filename}" encrypted with AES-256-GCM and pinned to IPFS with CID: ${res.cid}. Decryption keys are held securely on backend.`);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await refreshAll();
    } catch (err: any) {
      setError(err?.message || 'File upload to IPFS failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleJsonUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jsonContent.trim()) {
      setError('Enter valid JSON discovery metadata to upload.');
      return;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonContent);
    } catch {
      setError('Invalid JSON syntax. Please verify formatting.');
      return;
    }

    setUploading(true);
    setError('');
    setSuccessMsg('');
    setUploadedResult(null);

    try {
      const res = await postJson<any>('/api/storage/upload', { content: parsed });
      setUploadedResult(res);
      setSuccessMsg(`Discovery JSON pinned to IPFS with reference: ${res.storage_reference}`);
      await refreshAll();
    } catch (err: any) {
      setError(err?.message || 'JSON upload to IPFS failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleRetrieve = async (cidToLookup?: string) => {
    const target = (cidToLookup || lookupCid).trim();
    if (!target) {
      setError('Enter an IPFS CID or storage hash to retrieve.');
      return;
    }

    setRetrieving(true);
    setError('');
    setInspectError('');
    setInspectedContent(null);
    if (cidToLookup) setLookupCid(target);

    try {
      const data = await fetchJson<any>(`/api/storage/content/${encodeURIComponent(target)}`);
      setInspectedContent(data);
      setLookupCid(target);
      if (cidToLookup) {
        window.setTimeout(() => retrievePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
      }
    } catch (err: any) {
      const message = err?.message || `Could not find content for CID "${target}".`;
      if (cidToLookup) {
        setInspectError(message);
        window.setTimeout(() => retrievePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
      } else {
        setError(message);
      }
    } finally {
      setRetrieving(false);
    }
  };

  const insertSampleJson = () => {
    const sample = {
      formula: 'TiVAl',
      material_hash: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
      crystal_system: 'Cubic',
      density: 4.82,
      formation_energy_per_atom: -1.24,
      band_gap: 0.0,
      e_hull: 0.015,
      lattice: [
        [3.12, 0.0, 0.0],
        [0.0, 3.12, 0.0],
        [0.0, 0.0, 3.12],
      ],
      species: ['Ti', 'V', 'Al'],
      generator: 'CrystalVAE-v2',
      verified_onchain: true,
      timestamp: new Date().toISOString(),
    };
    setJsonContent(JSON.stringify(sample, null, 2));
  };

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-white flex items-center gap-3">
            <HardDrive className="h-8 w-8 text-amber-400" />
            IPFS Storage & Sharing Hub
          </h1>
          <p className="mt-1 text-sm text-slate-400 font-light">
            Decentralized content-addressed crystal provenance and immutable data distribution via Kubo daemon.
          </p>
        </div>
        <button
          type="button"
          onClick={refreshAll}
          disabled={loadingStatus}
          className="btn-overworld text-xs py-2 px-3.5 flex items-center gap-2 self-start md:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loadingStatus ? 'animate-spin text-amber-400' : ''}`} />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {/* Global Alerts */}
      {successMsg && (
        <div role="status" className="card border-emerald-500/30 bg-emerald-500/[0.04] p-4 text-xs font-mono text-emerald-300 flex items-start gap-2.5">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
          <div className="break-all">{successMsg}</div>
        </div>
      )}

      {error && (
        <div role="alert" className="card border-rose-500/30 bg-rose-500/[0.04] p-4 text-xs font-mono text-rose-300 flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
          <div className="break-all">{error}</div>
        </div>
      )}

      {/* Security Architecture & Encryption Notice */}
      <div className="card border-cyan-500/30 bg-cyan-500/[0.03] p-4 text-xs font-mono text-cyan-200 flex items-start gap-3">
        <ShieldCheck className="h-4 w-4 shrink-0 text-cyan-400 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold text-white">Confidential Content-Addressed Storage Architecture</div>
          <div className="text-slate-300 text-[11px] leading-relaxed">
            Sensitive crystal structure files (CIF, POSCAR) are encrypted via AES-256-GCM before pinning to IPFS.
            Decryption keys are held securely by the server and released only to verified on-chain buyers and owners.
            Public IPFS nodes and gateways only see ciphertext.
          </div>
        </div>
      </div>

      {!connected && (
        <div className="card border-amber-500/30 bg-amber-500/[0.04] p-4 text-xs font-mono text-amber-300 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
          <span>Connect your seller wallet to upload materials and manage your private IPFS crystal pins.</span>
        </div>
      )}

      {/* Kubo IPFS Node Live Diagnostics Card */}
      <div className="card p-6 border-white/[0.08] bg-white/[0.01]">
        <div className="mb-4 flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-2.5">
            <div className={`h-2.5 w-2.5 rounded-full ${status?.online ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <h2 className="font-heading text-base font-semibold text-white">Local Kubo IPFS Daemon</h2>
            <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${
              status?.online
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/25 text-amber-300'
            }`}>
              {status?.online ? 'Daemon Active' : 'Offline (Cache Mode)'}
            </span>
          </div>
          <span className="text-xs font-mono text-slate-500">Port 5001 RPC</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
          <div className="p-3 rounded-xl border border-white/[0.06] bg-black/20">
            <span className="text-[10px] uppercase text-slate-500 block mb-1">Daemon API URL</span>
            <code className="text-amber-200 text-[11px] truncate block" title={status?.api_url}>
              {status?.api_url || 'http://127.0.0.1:5001'}
            </code>
          </div>

          <div className="p-3 rounded-xl border border-white/[0.06] bg-black/20">
            <span className="text-[10px] uppercase text-slate-500 block mb-1">Kubo Version</span>
            <span className="text-white text-xs block">
              {status?.version ? `Kubo v${status.version}` : 'Not Detected'}
            </span>
          </div>

          <div className="p-3 rounded-xl border border-white/[0.06] bg-black/20">
            <span className="text-[10px] uppercase text-slate-500 block mb-1">Swarm Peers</span>
            <span className="text-cyan-300 text-xs font-semibold block">
              {status?.peers_count ?? 0} Connected Peers
            </span>
          </div>

          <div className="p-3 rounded-xl border border-white/[0.06] bg-black/20">
            <span className="text-[10px] uppercase text-slate-500 block mb-1">Pinned Objects</span>
            <span className="text-emerald-300 text-xs font-semibold block">
              {status?.stored_items_count ?? storedItems.length} Materials
            </span>
          </div>
        </div>

        {!status?.online && (
          <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-start gap-2.5 text-xs font-mono text-amber-200/90">
            <Terminal className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <span>To connect a live local IPFS node, open a terminal and run: </span>
              <code className="text-white bg-black/50 px-2 py-0.5 rounded border border-white/[0.1] ml-1">
                ipfs daemon
              </code>
              <span className="text-slate-400 block mt-1 text-[11px]">
                MatChain will automatically upload, pin, and fetch from your local Kubo daemon when running. Offline data is safely preserved using standard CIDv1 content identifiers.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Main Dual Work Area: Upload & Retrieve */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Upload & Pin to IPFS */}
        <div className="card p-6 flex flex-col justify-between">
          <div>
            <div className="mb-4 flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-amber-300" />
                <h2 className="font-heading text-base font-semibold text-white">Store & Pin on IPFS</h2>
              </div>
              <div className="flex items-center gap-1 bg-white/[0.04] p-0.5 rounded-lg border border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setUploadMode('file')}
                  className={`px-2.5 py-1 text-[10px] font-mono uppercase rounded-md transition ${
                    uploadMode === 'file' ? 'bg-amber-400/20 text-amber-300 font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  File
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMode('json')}
                  className={`px-2.5 py-1 text-[10px] font-mono uppercase rounded-md transition ${
                    uploadMode === 'json' ? 'bg-amber-400/20 text-amber-300 font-semibold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  JSON
                </button>
              </div>
            </div>

            {uploadMode === 'file' ? (
              <form onSubmit={handleFileUpload} className="space-y-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-2xl border-2 border-dashed border-white/[0.12] hover:border-amber-400/40 bg-white/[0.01] hover:bg-white/[0.03] p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2.5"
                >
                  <FileText className="h-8 w-8 text-amber-300/80 mb-1" />
                  <div className="text-xs text-white font-mono font-medium">
                    {selectedFile ? selectedFile.name : 'Click to select or drop crystal file'}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Supports .cif, .poscar, .json, .csv, and crystal metadata bundles
                  </div>
                  {selectedFile && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 mt-1">
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </span>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={uploading}
                  className="btn-overworld-primary w-full py-2.5 text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-black" />
                      <span>Pinning to IPFS…</span>
                    </>
                  ) : (
                    <>
                      <HardDrive className="h-4 w-4" />
                      <span>Upload & Pin to IPFS</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleJsonUpload} className="space-y-4">
                <div className="flex justify-between items-center text-[11px] font-mono text-slate-400">
                  <span>Crystal Discovery Metadata Payload</span>
                  <button
                    type="button"
                    onClick={insertSampleJson}
                    className="text-amber-400 hover:text-amber-300 underline"
                  >
                    Load Sample Discovery
                  </button>
                </div>
                <textarea
                  rows={8}
                  value={jsonContent}
                  onChange={(e) => setJsonContent(e.target.value)}
                  placeholder={`{\n  "formula": "TiVAl",\n  "density": 4.82,\n  "e_hull": 0.015\n}`}
                  className="w-full rounded-xl border border-white/[0.08] bg-black/40 p-3 text-xs text-emerald-300 font-mono focus:border-amber-400/50 focus:outline-none transition-colors"
                />

                <button
                  type="submit"
                  disabled={uploading}
                  className="btn-overworld-primary w-full py-2.5 text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-black" />
                      <span>Pinning JSON to IPFS…</span>
                    </>
                  ) : (
                    <>
                      <HardDrive className="h-4 w-4" />
                      <span>Pin JSON Metadata</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {uploadedResult && (
            <div className="mt-4 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Pinned CID:</span>
                <span className="text-emerald-300 font-bold select-all truncate max-w-[200px]">
                  {uploadedResult.cid || uploadedResult.storage_reference}
                </span>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShareCid(uploadedResult.cid || uploadedResult.storage_reference);
                    setShareFormula(uploadedResult.filename);
                  }}
                  className="btn-overworld text-[11px] py-1 px-2.5 flex items-center gap-1"
                >
                  <Share2 className="h-3 w-3 text-amber-400" />
                  <span>Share</span>
                </button>
                <a
                  href={uploadedResult.share_url || `https://ipfs.io/ipfs/${uploadedResult.cid || uploadedResult.storage_reference}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-overworld text-[11px] py-1 px-2.5 flex items-center gap-1 text-cyan-300"
                >
                  <Globe className="h-3 w-3" />
                  <span>Open Gateway</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Retrieve Content & Inspect by CID */}
        <div ref={retrievePanelRef} className="card p-6 flex flex-col justify-between scroll-mt-24">
          <div>
            <div className="mb-4 flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-cyan-300" />
                <h2 className="font-heading text-base font-semibold text-white">Retrieve & Inspect from IPFS</h2>
              </div>
              <span className="text-xs font-mono text-slate-500">Content-Addressed</span>
            </div>

            <div className="space-y-4">
              {inspectError && (
                <div role="alert" className="rounded-xl border border-rose-500/25 bg-rose-500/[0.05] px-3 py-2.5 text-xs font-mono text-rose-300 break-all">
                  {inspectError}
                </div>
              )}
              <div>
                <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-1.5">
                  IPFS CID or Storage Reference
                </label>
                <div className="flex gap-2">
                  <input
                    value={lookupCid}
                    onChange={(e) => setLookupCid(e.target.value)}
                    placeholder="bafkrei... or Qm... or local-sha256:..."
                    className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-xs text-white font-mono focus:border-amber-400/50 focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => handleRetrieve()}
                    disabled={retrieving || !lookupCid.trim()}
                    className="btn-overworld text-xs py-2.5 px-4 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {retrieving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
                    ) : (
                      <Search className="h-3.5 w-3.5 text-amber-400" />
                    )}
                    <span>Fetch</span>
                  </button>
                </div>
              </div>

              {inspectedContent ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-white/[0.06] pb-2">
                    <span className="flex items-center gap-1.5 text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Retrieved via {inspectedContent.source}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {inspectedContent.size_bytes} bytes
                    </span>
                  </div>

                  <pre className="max-h-[200px] overflow-auto rounded-xl border border-white/[0.08] bg-black/50 p-3 text-xs text-slate-300 font-mono select-all">
                    {inspectedContent.raw_text}
                  </pre>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(inspectedContent.raw_text, 'raw_data')}
                      className="btn-overworld text-[11px] py-1 px-2.5 flex items-center gap-1"
                    >
                      {copiedKey === 'raw_data' ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      <span>{copiedKey === 'raw_data' ? 'Copied' : 'Copy Content'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShareCid(inspectedContent.cid);
                        setShareFormula(inspectedContent.filename || inspectedContent.data?.formula);
                      }}
                      className="btn-overworld text-[11px] py-1 px-2.5 flex items-center gap-1 text-amber-300"
                    >
                      <Share2 className="h-3 w-3" />
                      <span>Share Links</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center border border-white/[0.04] rounded-xl bg-white/[0.01] text-xs font-mono text-slate-500">
                  Paste any CID from the ledger below to fetch and verify the immutable payload directly from IPFS.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pinned Discoveries & IPFS Objects Ledger */}
      <div className="card p-6 overflow-hidden">
        <div className="mb-4 flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-amber-300" />
            <h2 className="font-heading text-base font-semibold text-white">Anchored Discoveries & Stored Objects</h2>
          </div>
          <span className="text-xs font-mono text-slate-500">{storedItems.length} stored resources</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono text-slate-300">
            <thead>
              <tr className="border-b border-white/[0.08] text-slate-400 uppercase tracking-wider text-[11px]">
                <th className="pb-3 font-medium">Resource</th>
                <th className="pb-3 font-medium">Content Identifier (CID)</th>
                <th className="pb-3 font-medium">Size</th>
                <th className="pb-3 font-medium">Network Status</th>
                <th className="pb-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {storedItems.map((item, idx) => (
                <tr key={item.cid ?? idx} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5 font-bold text-white font-heading text-sm">
                    {item.formula || item.filename || 'Material Payload'}
                  </td>
                  <td className="py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-300 font-mono text-[11px]">
                        {item.cid.slice(0, 12)}…{item.cid.slice(-8)}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(item.cid, `cid_${idx}`)}
                        className="text-slate-500 hover:text-white transition"
                        title="Copy CID"
                      >
                        {copiedKey === `cid_${idx}` ? (
                          <Check className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="py-3.5 text-slate-400">
                    {item.size_bytes ? `${(item.size_bytes / 1024).toFixed(1)} KB` : '—'}
                  </td>
                  <td className="py-3.5">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" />
                      Pinned IPFS
                    </span>
                  </td>
                  <td className="py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleRetrieve(item.cid)}
                        className="btn-overworld text-[10px] py-1 px-2.5 flex items-center gap-1"
                        title="Inspect content"
                      >
                        <Eye className="h-3 w-3 text-cyan-300" />
                        <span>Inspect</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShareCid(item.cid);
                          setShareFormula(item.formula);
                        }}
                        className="btn-overworld text-[10px] py-1 px-2.5 flex items-center gap-1 text-amber-300"
                        title="Share on IPFS"
                      >
                        <Share2 className="h-3 w-3" />
                        <span>Share</span>
                      </button>
                      <a
                        href={item.share_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded text-slate-400 hover:text-white transition"
                        title="Open on IPFS Gateway"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
              {!storedItems.length && !error && (
                <tr>
                  <td className="py-8 text-center text-slate-500" colSpan={5}>
                    No stored items found on IPFS store yet. Upload a crystal file or discovery to begin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reusable Share Modal */}
      <IpfsShareModal
        cid={shareCid}
        formula={shareFormula}
        isOpen={Boolean(shareCid)}
        onClose={() => setShareCid(null)}
      />
    </div>
  );
}
