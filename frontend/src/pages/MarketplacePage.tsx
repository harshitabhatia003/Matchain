import React, { useEffect, useState, useMemo } from 'react';
import {
  ShoppingBag,
  Tag,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Wallet,
  UserCheck,
  Sparkles,
  Filter,
  Layers,
  Flame,
  Download,
  Lock,
  Unlock,
  Coins,
  Activity,
  FileText,
  Check,
  RotateCcw,
  Award,
  Zap,
  Search,
  Eye,
  X,
  Clock,
  ChevronRight,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import {
  createListing as sendListing,
  attestMaterial,
  createRpcProvider,
  marketplaceConfigured,
  purchaseListing as sendPurchase,
  readMarketplace,
  readRegistry,
  readValidatorStake,
  withdrawValidatorStake,
  shortHash,
} from '../services/contractClient';
import { useWallet } from '../services/wallet';
import {
  downloadAuthorizedFile,
  fetchAuthorizedCif,
  auditMarketplaceMaterial,
  validateMarketplaceMaterial,
  fetchMarketplaceStats,
  fetchMarketplaceListings,
  type AuditReport,
  type MarketplaceStats,
} from '../lib/api';
import CifStructurePreview from '../components/CifStructurePreview';

type MarketplaceRole = 'buyer' | 'seller' | 'validator';

interface EnrichedListing {
  material_hash: string;
  seller: string;
  buyer: string;
  price_eth: string;
  price_wei?: string;
  license: string;
  sold: boolean;
  formula?: string;
  density?: number;
  e_hull?: number;
  predicted_formation_energy?: number;
  consensus_spread?: number;
  verified?: boolean;
  validator?: string | null;
  validation_score?: number | null;
  category?: string;
}

interface RegisteredMaterial {
  fingerprint: string;
  metadata: string;
  block_number: number;
  creator: string;
}

function formulaFor(meta: string): string {
  try {
    const parsed = JSON.parse(meta) as Record<string, unknown>;
    if (typeof parsed.formula === 'string' && parsed.formula) return parsed.formula;
  } catch { /* raw string */ }
  return meta.length > 12 ? `${meta.slice(0, 12)}…` : meta || 'Unknown';
}

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

export default function MarketplacePage() {
  const [activeTab, setActiveTab] = useState<MarketplaceRole>('buyer');
  const [listings, setListings] = useState<EnrichedListing[]>([]);
  const [materials, setMaterials] = useState<RegisteredMaterial[]>([]);
  const [stats, setStats] = useState<MarketplaceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [errorNotice, setErrorNotice] = useState('');
  const [busyHash, setBusyHash] = useState<string | null>(null);

  // Filter & Search states (Buyer)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [filterVerifiedOnly, setFilterVerifiedOnly] = useState(false);

  // Create Listing Form states (Seller)
  const [materialHash, setMaterialHash] = useState('');
  const [price, setPrice] = useState('0.1');
  const [license, setLicense] = useState('academic-research');
  const [creating, setCreating] = useState(false);

  // Validator Hub states
  const [stakedBalanceEth, setStakedBalanceEth] = useState('0');
  const [withdrawingStake, setWithdrawingStake] = useState(false);
  const [auditingHash, setAuditingHash] = useState<string | null>(null);
  const [activeAuditReport, setActiveAuditReport] = useState<AuditReport | null>(null);
  const [auditSimulating, setAuditSimulating] = useState(false);
  const [auditProgress, setAuditProgress] = useState(0);

  // Modals
  const [previewMaterial, setPreviewMaterial] = useState<EnrichedListing | null>(null);
  const [previewCif, setPreviewCif] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [certModalMaterial, setCertModalMaterial] = useState<EnrichedListing | null>(null);

  const { connected, correctNetwork, connect, getSigner, address } = useWallet();

  const refreshData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch backend stats
      try {
        const statsRes = await fetchMarketplaceStats();
        setStats(statsRes);
      } catch { /* ignore */ }

      // 2. Fetch enriched on-chain listings from backend (merges blockchain + DB props)
      let backendListings: EnrichedListing[] = [];
      try {
        backendListings = await fetchMarketplaceListings();
      } catch {
        backendListings = [];
      }

      // 3. Attempt reading on-chain contract directly for live merge
      try {
        const provider = createRpcProvider();
        const [onchainListings, registeredMaterials] = await Promise.all([
          readMarketplace(provider).catch(() => []),
          readRegistry(provider).catch(() => []),
        ]);

        setMaterials(registeredMaterials);

        if (onchainListings.length) {
          // Merge on-chain raw data with backend-enriched properties
          const merged: EnrichedListing[] = onchainListings.map((item) => {
            const matchBackend = backendListings.find(
              (b) => b.material_hash.toLowerCase() === item.material_hash.toLowerCase()
            );
            const registryRecord = registeredMaterials.find(
              (material) => material.fingerprint.toLowerCase() === item.material_hash.toLowerCase()
            );
            return {
              ...item,
              formula: matchBackend?.formula ?? formulaFor(item.material_hash),
              density: matchBackend?.density,
              e_hull: matchBackend?.e_hull,
              predicted_formation_energy: matchBackend?.predicted_formation_energy,
              consensus_spread: matchBackend?.consensus_spread,
              // The registry is the source of truth for attestation state. The
              // backend can lag after an on-chain transaction and leave a
              // verified listing incorrectly visible in the pending queue.
              verified: registryRecord?.verified ?? matchBackend?.verified ?? false,
              validator: matchBackend?.validator ?? null,
              validation_score: matchBackend?.validation_score ?? null,
              category: matchBackend?.category,
            };
          });
          setListings(merged);
        } else if (backendListings.length) {
          setListings(backendListings);
        } else {
          // No listings yet — empty is correct; don't fake data
          setListings([]);
        }
      } catch {
        // Contract node offline; use whatever backend reported
        setListings(backendListings);
      }
    } finally {
      setIsLoading(false);
    }
  };


  useEffect(() => {
    refreshData().catch((err: Error) => setErrorNotice(err.message));
  }, [address, correctNetwork]);

  useEffect(() => {
    if (!address) { setStakedBalanceEth('0'); return; }
    readValidatorStake(createRpcProvider(), address)
      .then(setStakedBalanceEth)
      .catch(() => setStakedBalanceEth('0'));
  }, [address, correctNetwork]);

  useEffect(() => {
    setPreviewCif('');
    setPreviewError('');
    if (!previewMaterial || !previewMaterial.sold) return;
    if (!address) {
      setPreviewError('Connect the wallet that purchased this material to view its private CIF preview.');
      return;
    }
    if (previewMaterial.buyer.toLowerCase() !== address.toLowerCase()) {
      setPreviewError(
        `This license belongs to buyer wallet ${previewMaterial.buyer}. Switch MetaMask to that wallet to view the private CIF preview.`,
      );
      return;
    }
    fetchAuthorizedCif(previewMaterial.material_hash)
      .then(setPreviewCif)
      .catch((error: Error) => setPreviewError(error.message));
  }, [previewMaterial, address]);

  // Buyer: Purchase Recipe
  const purchase = async (item: EnrichedListing) => {
    setBusyHash(item.material_hash);
    setNotice(`Initiating escrow purchase for ${item.formula} (${item.price_eth} ETH)…`);
    setErrorNotice('');
    try {
      if (!connected) await connect();
      const signer = await getSigner();
      const result = await sendPurchase(signer, item.material_hash);
      await refreshData();
      setNotice(
        `🎉 Purchase Confirmed! Tx: ${result.transactionHash?.slice(0, 10)}… in block ${result.blockNumber}. Your exclusive AES-256 decryption key has been unlocked.`
      );
      // Auto open certificate modal
      setCertModalMaterial({ ...item, buyer: address || '', sold: true });
    } catch (error) {
      setErrorNotice(error instanceof Error ? error.message : 'Purchase failed or was rejected in MetaMask.');
    } finally {
      setBusyHash(null);
    }
  };

  // Seller: Publish Listing
  const createListing = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setNotice('Publishing encrypted recipe to marketplace contract…');
    setErrorNotice('');
    try {
      if (!connected) await connect();
      const signer = await getSigner();
      const selectedMaterial = materials.find((m) => m.fingerprint === materialHash);
      if (selectedMaterial && selectedMaterial.creator.toLowerCase() !== (await signer.getAddress()).toLowerCase()) {
        throw new Error('Only the wallet recorded as the registered material creator may create this listing.');
      }
      const result = await sendListing(signer, { materialHash, priceEth: price, license });
      setMaterialHash('');
      await refreshData();
      setNotice(`✅ Listing live on-chain in block ${result.blockNumber}! Material is now open for validation and buyer licensing.`);
    } catch (error) {
      setErrorNotice(error instanceof Error ? error.message : 'Could not create listing. Ensure Ganache is running.');
    } finally {
      setCreating(false);
    }
  };

  // Validator: Run Simulation & Screen
  const handleRunAudit = async (matHash: string) => {
    setAuditingHash(matHash);
    setAuditSimulating(true);
    setAuditProgress(15);

    try {
      const p1 = setTimeout(() => setAuditProgress(45), 350);
      const p2 = setTimeout(() => setAuditProgress(80), 750);
      const report = await auditMarketplaceMaterial(matHash);
      clearTimeout(p1);
      clearTimeout(p2);
      setAuditProgress(100);
      setTimeout(() => {
        setActiveAuditReport(report);
        setAuditSimulating(false);
      }, 400);
    } catch (err: any) {
      setAuditSimulating(false);
      setErrorNotice(`Audit calculation error: ${err.message}`);
    }
  };

  // Validator: Attest On-Chain
  const handleAttest = async (matHash: string) => {
    const listing = listings.find((item) => item.material_hash.toLowerCase() === matHash.toLowerCase());
    if (listing && address && listing.seller.toLowerCase() === address.toLowerCase()) {
      setErrorNotice('A material creator cannot validate their own listing. Switch MetaMask to an independent validator account.');
      return;
    }
    setBusyHash(matHash);
    setNotice('Submitting cryptographic validation attestation with your 0.05 ETH stake…');
    setErrorNotice('');
    try {
      if (activeAuditReport?.recommendation !== 'APPROVED_FOR_MARKETPLACE') throw new Error('The audit did not approve this material for validation.');
      if (!connected) await connect();
      const signer = await getSigner();
      const transaction = await attestMaterial(signer, matHash);
      setActiveAuditReport(null);
      const followUpErrors: string[] = [];
      try {
        setStakedBalanceEth(await readValidatorStake(createRpcProvider(), transaction.validator));
      } catch (error) {
        followUpErrors.push(error instanceof Error ? error.message : 'Could not refresh the stake balance.');
      }
      try {
        await validateMarketplaceMaterial(matHash, transaction.transactionHash, activeAuditReport.overall_score);
      } catch (error) {
        followUpErrors.push(error instanceof Error ? error.message : 'Backend validation sync failed.');
      }
      try {
        await refreshData();
      } catch (error) {
        followUpErrors.push(error instanceof Error ? error.message : 'Marketplace refresh failed.');
      }
      setNotice(
        followUpErrors.length
          ? `Validation and 0.05 ETH stake are confirmed on-chain in block ${transaction.blockNumber} (tx ${transaction.transactionHash}). Backend/UI sync needs attention: ${followUpErrors.join(' ')}`
          : `Validation and 0.05 ETH stake confirmed on-chain in block ${transaction.blockNumber}.`,
      );
    } catch (err: any) {
      setErrorNotice(`Attestation failed: ${err.message}`);
    } finally {
      setBusyHash(null);
    }
  };

  const handleWithdrawStake = async () => {
    setWithdrawingStake(true);
    setErrorNotice('');
    try {
      if (!connected) await connect();
      const result = await withdrawValidatorStake(await getSigner());
      setStakedBalanceEth('0');
      setNotice(`Withdrew ${result.amount} ETH validator stake in block ${result.blockNumber}.`);
    } catch (error) {
      setErrorNotice(error instanceof Error ? error.message : 'Stake withdrawal failed.');
    } finally {
      setWithdrawingStake(false);
    }
  };

  // Filtered Listings for Buyer
  const filteredListings = useMemo(() => {
    return listings.filter((item) => {
      const matchesSearch =
        !searchQuery ||
        (item.formula && item.formula.toLowerCase().includes(searchQuery.toLowerCase())) ||
        item.material_hash.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === 'All' ||
        (item.category && item.category.toLowerCase().includes(selectedCategory.toLowerCase()));
      const matchesVerified = !filterVerifiedOnly || item.verified;
      return matchesSearch && matchesCategory && matchesVerified;
    });
  }, [listings, searchQuery, selectedCategory, filterVerifiedOnly]);

  // Seller's Own Listings — only real on-chain listings where seller matches wallet
  const sellerListings = useMemo(() => {
    if (!address) return [];
    return listings.filter((item) => item.seller.toLowerCase() === address.toLowerCase());
  }, [listings, address]);

  // Buyer's Owned Licenses
  const myPurchasedListings = useMemo(() => {
    if (!address) return [];
    return listings.filter(
      (item) =>
        item.sold &&
        item.buyer.toLowerCase() !== ZERO_ADDR.toLowerCase() &&
        item.buyer.toLowerCase() === address.toLowerCase()
    );
  }, [listings, address]);

  // Validator's Pending Queue — unverified, unsold listings
  const pendingAudits = useMemo(() => {
    return listings.filter((item) => !item.verified && !item.sold && address && item.seller.toLowerCase() !== address.toLowerCase());
  }, [listings, address]);


  return (
    <div className="space-y-8 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/[0.06] pb-6">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs uppercase tracking-widest mb-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Decentralized Intellectual Property Protocol</span>
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-white">Materials IP Marketplace</h1>
          <p className="mt-1 text-sm text-slate-400 font-light max-w-2xl">
            Decentralized licensing of verified crystal recipes via automated smart contract escrow and AES-256 encrypted IPFS storage.
          </p>
        </div>

        {/* Global Protocol Stats Pill */}
        <div className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-2 px-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Flame className="h-3.5 w-3.5 text-amber-400" />
            <span>Active Listings: <strong className="text-white">{stats?.active_listings ?? listings.length}</strong></span>
          </div>
          <span className="text-white/[0.1]">|</span>
          <div className="flex items-center gap-1.5 text-slate-300">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Verified: <strong className="text-white">{stats?.verified_materials ?? listings.filter((item) => item.verified).length}</strong></span>
          </div>
          <span className="text-white/[0.1]">|</span>
          <div className="flex items-center gap-1.5 text-slate-300">
            <Coins className="h-3.5 w-3.5 text-cyan-400" />
            <span>Vol: <strong className="text-white">{stats?.total_volume_eth ?? '0'} ETH</strong></span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {notice && (
        <div role="status" className="card border-emerald-500/30 bg-emerald-500/[0.04] p-4 text-xs font-mono text-emerald-300 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
            <div className="break-all leading-relaxed">{notice}</div>
          </div>
          <button onClick={() => setNotice('')} className="text-emerald-400/60 hover:text-emerald-300">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {errorNotice && (
        <div role="alert" className="card border-rose-500/30 bg-rose-500/[0.04] p-4 text-xs font-mono text-rose-300 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <div className="break-all leading-relaxed">{errorNotice}</div>
          </div>
          <button onClick={() => setErrorNotice('')} className="text-rose-400/60 hover:text-rose-300">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 3-Role View Switcher Tab Navigation */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-1.5 rounded-2xl bg-white/[0.02] border border-white/[0.08]">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('buyer')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-mono text-xs uppercase tracking-wider transition-all ${
              activeTab === 'buyer'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_15px_rgba(56,189,248,0.15)] font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
            }`}
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            <span>Buyer Catalog</span>
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] bg-white/[0.06] text-slate-300">
              {filteredListings.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('seller')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-mono text-xs uppercase tracking-wider transition-all ${
              activeTab === 'seller'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.15)] font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
            }`}
          >
            <Tag className="h-3.5 w-3.5" />
            <span>Seller Studio</span>
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] bg-white/[0.06] text-slate-300">
              {sellerListings.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('validator')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-mono text-xs uppercase tracking-wider transition-all ${
              activeTab === 'validator'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.15)] font-semibold'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.03]'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Validator Hub</span>
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300">
              {pendingAudits.length} Pending
            </span>
          </button>
        </div>

        {/* Current Active User Persona Badge */}
        <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-slate-400 pr-3">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>Active Role: <strong className="text-white capitalize">{activeTab} Mode</strong></span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: BUYER CATALOG VIEW                                            */}
      {/* ========================================================================= */}
      {activeTab === 'buyer' && (
        <div className="space-y-6">
          {/* Search & Category Filter Toolbar */}
          <div className="card p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search by crystal formula (e.g. Li3V2(PO4)3, BaTiO3) or hash…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs font-mono text-white placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none transition-colors"
              />
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {['All', 'Battery', 'Solar', 'Superconductor'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                    selectedCategory === cat
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-medium'
                      : 'bg-white/[0.03] text-slate-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}

              <label className="flex items-center gap-2 text-xs font-mono text-slate-300 cursor-pointer pl-2 border-l border-white/[0.08]">
                <input
                  type="checkbox"
                  checked={filterVerifiedOnly}
                  onChange={(e) => setFilterVerifiedOnly(e.target.checked)}
                  className="rounded border-white/20 bg-white/[0.05] text-cyan-500 focus:ring-0"
                />
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  Verified Only
                </span>
              </label>
            </div>
          </div>

          {/* Active Listings Grid */}
          {isLoading ? (
            <div className="col-span-3 py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
              <div className="h-8 w-8 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
              <span className="font-mono text-xs">Querying on-chain listings…</span>
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="col-span-3 py-20 flex flex-col items-center justify-center gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                <ShoppingBag className="h-7 w-7 text-slate-600" />
              </div>
              <div>
                <p className="text-slate-300 font-heading font-semibold text-base mb-1">No marketplace listings yet</p>
                <p className="text-slate-500 font-mono text-xs max-w-sm">
                  No crystal recipes have been listed for licensing yet. Switch to the{' '}
                  <button
                    onClick={() => setActiveTab('seller')}
                    className="text-amber-400 hover:text-amber-300 underline underline-offset-2"
                  >
                    Seller Studio
                  </button>{' '}
                  to list your first discovery, then come back here to browse.
                </p>
              </div>
            </div>
          ) : null}
          <div className={`grid gap-6 md:grid-cols-2 lg:grid-cols-3 ${isLoading || filteredListings.length === 0 ? 'hidden' : ''}`}>
            {filteredListings.map((item) => {
              const isOwnedByMe = Boolean(address && item.buyer.toLowerCase() === address.toLowerCase());
              const isSellerMe = Boolean(address && item.seller.toLowerCase() === address.toLowerCase());

              return (
                <div
                  key={item.material_hash}
                  className="card p-6 flex flex-col justify-between group hover:border-cyan-500/30 transition-all duration-300"
                >
                  <div>
                    {/* Header badge & status */}
                    <div className="flex items-start justify-between gap-2 border-b border-white/[0.06] pb-3 mb-4">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-heading text-xl font-bold text-white tracking-wide">
                            {item.formula}
                          </span>
                          {item.verified ? (
                            <span
                              title="Thermodynamically Verified & Peer-Staked"
                              className="flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            >
                              <ShieldCheck className="h-3 w-3" />
                              Verified
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                              Review ⏳
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 block mt-0.5">
                          {item.category || 'Solid State Candidate'}
                        </span>
                      </div>

                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-mono font-medium border ${
                          item.sold
                            ? isOwnedByMe
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                              : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                            : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/25'
                        }`}
                      >
                        {item.sold ? (isOwnedByMe ? 'Licensed to You' : 'Sold') : 'Available'}
                      </span>
                    </div>

                    {/* Scientific Properties Matrix */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-300 bg-white/[0.02] p-3 rounded-xl border border-white/[0.04] mb-4">
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase">Convex Hull</span>
                        <span className={`font-semibold ${item.e_hull && item.e_hull <= 0.05 ? 'text-emerald-300' : 'text-amber-300'}`}>
                          {item.e_hull !== undefined ? `${item.e_hull} eV/at` : 'Not provided'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase">Density</span>
                        <span className="text-white font-semibold">{item.density !== undefined ? `${item.density} g/cm³` : 'Not provided'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase">Form. Energy</span>
                        <span className="text-white">{item.predicted_formation_energy !== undefined ? `${item.predicted_formation_energy} eV` : 'Not provided'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase">Jury Consensus</span>
                        <span className="text-emerald-300">{item.consensus_spread !== undefined ? `±${item.consensus_spread} eV` : 'Not provided'}</span>
                      </div>
                    </div>

                    {/* Metadata & Creator */}
                    <div className="space-y-1.5 text-[11px] font-mono text-slate-400">
                      <div className="flex justify-between items-center py-0.5">
                        <span>License Type:</span>
                        <span className="text-slate-200 capitalize">{item.license?.replace('-', ' ')}</span>
                      </div>
                      <div className="flex justify-between items-center py-0.5">
                        <span>Seller:</span>
                        <span className="text-slate-300">
                          {isSellerMe ? 'You (Creator)' : `${item.seller.slice(0, 6)}…${item.seller.slice(-4)}`}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-0.5">
                        <span>Fingerprint:</span>
                        <span className="text-[10px] text-slate-500">{shortHash(item.material_hash)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Area */}
                  <div className="pt-5 border-t border-white/[0.04] mt-5 space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono text-slate-400">Licensing Price:</span>
                      <span className="text-lg font-bold font-heading text-amber-300">{item.price_eth} ETH</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewMaterial(item)}
                        className="btn-overworld text-xs py-2 flex items-center justify-center gap-1.5"
                        title="View Obfuscated 3D Lattice Preview"
                      >
                        <Eye className="h-3.5 w-3.5 text-cyan-400" />
                        <span>3D Preview</span>
                      </button>

                      {item.sold && isOwnedByMe ? (
                        <button
                          disabled={busyHash === item.material_hash}
                          onClick={async () => {
                            setBusyHash(item.material_hash);
                            try {
                              await downloadAuthorizedFile(
                                `/api/storage/download/${item.material_hash}`,
                                `${item.formula || 'material'}.cif`
                              );
                              setNotice(`Downloaded decrypted CIF file for ${item.formula} under your verified license.`);
                            } catch (err: any) {
                              setErrorNotice(`Download error: ${err.message}`);
                            } finally {
                              setBusyHash(null);
                            }
                          }}
                          className="button-primary marketplace-download-button text-xs py-2 flex items-center justify-center gap-1.5 border-emerald-500/30 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>{busyHash === item.material_hash ? 'Decrypting…' : 'Download CIF'}</span>
                        </button>
                      ) : (
                        <button
                          disabled={item.sold || !item.verified || isSellerMe || busyHash === item.material_hash}
                          onClick={() => purchase(item)}
                          className={`text-xs py-2 flex items-center justify-center gap-1.5 font-medium rounded-xl transition-all ${
                            item.sold || !item.verified || isSellerMe
                              ? 'bg-white/[0.04] text-slate-500 cursor-not-allowed border border-white/[0.04]'
                              : 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(56,189,248,0.15)]'
                          }`}
                        >
                          <Wallet className="h-3.5 w-3.5" />
                          <span>{item.sold ? 'Sold' : isSellerMe ? 'Your Listing' : !item.verified ? 'Awaiting Validation' : busyHash === item.material_hash ? 'Confirming…' : 'License (ETH)'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Buyer's Licensed Materials Vault */}
          {myPurchasedListings.length > 0 && (
            <div className="card p-6 border-emerald-500/30 bg-emerald-500/[0.02] mt-10">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-4 mb-4">
                <div className="flex items-center gap-2.5">
                  <Award className="h-5 w-5 text-emerald-400" />
                  <div>
                    <h2 className="font-heading text-lg font-semibold text-white">My Licensed Materials Vault</h2>
                    <p className="text-xs text-slate-400 font-mono">
                      Decrypted crystal structures owned by your connected wallet address with on-chain license verification.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  {myPurchasedListings.length} Active Licenses
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {myPurchasedListings.map((item) => (
                  <div key={item.material_hash} className="bg-white/[0.02] border border-white/[0.06] p-4 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-heading font-bold text-white text-base">{item.formula}</span>
                      <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                        <Check className="h-3 w-3" /> License Active
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-slate-400 space-y-1">
                      <div>Price Paid: <span className="text-amber-300">{item.price_eth} ETH</span></div>
                      <div>Fingerprint: <span className="text-slate-500">{shortHash(item.material_hash)}</span></div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={() => downloadAuthorizedFile(`/api/storage/download/${item.material_hash}`, `${item.formula}.cif`)}
                        className="flex-1 py-1.5 px-3 rounded-lg text-xs font-mono font-medium bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 flex items-center justify-center gap-1.5 transition"
                      >
                        <Download className="h-3 w-3" />
                        <span>Download CIF</span>
                      </button>
                      <button
                        onClick={() => setCertModalMaterial(item)}
                        className="py-1.5 px-3 rounded-lg text-xs font-mono bg-white/[0.04] text-slate-300 hover:text-white border border-white/[0.08]"
                        title="View Proof of License Certificate"
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: SELLER STUDIO VIEW                                            */}
      {/* ========================================================================= */}
      {activeTab === 'seller' && (
        <div className="space-y-8">
          {/* Seller Analytics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card p-5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block mb-1">
                Total Revenue Earned
              </span>
              <div className="flex items-baseline gap-2">
                <span className="font-heading text-2xl font-bold text-amber-300">
                  {sellerListings.filter((l) => l.sold).reduce((acc, curr) => acc + parseFloat(curr.price_eth || '0'), 0).toFixed(2)} ETH
                </span>
                <span className="text-xs text-slate-400 font-mono">≈ ${(parseFloat(sellerListings.filter((l) => l.sold).reduce((acc, curr) => acc + parseFloat(curr.price_eth || '0'), 0).toFixed(2)) * 3200).toLocaleString()} USD</span>
              </div>
            </div>

            <div className="card p-5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block mb-1">
                Active Listings
              </span>
              <span className="font-heading text-2xl font-bold text-white">
                {sellerListings.filter((l) => !l.sold).length}
              </span>
            </div>

            <div className="card p-5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block mb-1">
                Completed License Sales
              </span>
              <span className="font-heading text-2xl font-bold text-emerald-400">
                {sellerListings.filter((l) => l.sold).length}
              </span>
            </div>
          </div>

          {/* Create Listing Form */}
          <form onSubmit={createListing} className="card p-6 border-amber-500/20">
            <div className="mb-4 flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <Tag className="h-5 w-5 text-amber-400" />
                <div>
                  <h2 className="font-heading text-base font-semibold text-white">List Discovery for Licensing</h2>
                  <p className="text-xs text-slate-400 font-mono">
                    Encrypted with AES-256-GCM before pinning to IPFS. Exact atomic positions remain confidential until purchased.
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono text-amber-400/80 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                Escrow Protected
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-[1.4fr_140px_1fr_auto] items-end">
              <div>
                <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-1.5">
                  Registered Discovery / Recipe
                </label>
                <select
                  required
                  value={materialHash}
                  onChange={(event) => setMaterialHash(event.target.value)}
                  aria-label="Registered material"
                  className="w-full rounded-xl border border-white/[0.08] bg-[#0c1017] px-3.5 py-2.5 text-xs text-white font-mono focus:border-amber-400/50 focus:outline-none transition-colors"
                >
                  {/* Prefer on-chain registered materials (user already anchored on blockchain) */}
                  <option value="">Select one of your registered materials</option>
                  {materials.filter((material) => address && material.creator.toLowerCase() === address.toLowerCase()).length > 0 ? (
                    materials.filter((material) => address && material.creator.toLowerCase() === address.toLowerCase()).map((material) => {
                      const isCreator = Boolean(address && material.creator.toLowerCase() === address.toLowerCase());
                      return (
                        <option key={material.fingerprint} value={material.fingerprint} disabled={connected && !isCreator}>
                          {formulaFor(material.metadata)} · {shortHash(material.fingerprint)} · {isCreator ? '★ Yours' : 'Other Creator'}
                        </option>
                      );
                    })
                  ) : (
                    <option value="">No materials found — run a Discovery job first</option>
                  )}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-1.5">
                  Price (ETH)
                </label>
                <input
                  required
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  aria-label="Price in ETH"
                  className="w-full rounded-xl border border-white/[0.08] bg-[#0c1017] px-3.5 py-2.5 text-xs text-white font-mono focus:border-amber-400/50 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-1.5">
                  Licence Model
                </label>
                <select
                  value={license}
                  onChange={(event) => setLicense(event.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-xs text-white font-mono focus:border-amber-400/50 focus:outline-none transition-colors"
                >
                  <option value="academic-research">Academic Research License</option>
                  <option value="commercial-exclusive">Commercial Exclusive IP</option>
                  <option value="perpetual-royalty-free">Perpetual Royalty-Free</option>
                </select>
              </div>

              <div>
                <button
                  disabled={creating || !connected || !correctNetwork}
                  className="button-primary w-full disabled:opacity-50 flex items-center justify-center gap-2 border-amber-500/40 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>{creating ? 'Confirming…' : 'Publish Listing'}</span>
                </button>
              </div>
            </div>
          </form>

          {/* Seller Portfolio Table */}
          <div className="card p-6">
            <h3 className="font-heading text-base font-semibold text-white mb-4">Your Portfolio Listings</h3>
            {sellerListings.length === 0 ? (
              <div className="text-center py-8 text-xs font-mono text-slate-500">
                You haven't published any marketplace listings yet. Register a candidate from the Discovery Hub to list it here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-slate-500 uppercase text-[10px]">
                      <th className="pb-3">Formula</th>
                      <th className="pb-3">Fingerprint</th>
                      <th className="pb-3">Price</th>
                      <th className="pb-3">License Terms</th>
                      <th className="pb-3">Validation Status</th>
                      <th className="pb-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {sellerListings.map((item) => (
                      <tr key={item.material_hash} className="hover:bg-white/[0.01]">
                        <td className="py-3 font-semibold text-white">{item.formula}</td>
                        <td className="py-3 text-slate-400">{shortHash(item.material_hash)}</td>
                        <td className="py-3 text-amber-300 font-bold">{item.price_eth} ETH</td>
                        <td className="py-3 text-slate-300 capitalize">{item.license.replace('-', ' ')}</td>
                        <td className="py-3">
                          {item.verified ? (
                            <span className="text-emerald-400 flex items-center gap-1">
                              <ShieldCheck className="h-3.5 w-3.5" /> Verified
                            </span>
                          ) : (
                            <span className="text-amber-400/80 flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" /> In Review Queue
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] ${
                              item.sold ? 'bg-emerald-500/10 text-emerald-300' : 'bg-cyan-500/10 text-cyan-300'
                            }`}
                          >
                            {item.sold ? 'Sold' : 'Active'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: VALIDATOR HUB VIEW                                            */}
      {/* ========================================================================= */}
      {activeTab === 'validator' && (
        <div className="space-y-8">
          {/* Validator Staking & Economics Card */}
          <div className="card p-6 border-emerald-500/30 bg-gradient-to-r from-emerald-950/20 via-transparent to-cyan-950/20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs uppercase tracking-wider">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Proof-of-Validation Consensus Engine</span>
                </div>
                <h2 className="font-heading text-xl font-bold text-white">Validator Stake</h2>
                <p className="text-xs text-slate-400 font-mono max-w-xl">
                  MetaMask sends a 0.05 ETH stake with each approved attestation. You can withdraw your recorded stake from this panel; rewards and slashing are not configured.
                </p>
              </div>

              <div className="flex items-center gap-4 bg-white/[0.03] border border-white/[0.08] p-3.5 rounded-2xl">
                <div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Staked Deposit</span>
                  <span className="font-heading text-lg font-bold text-emerald-300">{stakedBalanceEth} ETH</span>
                </div>
                <div className="border-l border-white/[0.08] pl-4">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Reputation</span>
                  <span className="font-heading text-lg font-bold text-cyan-300">On-chain</span>
                </div>
                <div className="border-l border-white/[0.08] pl-4">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block">Dispute Window</span>
                  <span className="font-heading text-lg font-bold text-amber-300">Not configured</span>
                </div>
                {Number(stakedBalanceEth) > 0 && <button type="button" disabled={withdrawingStake} onClick={() => void handleWithdrawStake()} className="btn-overworld text-[10px] py-2 px-3 disabled:opacity-50">{withdrawingStake ? 'Withdrawing…' : 'Withdraw Stake'}</button>}
              </div>
            </div>
          </div>

          {/* Audit Queue Section */}
          <div className="card p-6">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-4 mb-4">
              <div>
                <h3 className="font-heading text-lg font-semibold text-white">Materials Awaiting Attestation</h3>
                <p className="text-xs text-slate-400 font-mono">
                  Select a candidate to screen its registered thermodynamic and density metadata.
                </p>
              </div>
              <span className="text-xs font-mono px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                {pendingAudits.length} Recipes Pending
              </span>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pendingAudits.map((item) => (
                <div
                  key={item.material_hash}
                  className="bg-white/[0.02] border border-white/[0.06] p-5 rounded-2xl flex flex-col justify-between hover:border-emerald-500/40 transition-colors"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-heading text-lg font-bold text-white">{item.formula}</span>
                      <span className="text-[10px] font-mono bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/20">
                        Pending Consensus
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-white/[0.02] p-2.5 rounded-xl border border-white/[0.04]">
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase">E_hull</span>
                        <span className="text-emerald-300">{item.e_hull ?? 'Not provided'}{item.e_hull !== undefined ? ' eV' : ''}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase">Density</span>
                        <span className="text-white">{item.density !== undefined ? `${item.density} g/cm³` : 'Not provided'}</span>
                      </div>
                    </div>

                    <div className="text-[11px] font-mono text-slate-400">
                      <span>Submitted by: </span>
                      <span className="text-slate-300">{shortHash(item.seller)}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/[0.04] mt-4">
                    <button
                      onClick={() => handleRunAudit(item.material_hash)}
                      className="w-full py-2 px-3 rounded-xl text-xs font-mono font-medium bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 flex items-center justify-center gap-2 transition"
                    >
                      <Zap className="h-3.5 w-3.5" />
                      <span>Run Metadata Audit</span>
                    </button>
                  </div>
                </div>
              ))}

              {pendingAudits.length === 0 && (
                <div className="col-span-full text-center py-10 text-xs font-mono text-slate-500">
                  {!address ? 'Connect MetaMask to view pending materials for validation.' : 'No other seller has a pending material for this wallet to validate yet.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: 3D WATERMARKED OBFUSCATED CRYSTAL PREVIEW (BUYER)               */}
      {/* ========================================================================= */}
      {previewMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="card max-w-xl w-full p-6 border-cyan-500/30 space-y-5">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-cyan-400" />
                <h3 className="font-heading text-lg font-bold text-white">
                  3D Lattice Watermarked Preview: {previewMaterial.formula}
                </h3>
              </div>
              <button onClick={() => setPreviewMaterial(null)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            {previewCif ? <CifStructurePreview cifText={previewCif} /> : <div className="relative h-56 rounded-2xl bg-gradient-to-br from-[#0a1220] to-[#040810] border border-cyan-500/20 flex items-center justify-center overflow-hidden">
              {/* Rotating Wireframe Indicator */}
              <div className="w-32 h-32 border-2 border-cyan-400/40 rounded-2xl animate-spin duration-[15000ms] flex items-center justify-center relative">
                <div className="w-20 h-20 border border-amber-400/30 rounded-full animate-ping duration-[4000ms]" />
                <div className="w-4 h-4 rounded-full bg-cyan-400 shadow-[0_0_15px_#38bdf8]" />
              </div>

              <div className="absolute bottom-3 left-3 rounded-lg border border-cyan-400/20 bg-slate-950/75 px-3 py-2 pointer-events-none">
                <span className="block font-mono text-[10px] uppercase tracking-widest text-cyan-200 font-bold">
                  Watermarked lattice preview
                </span>
                <span className="font-mono text-[9px] text-slate-300">
                  Exact atomic coordinates are delivered with the licensed CIF
                </span>
              </div>
            </div>}
            {!previewCif && previewError && <p className="text-xs text-rose-300">3D preview unavailable: {previewError}</p>}
            {!previewCif && !previewError && previewMaterial.sold && previewMaterial.buyer.toLowerCase() === address?.toLowerCase() && <p className="text-xs text-slate-400">Loading your licensed CIF structure…</p>}

            {/* Public Verified Properties Table */}
            <div className="grid grid-cols-3 gap-2 text-xs font-mono text-slate-300 bg-white/[0.02] p-3 rounded-xl border border-white/[0.04]">
              <div>
                <span className="text-slate-500 text-[9px] uppercase block">Convex Hull</span>
                <span className="text-emerald-300 font-semibold">{previewMaterial.e_hull !== undefined ? `${previewMaterial.e_hull} eV/atom` : 'Not provided'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] uppercase block">Target Density</span>
                <span className="text-white font-semibold">{previewMaterial.density !== undefined ? `${previewMaterial.density} g/cm³` : 'Not provided'}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px] uppercase block">Formation Energy</span>
                <span className="text-white">{previewMaterial.predicted_formation_energy !== undefined ? `${previewMaterial.predicted_formation_energy} eV` : 'Not provided'}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button onClick={() => setPreviewMaterial(null)} className="btn-overworld text-xs py-2 px-4">
                Close Preview
              </button>
              <button
                disabled={previewMaterial.sold || !previewMaterial.verified || previewMaterial.seller.toLowerCase() === address?.toLowerCase()}
                onClick={() => {
                  setPreviewMaterial(null);
                  purchase(previewMaterial);
                }}
                className="button-primary text-xs py-2 px-5 bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {previewMaterial.sold ? 'Already Licensed' : !previewMaterial.verified ? 'Awaiting Validation' : previewMaterial.seller.toLowerCase() === address?.toLowerCase() ? 'Your Listing' : `License Now (${previewMaterial.price_eth} ETH)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: VALIDATOR AUDIT SIMULATOR (VALIDATOR)                           */}
      {/* ========================================================================= */}
      {(auditSimulating || activeAuditReport) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="card max-w-lg w-full p-6 border-emerald-500/30 space-y-5">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-400" />
                <h3 className="font-heading text-base font-bold text-white">
                  Thermodynamic Consensus Audit
                </h3>
              </div>
              {!auditSimulating && (
                <button onClick={() => setActiveAuditReport(null)} className="text-slate-400 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {auditSimulating ? (
              <div className="py-8 space-y-4 text-center font-mono">
                <div className="w-12 h-12 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
                <div className="text-xs text-white">Running automated physics screening pipeline…</div>
                <div className="w-full bg-white/[0.05] rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-400 h-full transition-all duration-300"
                    style={{ width: `${auditProgress}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-400">
                  {auditProgress < 50 ? 'Testing convex hull energy against Materials Project database…' : 'Computing ML jury model variance & atomic packing…'}
                </div>
              </div>
            ) : activeAuditReport ? (
              <div className="space-y-4 text-xs font-mono">
                <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                  <div>
                    <span className="text-[10px] text-emerald-400/80 uppercase block">Attestation Recommendation</span>
                    <span className="font-bold text-emerald-300 text-sm">{activeAuditReport.recommendation}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase block">Quality Score</span>
                    <span className="font-heading text-lg font-bold text-white">{Math.round(activeAuditReport.overall_score * 100)}%</span>
                  </div>
                </div>

                <div className="space-y-2.5 bg-white/[0.02] p-3.5 rounded-xl border border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className={`h-4 w-4 ${activeAuditReport.e_hull_passed ? 'text-emerald-400' : 'text-rose-400'}`} />
                    <span className="text-slate-200">{activeAuditReport.e_hull_status}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className={`h-4 w-4 ${activeAuditReport.distance_passed ? 'text-emerald-400' : 'text-rose-400'}`} />
                    <span className="text-slate-200">{activeAuditReport.distance_status}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className={`h-4 w-4 ${activeAuditReport.consensus_passed ? 'text-emerald-400' : 'text-rose-400'}`} />
                    <span className="text-slate-200">{activeAuditReport.consensus_status}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button onClick={() => setActiveAuditReport(null)} className="btn-overworld text-xs py-2 px-4">
                    Cancel
                  </button>
                  <button
                    disabled={busyHash === activeAuditReport.material_hash || activeAuditReport.recommendation !== 'APPROVED_FOR_MARKETPLACE'}
                    onClick={() => handleAttest(activeAuditReport.material_hash)}
                    className="button-primary text-xs py-2 px-5 bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30 flex items-center gap-1.5"
                  >
                    <Award className="h-3.5 w-3.5" />
                    <span>{activeAuditReport.recommendation === 'APPROVED_FOR_MARKETPLACE' ? 'Approve & Stake 0.05 ETH' : 'Audit failed — cannot attest'}</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: PROOF OF LICENSE CERTIFICATE (BUYER)                            */}
      {/* ========================================================================= */}
      {certModalMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="card max-w-md w-full p-6 border-emerald-500/30 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-emerald-400" />
                <h3 className="font-heading text-base font-bold text-white">Cryptographic License Certificate</h3>
              </div>
              <button onClick={() => setCertModalMaterial(null)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-950/10 space-y-3 font-mono text-xs">
              <div className="flex justify-between border-b border-white/[0.04] pb-2">
                <span className="text-slate-400">Licensed Material:</span>
                <span className="font-bold text-white">{certModalMaterial.formula}</span>
              </div>
              <div className="flex justify-between border-b border-white/[0.04] pb-2">
                <span className="text-slate-400">Licensee (Buyer):</span>
                <span className="text-emerald-300">{shortHash(certModalMaterial.buyer || address || '')}</span>
              </div>
              <div className="flex justify-between border-b border-white/[0.04] pb-2">
                <span className="text-slate-400">Licensor (Seller):</span>
                <span className="text-slate-300">{shortHash(certModalMaterial.seller)}</span>
              </div>
              <div className="flex justify-between border-b border-white/[0.04] pb-2">
                <span className="text-slate-400">Rights Granted:</span>
                <span className="text-cyan-300 capitalize">{certModalMaterial.license?.replace('-', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Provenance Hash:</span>
                <span className="text-[10px] text-slate-500">{shortHash(certModalMaterial.material_hash)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button onClick={() => setCertModalMaterial(null)} className="btn-overworld text-xs py-2 px-4">
                Done
              </button>
              <button
                onClick={() => {
                  downloadAuthorizedFile(
                    `/api/storage/download/${certModalMaterial.material_hash}`,
                    `${certModalMaterial.formula}.cif`
                  );
                }}
                className="button-primary text-xs py-2 px-5 bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30 flex items-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download Decrypted CIF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
