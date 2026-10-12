import { lazy, Suspense } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { Activity, BarChart3, Blocks, FlaskConical, Home, ShoppingCart, Sparkles, Wallet, Wrench } from 'lucide-react';
import { networkConfig, walletConfigured } from './services/contractClient';
import { useWalletState } from './services/wallet';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const DiscoveryPage = lazy(() => import('./pages/DiscoveryPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const MarketplacePage = lazy(() => import('./pages/MarketplacePage'));
const RegistryPage = lazy(() => import('./pages/RegistryPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/dashboard', label: 'Dashboard', icon: Activity },
  { to: '/discovery', label: 'Discovery', icon: FlaskConical },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/marketplace', label: 'Marketplace', icon: ShoppingCart },
  { to: '/registry', label: 'Registry', icon: Blocks },
  { to: '/settings', label: 'Settings', icon: Wrench },
];

export default function App() {
  const wallet = useWalletState();
  const address = wallet?.address ?? null;
  const chainId = wallet?.chainId ?? null;
  const connected = wallet?.connected ?? false;
  const correctNetwork = wallet?.correctNetwork ?? false;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col lg:flex-row">
        <aside className="border-b border-slate-800 bg-slate-950/95 p-5 lg:w-72 lg:border-b-0 lg:border-r">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-semibold">MatChain</div>
              <div className="text-xs text-slate-400">Materials Intelligence</div>
            </div>
          </div>

          <nav className="flex flex-col gap-2">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={label}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                    isActive ? 'bg-indigo-500/15 text-indigo-200 ring-1 ring-indigo-500/40' : 'text-slate-300 hover:bg-slate-800'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className={`mt-8 rounded-2xl border p-4 ${correctNetwork ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-amber-500/40 bg-amber-500/10'}`}>
            <div className={`flex items-center gap-2 text-sm font-medium ${correctNetwork ? 'text-emerald-200' : 'text-amber-200'}`}>
              <Wallet className="h-4 w-4" />
              {correctNetwork ? networkConfig.chainName : `Target chain ${networkConfig.chainId}`}
            </div>
            <p className="mt-2 text-xs text-slate-300">
              {walletConfigured ? 'Transactions require MetaMask and a confirmed local chain.' : 'Deploy the contracts, configure frontend addresses, then restart Vite.'}
            </p>
          </div>
        </aside>

        <main className="flex-1 p-4 md:p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-400">
              {connected ? <>{address?.slice(0, 8)}…{address?.slice(-6)} · chain {chainId}{!correctNetwork && ' · wrong network'}</> : 'Wallet not connected'}
            </div>
            <button className="button-secondary flex items-center gap-2" onClick={() => {
              if (!connected) void wallet?.connect().catch(() => undefined);
              else if (!correctNetwork) void wallet?.switchNetwork().catch(() => undefined);
              else wallet?.disconnect();
            }}>
              <Wallet className="h-4 w-4" />
              {!connected ? 'Connect MetaMask' : !correctNetwork ? 'Switch to Ganache' : 'Disconnect app'}
            </button>
          </div>
          {wallet?.error && <p role="alert" className="mb-4 text-sm text-rose-300">{wallet.error}</p>}
          <Routes>
            <Route path="/" element={<Suspense fallback={<div className="card p-6 text-slate-300">Loading page…</div>}><LandingPage /></Suspense>} />
            <Route path="/dashboard" element={<Suspense fallback={<div className="card p-6 text-slate-300">Loading page…</div>}><DashboardPage /></Suspense>} />
            <Route path="/discovery" element={<Suspense fallback={<div className="card p-6 text-slate-300">Loading page…</div>}><DiscoveryPage /></Suspense>} />
            <Route path="/analytics" element={<Suspense fallback={<div className="card p-6 text-slate-300">Loading page…</div>}><AnalyticsPage /></Suspense>} />
            <Route path="/marketplace" element={<Suspense fallback={<div className="card p-6 text-slate-300">Loading page…</div>}><MarketplacePage /></Suspense>} />
            <Route path="/registry" element={<Suspense fallback={<div className="card p-6 text-slate-300">Loading page…</div>}><RegistryPage /></Suspense>} />
            <Route path="/settings" element={<Suspense fallback={<div className="card p-6 text-slate-300">Loading page…</div>}><SettingsPage /></Suspense>} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
