import { useEffect, useState } from 'react';
import { ShoppingBag, Tag, ShieldCheck, CheckCircle2, AlertTriangle, ArrowRight, Wallet, UserCheck } from 'lucide-react';
import { createListing as sendListing, createRpcProvider, marketplaceConfigured, purchaseListing as sendPurchase, readMarketplace, readRegistry, shortHash } from '../services/contractClient';
import { useWallet } from '../services/wallet';
import { downloadAuthorizedFile } from '../lib/api';

type Listing = { material_hash: string; price_eth: string; license: string; sold: boolean; seller: string; buyer: string };
type RegisteredMaterial = { fingerprint: string; metadata: string; block_number: number; creator: string };

export default function MarketplacePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [materials, setMaterials] = useState<RegisteredMaterial[]>([]);
  const [notice, setNotice] = useState('');
  const [busyHash, setBusyHash] = useState<string | null>(null);
  const [materialHash, setMaterialHash] = useState('');
  const [price, setPrice] = useState('0.1');
  const [license, setLicense] = useState('research-use');
  const [creating, setCreating] = useState(false);
  const { connected, correctNetwork, connect, getSigner, address } = useWallet();

  const refresh = async () => {
    const provider = createRpcProvider();
    const [currentListings, registeredMaterials] = await Promise.all([readMarketplace(provider), readRegistry(provider)]);
    setListings(currentListings);
    setMaterials(registeredMaterials);
    if (!materialHash && registeredMaterials.length) setMaterialHash(registeredMaterials[0].fingerprint);
  };
  useEffect(() => { refresh().catch((error: Error) => setNotice(error.message)); }, [address, correctNetwork]);

  const purchase = async (materialHash: string) => {
    setBusyHash(materialHash);
    setNotice('Confirm the purchase transaction in MetaMask…');
    try {
      if (!connected) await connect();
      const signer = await getSigner();
      const result = await sendPurchase(signer, materialHash);
      await refresh();
      setNotice(`Purchase confirmed in block ${result.blockNumber}; transaction ${result.transactionHash}; recipient ${result.buyer}; seller ${result.seller}. Single-sale licence recorded on-chain.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Purchase failed or was rejected.');
    } finally {
      setBusyHash(null);
    }
  };

  const createListing = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setNotice('Confirm listing creation in MetaMask…');
    try {
      if (!connected) await connect();
      const signer = await getSigner();
      const selectedMaterial = materials.find((material) => material.fingerprint === materialHash);
      if (!selectedMaterial || selectedMaterial.creator.toLowerCase() !== (await signer.getAddress()).toLowerCase()) {
        throw new Error('Only the wallet recorded as the registered material creator may create this listing. Switch to the creator account.');
      }
      const result = await sendListing(signer, { materialHash, priceEth: price, license });
      setMaterialHash('');
      await refresh();
      setNotice(`Listing confirmed in block ${result.blockNumber}; transaction ${result.transactionHash}; seller ${result.seller}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not create listing.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-white">Materials IP Marketplace</h1>
        <p className="mt-1 text-sm text-slate-400 font-light">
          Decentralized licensing of verified crystal structures via automated smart contract escrow.
        </p>
      </div>

      {!correctNetwork && (
        <div className="card border-amber-500/30 bg-amber-500/[0.04] p-4 text-xs font-mono text-amber-300 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
          <span>Connect MetaMask and switch to local chain 1337 to interact with marketplace listings.</span>
        </div>
      )}

      {notice && (
        <div role="status" className="card border-amber-500/30 bg-amber-500/[0.04] p-4 text-xs font-mono text-amber-200 flex items-start gap-2.5">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
          <div className="break-all">{notice}</div>
        </div>
      )}

      {/* Create Listing Form */}
      <form onSubmit={createListing} className="card p-6">
        <div className="mb-4 flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-amber-300" />
            <h2 className="font-heading text-base font-semibold text-white">List Discovery for Licensing</h2>
          </div>
          <span className="text-xs font-mono text-slate-500">Creator Escrow</span>
        </div>

        <div className="grid gap-4 md:grid-cols-[1.2fr_140px_1fr_auto] items-end">
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-1.5">
              Registered Material
            </label>
            <select
              required
              value={materialHash}
              onChange={(event) => setMaterialHash(event.target.value)}
              aria-label="Registered material"
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-xs text-white font-mono focus:border-amber-400/50 focus:outline-none transition-colors"
            >
              {!materials.length && <option value="">No registered materials on this contract</option>}
              {materials.map((material) => {
                const isCreator = Boolean(address && material.creator.toLowerCase() === address.toLowerCase());
                return (
                  <option key={material.fingerprint} value={material.fingerprint} disabled={connected && !isCreator}>
                    {formulaFor(material.metadata)} · {shortHash(material.fingerprint)} · {isCreator ? 'Your Material' : `Creator ${material.creator.slice(0, 6)}…`}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-1.5">
              Price (ETH)
            </label>
            <input
              required
              type="number"
              min="0.000000000000000001"
              step="any"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              aria-label="Price in ETH"
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-xs text-white font-mono focus:border-amber-400/50 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-1.5">
              Licence Terms
            </label>
            <input
              required
              value={license}
              onChange={(event) => setLicense(event.target.value)}
              aria-label="License terms"
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-xs text-white font-mono focus:border-amber-400/50 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <button
              disabled={
                creating ||
                !marketplaceConfigured ||
                !connected ||
                !correctNetwork ||
                !materials.some(
                  (material) =>
                    material.fingerprint === materialHash &&
                    material.creator.toLowerCase() === address?.toLowerCase()
                )
              }
              className="button-primary w-full disabled:opacity-50"
            >
              {creating ? 'Confirming…' : 'Publish Listing'}
            </button>
          </div>
        </div>
      </form>

      {/* Active Listings Grid */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {listings.map((item) => (
          <div key={item.material_hash} className="card p-6 flex flex-col justify-between group">
            <div>
              <div className="mb-3 flex items-center justify-between border-b border-white/[0.06] pb-3">
                <span className="font-heading text-lg font-bold text-white">Single-Sale License</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-mono font-medium border ${
                    item.sold
                      ? 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                      : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                  }`}
                >
                  {item.sold
                    ? item.buyer.toLowerCase() === address?.toLowerCase()
                      ? 'Owned by You'
                      : 'Sold'
                    : item.seller.toLowerCase() === address?.toLowerCase()
                    ? 'Your Listing'
                    : 'Available'}
                </span>
              </div>

              <div className="space-y-2.5 text-xs font-mono text-slate-300">
                <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                  <span className="text-slate-400">License Price:</span>
                  <span className="text-base font-bold text-amber-300 font-heading">{item.price_eth} ETH</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                  <span className="text-slate-400">Terms:</span>
                  <span className="text-slate-200">{item.license}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                  <span className="text-slate-400">Seller:</span>
                  <span className="text-slate-400">{item.seller.slice(0, 6)}…{item.seller.slice(-4)}</span>
                </div>
                {item.sold && (
                  <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                    <span className="text-slate-400">Purchaser:</span>
                    <span className="text-emerald-300">{item.buyer.slice(0, 6)}…{item.buyer.slice(-4)}</span>
                  </div>
                )}
                <div className="pt-2">
                  <span className="text-[10px] text-slate-500 uppercase block">Fingerprint:</span>
                  <span className="break-all text-[11px] text-slate-400 font-mono">{item.material_hash}</span>
                </div>
              </div>
            </div>

            {item.sold && item.buyer.toLowerCase() === address?.toLowerCase() ? (
              <button
                disabled={busyHash === item.material_hash}
                onClick={async () => {
                  setBusyHash(item.material_hash);
                  try {
                    await downloadAuthorizedFile(`/api/storage/download/${item.material_hash}`, `material_${item.material_hash.slice(2, 10)}.cif`);
                    setNotice(`Material file decrypted and downloaded successfully under your verified license.`);
                  } catch (err: any) {
                    setNotice(`Download failed: ${err.message}`);
                  } finally {
                    setBusyHash(null);
                  }
                }}
                className="mt-6 w-full button-primary flex items-center justify-center gap-2 border-emerald-500/30 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>{busyHash === item.material_hash ? 'Decrypting File…' : 'Authorized Download (License Verified)'}</span>
              </button>
            ) : (
              <button
                disabled={item.sold || busyHash === item.material_hash || !marketplaceConfigured}
                onClick={() => purchase(item.material_hash)}
                className={`mt-6 w-full ${item.sold ? 'button-secondary opacity-60 cursor-default' : 'button-accent'} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {item.sold ? 'License Executed' : busyHash === item.material_hash ? 'Confirming in Wallet…' : 'Acquire License with MetaMask'}
              </button>
            )}
          </div>
        ))}

        {!listings.length && (
          <div className="card p-8 text-center text-xs font-mono text-slate-400 col-span-full">
            No active listings found on the marketplace smart contract. Register a material candidate above to offer licensing rights.
          </div>
        )}
      </div>
    </div>
  );
}

function formulaFor(metadata: string) {
  try {
    const parsed = JSON.parse(metadata) as { formula?: string };
    return parsed.formula ?? 'Registered Material';
  } catch {
    return 'Registered Material';
  }
}
