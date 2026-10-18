let activeWalletAddress: string | null = null;
let activeAuthToken: string | null = null;

export function setApiAuth(walletAddress: string | null, token: string | null = null) {
  activeWalletAddress = walletAddress;
  activeAuthToken = token;
}

export function getApiHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...customHeaders };
  if (activeAuthToken) {
    headers['Authorization'] = `Bearer ${activeAuthToken}`;
  } else if (activeWalletAddress) {
    headers['X-Wallet-Address'] = activeWalletAddress;
    headers['Authorization'] = `Bearer ${activeWalletAddress}`;
  }
  return headers;
}

export async function fetchJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const finalHeaders = getApiHeaders(headers);
  const res = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}${url}`, {
    headers: finalHeaders,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function postJson<T>(url: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  const finalHeaders = getApiHeaders({ 'Content-Type': 'application/json', ...headers });
  const res = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}${url}`, {
    method: 'POST',
    headers: finalHeaders,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function uploadFile<T>(url: string, file: File, extraHeaders: Record<string, string> = {}): Promise<T> {
  const formData = new FormData();
  formData.append('file', file);
  const finalHeaders = getApiHeaders(extraHeaders);
  const res = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}${url}`, {
    method: 'POST',
    headers: finalHeaders,
    body: formData,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `Upload failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function downloadAuthorizedFile(url: string, fallbackFilename: string = 'material.cif'): Promise<void> {
  const finalHeaders = getApiHeaders();
  const res = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}${url}`, {
    headers: finalHeaders,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? `Download failed: ${res.status}`);
  }

  // Extract filename from Content-Disposition if present
  let filename = fallbackFilename;
  const disposition = res.headers.get('content-disposition');
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  const blob = await res.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(downloadUrl);
}

export async function fetchAuthorizedCif(materialHash: string): Promise<string> {
  const result = await fetchJson<{ raw_text?: string }>(`/api/storage/content/${encodeURIComponent(materialHash)}`);
  if (!result.raw_text || !result.raw_text.toLowerCase().includes('_atom_site_fract_x')) {
    throw new Error('The licensed material record does not contain a readable CIF structure.');
  }
  return result.raw_text;
}

export interface AuditReport {
  material_hash: string;
  formula: string;
  density: number;
  e_hull: number;
  predicted_formation_energy: number;
  consensus_spread: number;
  e_hull_passed: boolean;
  e_hull_status: string;
  distance_passed: boolean;
  distance_status: string;
  consensus_passed: boolean;
  consensus_status: string;
  overall_score: number;
  tier: string;
  recommendation: string;
  timestamp: number;
}

export interface MarketplaceStats {
  active_listings: number;
  completed_licenses: number;
  total_volume_eth: number;
  verified_materials: number;
  staked_validators_active: number;
  validator_pool_rewards_eth: number;
  dispute_window_hours: number;
}

export async function auditMarketplaceMaterial(materialHash: string): Promise<AuditReport> {
  return postJson<AuditReport>('/api/marketplace/audit', { material_hash: materialHash });
}

export async function validateMarketplaceMaterial(
  materialHash: string,
  transactionHash: string,
  score: number = 0.95
): Promise<{ status: string; validation: any; onchain_verified: boolean; validator_reward_earned_eth: number }> {
  return postJson('/api/marketplace/validate', {
    material_hash: materialHash,
    transaction_hash: transactionHash,
    score,
  });
}

export async function fetchMarketplaceStats(): Promise<MarketplaceStats> {
  return fetchJson<MarketplaceStats>('/api/marketplace/stats');
}

export async function fetchMarketplaceListings(): Promise<any[]> {
  return fetchJson<any[]>('/api/marketplace/listings');
}

export interface BackendMaterial {
  id: string;
  material_hash: string;
  job_id: string;
  formula: string;
  density: number;
  e_hull: number;
  predicted_formation_energy: number;
  consensus_spread: number;
  status: string;
  composition?: Record<string, number>;
}

export async function fetchBackendMaterials(): Promise<BackendMaterial[]> {
  return fetchJson<BackendMaterial[]>('/api/materials');
}
