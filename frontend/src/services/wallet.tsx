import { BrowserProvider, type JsonRpcSigner } from 'ethers';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { networkConfig } from './contractClient';

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on(event: 'accountsChanged' | 'chainChanged', listener: (...args: unknown[]) => void): void;
  removeListener(event: 'accountsChanged' | 'chainChanged', listener: (...args: unknown[]) => void): void;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider & {
      providers?: Eip1193Provider[];
      isMetaMask?: boolean;
    };
  }
}

export function getInjectedProvider(): Eip1193Provider | null {
  if (typeof window === 'undefined') return null;
  const anyWindow = window as any;
  if (!anyWindow.ethereum) return null;
  if (Array.isArray(anyWindow.ethereum.providers)) {
    const metaMask = anyWindow.ethereum.providers.find((p: any) => p.isMetaMask);
    if (metaMask) return metaMask;
  }
  return anyWindow.ethereum;
}

type WalletContextValue = {
  address: string | null;
  chainId: number | null;
  connected: boolean;
  correctNetwork: boolean;
  error: string;
  isMetaMaskInstalled: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  switchAccount: () => Promise<void>;
  switchNetwork: () => Promise<void>;
  disconnect: () => void;
  ensureNetwork: () => Promise<void>;
  getSigner: () => Promise<JsonRpcSigner>;
  clearError: () => void;
};

function walletErrorMessage(error: unknown, fallback: string): string {
  const anyErr = error as { code?: number; message?: string } | null;
  const code = anyErr?.code;
  if (code === 4001) return 'Connection request was cancelled in MetaMask.';
  if (code === 4100) return 'MetaMask has not authorized this account. Connect the account in MetaMask and retry.';
  if (code === 4900) return 'MetaMask is disconnected from all networks. Reconnect MetaMask and Ganache.';
  if (code === 4901) return `MetaMask is not connected to chain ${networkConfig.chainId}. Switch to ${networkConfig.chainName}.`;
  if (code === -32002) return 'A MetaMask request is already pending. Please open MetaMask to approve it.';
  if (error instanceof Error && /network|fetch|connection|timeout|rpc/i.test(error.message)) {
    return `Could not reach ${networkConfig.rpcUrl}. Confirm Ganache is running on chain ${networkConfig.chainId}.`;
  }
  return anyErr?.message || (error instanceof Error ? error.message : fallback);
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function useWalletState(): WalletContextValue | null {
  const value = useContext(WalletContext);
  if (!value) return null;
  return value;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);

  const isMetaMaskInstalled = Boolean(getInjectedProvider());

  const readChain = useCallback(async () => {
    const provider = getInjectedProvider();
    if (!provider) return;
    try {
      const raw = await provider.request({ method: 'eth_chainId' });
      const parsed = Number.parseInt(String(raw), 16);
      setChainId(Number.isFinite(parsed) ? parsed : null);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const provider = getInjectedProvider();
    if (!provider) return;

    const handleAccountsChanged = (value?: unknown) => {
      const accounts = Array.isArray(value) ? (value as string[]) : [];
      setAddress(accounts?.[0] ?? null);
      setError('');
    };

    const handleChainChanged = (value?: unknown) => {
      const parsedChain = Number.parseInt(String(value ?? ''), 16);
      setChainId(Number.isFinite(parsedChain) ? parsedChain : null);
      setError('');
    };

    void provider
      .request({ method: 'eth_accounts' })
      .then((accounts) => setAddress((accounts as string[])[0] ?? null))
      .catch(() => undefined);

    void readChain().catch(() => undefined);

    provider.on('accountsChanged', handleAccountsChanged);
    provider.on('chainChanged', handleChainChanged);

    return () => {
      provider.removeListener('accountsChanged', handleAccountsChanged);
      provider.removeListener('chainChanged', handleChainChanged);
    };
  }, [readChain]);

  const ensureNetwork = useCallback(async () => {
    const provider = getInjectedProvider();
    if (!provider) {
      throw new Error('MetaMask was not detected. Please install the MetaMask extension from metamask.io.');
    }
    const expectedHex = `0x${networkConfig.chainId.toString(16)}`;
    const current = await provider.request({ method: 'eth_chainId' });
    if (String(current).toLowerCase() === expectedHex.toLowerCase()) {
      setChainId(networkConfig.chainId);
      return;
    }

    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: expectedHex }],
      });
    } catch (switchError) {
      const code = (switchError as { code?: number }).code;
      if (code !== 4902) throw switchError;
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: expectedHex,
            chainName: networkConfig.chainName,
            rpcUrls: [networkConfig.rpcUrl],
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          },
        ],
      });
    }
    await readChain();
    const selected = await provider.request({ method: 'eth_chainId' });
    if (String(selected).toLowerCase() !== expectedHex.toLowerCase()) {
      throw new Error(`Switch MetaMask to ${networkConfig.chainName} (chain ID ${networkConfig.chainId}) to continue.`);
    }
  }, [readChain]);

  const connect = useCallback(async () => {
    try {
      setConnecting(true);
      setError('');
      const provider = getInjectedProvider();
      if (!provider) {
        const msg = 'MetaMask extension was not detected. Please install MetaMask to connect your wallet.';
        setError(msg);
        throw new Error(msg);
      }

      const accounts = (await provider.request({
        method: 'eth_requestAccounts',
      })) as string[];

      if (!accounts || !accounts.length) {
        throw new Error('MetaMask did not return any authorized account.');
      }

      setAddress(accounts[0]);
      await readChain();

      // Attempt network switch gracefully without breaking account connection
      try {
        await ensureNetwork();
      } catch (networkErr) {
        console.warn('Network switch pending or declined by user:', networkErr);
      }
    } catch (reason) {
      const message = walletErrorMessage(reason, 'Could not connect to MetaMask.');
      setError(message);
      throw reason;
    } finally {
      setConnecting(false);
    }
  }, [ensureNetwork, readChain]);

  const switchAccount = useCallback(async () => {
    try {
      setConnecting(true);
      setError('');
      const provider = getInjectedProvider();
      if (!provider) throw new Error('MetaMask was not detected.');

      // Re-requesting eth_accounts permission makes MetaMask show its account
      // picker when the site is currently authorized for a different account.
      await provider.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }],
      });
      const accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
      if (!accounts?.length) throw new Error('No MetaMask account was authorized for this site.');

      setAddress(accounts[0]);
      await readChain();
    } catch (reason) {
      const message = walletErrorMessage(reason, 'Could not switch MetaMask account.');
      setError(message);
      throw reason;
    } finally {
      setConnecting(false);
    }
  }, [readChain]);

  const switchNetwork = useCallback(async () => {
    try {
      setError('');
      await ensureNetwork();
    } catch (reason) {
      const message = walletErrorMessage(reason, 'Could not switch MetaMask to the local network.');
      setError(message);
      throw new Error(message);
    }
  }, [ensureNetwork]);

  const getSigner = useCallback(async () => {
    const provider = getInjectedProvider();
    if (!provider) throw new Error('MetaMask was not detected.');
    try {
      await ensureNetwork();
      const browserProvider = new BrowserProvider(provider as never, 'any');
      return await browserProvider.getSigner();
    } catch (reason) {
      const message = walletErrorMessage(reason, 'Could not access a MetaMask signer.');
      setError(message);
      throw new Error(message);
    }
  }, [ensureNetwork]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setError('');
  }, []);

  const clearError = useCallback(() => {
    setError('');
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({
      address,
      chainId,
      connected: Boolean(address),
      correctNetwork: chainId === networkConfig.chainId,
      error,
      isMetaMaskInstalled,
      connecting,
      connect,
      switchAccount,
      switchNetwork,
      disconnect,
      ensureNetwork,
      getSigner,
      clearError,
    }),
    [
      address,
      chainId,
      error,
      isMetaMaskInstalled,
      connecting,
      connect,
      switchAccount,
      switchNetwork,
      disconnect,
      ensureNetwork,
      getSigner,
      clearError,
    ]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const value = useWalletState();
  if (!value) throw new Error('useWallet must be used inside WalletProvider.');
  return value;
}
