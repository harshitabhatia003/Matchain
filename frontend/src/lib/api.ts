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
