import {
  Contract,
  formatEther,
  Interface,
  JsonRpcProvider,
  isHexString,
  keccak256,
  parseEther,
  toUtf8Bytes,
  type InterfaceAbi,
  type Provider,
  type Signer,
  type TransactionReceipt,
} from 'ethers';
import registryAbiJson from '../contracts/registryAbi.json';
import marketplaceAbiJson from '../contracts/marketplaceAbi.json';

const registryAbi = registryAbiJson as InterfaceAbi;
const marketplaceAbi = marketplaceAbiJson as InterfaceAbi;

export const networkConfig = {
  chainId: Number(import.meta.env.VITE_CHAIN_ID || 1337),
  rpcUrl: import.meta.env.VITE_GANACHE_RPC_URL || 'http://127.0.0.1:8545',
  chainName: import.meta.env.VITE_CHAIN_NAME || 'Ganache Local',
  registryAddress: import.meta.env.VITE_CONTRACT_REGISTRY_ADDRESS || '',
  marketplaceAddress: import.meta.env.VITE_CONTRACT_MARKETPLACE_ADDRESS || '',
};

export const registryConfigured = Boolean(networkConfig.registryAddress);
export const marketplaceConfigured = Boolean(networkConfig.marketplaceAddress);
export const walletConfigured = registryConfigured && marketplaceConfigured;

export function fingerprintOf(value: string): string {
  return isHexString(value, 32) ? value : keccak256(toUtf8Bytes(value));
}

export function createRpcProvider(): JsonRpcProvider {
  return new JsonRpcProvider(networkConfig.rpcUrl, networkConfig.chainId);
}

export async function readRegistry(provider: Provider) {
  if (!registryConfigured) throw new Error('Registry contract address is not configured. Deploy contracts and restart Vite.');
  await assertContract(provider, networkConfig.registryAddress, 'registry');
  const contract = new Contract(networkConfig.registryAddress, registryAbi, provider);
  const count = Number(await contract.getDiscoveryCount());
  const rows = [];
  for (let index = 0; index < count; index += 1) {
    const fingerprint = await contract.discoveryHashes(index);
    const record = await contract.discoveries(fingerprint);
    rows.push({
      fingerprint,
      creator: record.creator as string,
      block_number: Number(record.blockNumber),
      ipfs_cid: record.ipfsCid as string,
      metadata: record.metadata as string,
      verified: record.verified as boolean,
    });
  }
  return rows;
}

export async function readMarketplace(provider: Provider) {
  if (!marketplaceConfigured) throw new Error('Marketplace contract address is not configured. Deploy contracts and restart Vite.');
  await assertContract(provider, networkConfig.marketplaceAddress, 'marketplace');
  const contract = new Contract(networkConfig.marketplaceAddress, marketplaceAbi, provider);
  const registryAddress = await contract.registry() as string;
  if (registryAddress.toLowerCase() !== networkConfig.registryAddress.toLowerCase()) {
    throw new Error('Marketplace is linked to a different registry address than the configured deployment. Redeploy the contracts.');
  }
  const count = Number(await contract.getListingCount());
  const rows = [];
  for (let index = 0; index < count; index += 1) {
    const materialHash = await contract.listingHashes(index);
    const record = await contract.listings(materialHash);
    rows.push({
      material_hash: materialHash as string,
      seller: record.seller as string,
      price_eth: formatEther(record.price),
      price_wei: record.price.toString() as string,
      license: record.licenseTerms as string,
      sold: record.sold as boolean,
      buyer: record.buyer as string,
    });
  }
  return rows;
}

async function assertContract(provider: Provider, address: string, name: string) {
  const network = await provider.getNetwork();
  if (network.chainId !== BigInt(networkConfig.chainId)) {
    throw new Error(`Connected to chain ${network.chainId}, expected ${networkConfig.chainId}.`);
  }
  const code = await provider.getCode(address);
  if (code === '0x') {
    throw new Error(`No ${name} bytecode at ${address} on chain ${networkConfig.chainId}; Ganache may have been reset or addresses are stale. Redeploy contracts.`);
  }
}

function eventFrom(receipt: TransactionReceipt, abi: InterfaceAbi, eventName: string) {
  const contractInterface = new Interface(abi);
  for (const log of receipt.logs) {
    try {
      const parsed = contractInterface.parseLog(log);
      if (parsed?.name === eventName) {
        return {
          name: parsed.name,
          args: Object.fromEntries(parsed.fragment.inputs.map((input, index) => [input.name, String(parsed.args[index])])),
        };
      }
    } catch {
      // Receipt may also contain logs emitted by other contracts.
    }
  }
  return null;
}

async function waitForSuccess(tx: { hash: string; wait: () => Promise<TransactionReceipt | null> }) {
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error(`Transaction ${tx.hash} failed on chain.`);
  return receipt;
}

export async function registerMaterial(signer: Signer, input: { fingerprint: string; storageReference: string; metadata: string }) {
  if (!registryConfigured) throw new Error('Registry contract address is not configured. Deploy locally and restart Vite.');
  const contract = new Contract(networkConfig.registryAddress, registryAbi, signer);
  const fingerprint = fingerprintOf(input.fingerprint);
  const tx = await contract.registerDiscovery(fingerprint, input.storageReference, input.metadata);
  const receipt = await waitForSuccess(tx);
  const event = eventFrom(receipt, registryAbi, 'DiscoveryRegistered');
  if (!event || event.args.fingerprint?.toLowerCase() !== fingerprint.toLowerCase()) {
    throw new Error(`Transaction ${tx.hash} mined, but the expected registration event was missing.`);
  }
  const registered = await contract.discoveries(fingerprint);
  const creator = await signer.getAddress();
  if (registered.creator.toLowerCase() !== creator.toLowerCase() || Number(registered.blockNumber) !== receipt.blockNumber) {
    throw new Error(`Transaction ${tx.hash} mined, but the registry record did not match the receipt.`);
  }
  return { transactionHash: tx.hash as string, blockNumber: receipt.blockNumber, creator, fingerprint, event };
}

export async function createListing(signer: Signer, input: { materialHash: string; priceEth: string; license: string }) {
  if (!marketplaceConfigured) throw new Error('Marketplace contract address is not configured. Deploy locally and restart Vite.');
  const contract = new Contract(networkConfig.marketplaceAddress, marketplaceAbi, signer);
  const materialHash = fingerprintOf(input.materialHash);
  const price = parseEther(input.priceEth);
  const registeredAddress = await contract.registry() as string;
  if (registeredAddress.toLowerCase() !== networkConfig.registryAddress.toLowerCase()) {
    throw new Error('Marketplace is linked to a different registry address than the configured deployment. Redeploy the contracts.');
  }
  const registry = new Contract(registeredAddress, registryAbi, signer);
  const registeredMaterial = await registry.discoveries(materialHash);
  if (!registeredMaterial.creator || registeredMaterial.creator === '0x0000000000000000000000000000000000000000') {
    throw new Error('Register this generated material on the registry contract before creating a marketplace listing.');
  }
  const tx = await contract.listMaterial(materialHash, price, input.license);
  const receipt = await waitForSuccess(tx);
  const event = eventFrom(receipt, marketplaceAbi, 'ListingCreated');
  if (!event || event.args.materialHash?.toLowerCase() !== materialHash.toLowerCase()) {
    throw new Error(`Transaction ${tx.hash} mined, but the expected listing event was missing.`);
  }
  const listing = await contract.listings(materialHash);
  const seller = await signer.getAddress();
  if (listing.seller.toLowerCase() !== seller.toLowerCase() || listing.price !== price || listing.licenseTerms !== input.license || listing.sold) {
    throw new Error(`Transaction ${tx.hash} mined, but the stored listing did not match the receipt.`);
  }
  return { transactionHash: tx.hash as string, blockNumber: receipt.blockNumber, seller, event };
}

export async function purchaseListing(signer: Signer, materialHash: string) {
  if (!marketplaceConfigured) throw new Error('Marketplace contract address is not configured. Deploy locally and restart Vite.');
  const contract = new Contract(networkConfig.marketplaceAddress, marketplaceAbi, signer);
  const digest = fingerprintOf(materialHash);
  const listing = await contract.listings(digest);
  if (!listing.seller || listing.seller === '0x0000000000000000000000000000000000000000') throw new Error('Listing not found on chain.');
  if (listing.sold) throw new Error('This listing has already been purchased.');
  const tx = await contract.purchaseMaterial(digest, { value: listing.price });
  const receipt = await waitForSuccess(tx);
  const event = eventFrom(receipt, marketplaceAbi, 'ListingPurchased');
  const buyer = await signer.getAddress();
  if (!event || event.args.materialHash?.toLowerCase() !== digest.toLowerCase() || event.args.buyer?.toLowerCase() !== buyer.toLowerCase()) {
    throw new Error(`Transaction ${tx.hash} mined, but the expected purchase event was missing or did not match this wallet.`);
  }
  const updatedListing = await contract.listings(digest);
  if (!updatedListing.sold || updatedListing.buyer.toLowerCase() !== buyer.toLowerCase()) {
    throw new Error(`Transaction ${tx.hash} mined, but the marketplace does not show this buyer's completed single-sale licence.`);
  }
  return { transactionHash: tx.hash as string, blockNumber: receipt.blockNumber, buyer, seller: updatedListing.seller as string, license: updatedListing.licenseTerms as string, event };
}

export function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}
