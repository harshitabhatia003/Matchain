import {
  Contract,
  formatEther,
  getAddress,
  Interface,
  isAddress,
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
import { verifyTransaction, type VerificationResult } from './transactionService';

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
  const trimmedAddress = (address || '').trim();
  if (!trimmedAddress || !isAddress(trimmedAddress)) {
    throw new Error(`Invalid ${name} address: "${address}". Check your VITE_CONTRACT_${name.toUpperCase()}_ADDRESS in .env.local`);
  }
  
  const checksumAddress = getAddress(trimmedAddress);
  const network = await provider.getNetwork();
  
  if (network.chainId !== BigInt(networkConfig.chainId)) {
    throw new Error(`Connected to chain ${network.chainId}, expected ${networkConfig.chainId}. Check MetaMask network settings.`);
  }
  
  const code = await provider.getCode(checksumAddress);
  if (code === '0x' || code === '0x0' || code.length <= 2) {
    // Before failing, check if the provider is actually reachable and returns something for block number
    const block = await provider.getBlockNumber().catch(() => -1);
    throw new Error(
      `No ${name} bytecode at ${checksumAddress} (chain ${network.chainId}, block ${block}). ` +
      `Ganache may have been reset or addresses are stale. Redeploy contracts and update .env.local.`
    );
  }
}

export async function registerMaterial(signer: Signer, input: { fingerprint: string; storageReference: string; metadata: string }) {
  if (!registryConfigured) throw new Error('Registry contract address is not configured. Deploy locally and restart Vite.');
  const provider = signer.provider;
  if (!provider) throw new Error('Signer has no provider.');
  
  await assertContract(provider, networkConfig.registryAddress, 'registry');
  
  const contract = new Contract(networkConfig.registryAddress, registryAbi, signer);
  const fingerprint = fingerprintOf(input.fingerprint);
  
  const tx = await contract.registerDiscovery(fingerprint, input.storageReference, input.metadata);
  
  const result = await verifyTransaction(tx, {
    contractAddress: networkConfig.registryAddress,
    abi: registryAbi,
    eventName: 'DiscoveryRegistered',
    validateArgs: (args) => String(args.fingerprint).toLowerCase() === fingerprint.toLowerCase(),
    checkState: async (c) => {
      const record = await c.discoveries(fingerprint);
      return record.creator !== '0x0000000000000000000000000000000000000000';
    }
  }, provider);

  if (!result.success) {
    throw new Error(result.error || `Transaction ${tx.hash} mined, but verification failed.`);
  }

  const creator = await signer.getAddress();
  return { 
    transactionHash: tx.hash as string, 
    blockNumber: result.blockNumber, 
    creator, 
    fingerprint, 
    event: result.event 
  };
}

export async function createListing(signer: Signer, input: { materialHash: string; priceEth: string; license: string }) {
  if (!marketplaceConfigured) throw new Error('Marketplace contract address is not configured. Deploy locally and restart Vite.');
  const provider = signer.provider;
  if (!provider) throw new Error('Signer has no provider.');

  await assertContract(provider, networkConfig.marketplaceAddress, 'marketplace');
  
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
  
  const result = await verifyTransaction(tx, {
    contractAddress: networkConfig.marketplaceAddress,
    abi: marketplaceAbi,
    eventName: 'ListingCreated',
    validateArgs: (args) => String(args.materialHash).toLowerCase() === materialHash.toLowerCase(),
    checkState: async (c) => {
      const listing = await c.listings(materialHash);
      return listing.seller !== '0x0000000000000000000000000000000000000000' && !listing.sold;
    }
  }, provider);

  if (!result.success) {
    throw new Error(result.error || `Transaction ${tx.hash} mined, but verification failed.`);
  }

  const seller = await signer.getAddress();
  return { 
    transactionHash: tx.hash as string, 
    blockNumber: result.blockNumber, 
    seller, 
    event: result.event 
  };
}

export async function purchaseListing(signer: Signer, materialHash: string) {
  if (!marketplaceConfigured) throw new Error('Marketplace contract address is not configured. Deploy locally and restart Vite.');
  const provider = signer.provider;
  if (!provider) throw new Error('Signer has no provider.');

  await assertContract(provider, networkConfig.marketplaceAddress, 'marketplace');
  
  const contract = new Contract(networkConfig.marketplaceAddress, marketplaceAbi, signer);
  const digest = fingerprintOf(materialHash);
  
  const listing = await contract.listings(digest);
  if (!listing.seller || listing.seller === '0x0000000000000000000000000000000000000000') throw new Error('Listing not found on chain.');
  if (listing.sold) throw new Error('This listing has already been purchased.');
  
  const tx = await contract.purchaseMaterial(digest, { value: listing.price });
  
  const result = await verifyTransaction(tx, {
    contractAddress: networkConfig.marketplaceAddress,
    abi: marketplaceAbi,
    eventName: 'ListingPurchased',
    validateArgs: (args) => String(args.materialHash).toLowerCase() === digest.toLowerCase(),
    checkState: async (c) => {
      const updatedListing = await c.listings(digest);
      return updatedListing.sold;
    }
  }, provider);

  if (!result.success) {
    throw new Error(result.error || `Transaction ${tx.hash} mined, but verification failed.`);
  }

  const buyer = await signer.getAddress();
  const finalListing = await contract.listings(digest);
  
  return { 
    transactionHash: tx.hash as string, 
    blockNumber: result.blockNumber, 
    buyer, 
    seller: finalListing.seller as string, 
    license: finalListing.licenseTerms as string, 
    event: result.event 
  };
}

export function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}
