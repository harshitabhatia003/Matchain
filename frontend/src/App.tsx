import { lazy, Suspense, useState, useEffect } from 'react';
import { NavLink, Route, Routes, Link, useLocation } from 'react-router-dom';
import {
  Wallet,
  Edit3,
  Menu,
  X,
  AlertTriangle,
  ExternalLink,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { useWalletState } from './services/wallet';
import { useAuth } from './context/AuthContext';
import { setApiAuth } from './lib/api';
import ProtectedRoute from './components/ProtectedRoute';
import EditProfileModal from './components/EditProfileModal';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const DiscoveryPage = lazy(() => import('./pages/DiscoveryPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const MarketplacePage = lazy(() => import('./pages/MarketplacePage'));
const RegistryPage = lazy(() => import('./pages/RegistryPage'));
const StoragePage = lazy(() => import('./pages/StoragePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));

// Core streamlined navigation links to prevent congestion
const navLinks = [
  { to: '/', label: 'Overview' },
  { to: '/discovery', label: 'Discovery' },
  { to: '/storage', label: 'IPFS Hub' },
  { to: '/marketplace', label: 'Marketplace' },
  { to: '/registry', label: 'Registry' },
  { to: '/dashboard', label: 'Dashboard' },
];

export default function App() {
  const location = useLocation();
  const wallet = useWalletState();
  const { user, userProfile, linkWalletAddress } = useAuth();
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [metaMaskModalOpen, setMetaMaskModalOpen] = useState(false);

  const address = wallet?.address ?? null;
  const connected = wallet?.connected ?? false;
  const correctNetwork = wallet?.correctNetwork ?? false;
  const isConnecting = wallet?.connecting ?? false;
  const walletError = wallet?.error ?? '';

  // Auto-sync connected MetaMask wallet address to Firestore user profile and API client
  useEffect(() => {
    const activeAddr = address || userProfile?.walletAddress || null;
    setApiAuth(activeAddr);
    if (user && connected && address) {
      if (userProfile && userProfile.walletAddress !== address) {
        void linkWalletAddress(address);
      }
    }
  }, [user, connected, address, userProfile?.walletAddress, linkWalletAddress]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleConnectWallet = async () => {
    if (!wallet) return;
    if (!wallet.isMetaMaskInstalled) {
      setMetaMaskModalOpen(true);
      return;
    }
    try {
      await wallet.connect();
    } catch (err) {
      console.error('Wallet connection attempt failed:', err);
    }
  };

  const isAuthRoute = ['/login', '/signup', '/auth'].includes(location.pathname);
  const isHomePage = location.pathname === '/';

  if (isAuthRoute) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-[#080c16] flex items-center justify-center text-slate-400 font-mono text-xs">Initializing portal…</div>}>
        <AuthPage />
      </Suspense>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#080c16] text-[#e9ecee] flex flex-col font-sans selection:bg-[#38bdf8]/20 selection:text-[#38bdf8]">
      {/* Cinematic Film Grain & Vignette */}
      <div className="film-grain" />
      <div className="vignette-overlay" />

      {/* Floating Decongested Navbar with Glass Surface */}
      <header className="fixed top-0 left-0 w-full z-50 transition-all border-b border-white/[0.04] bg-[#080c16]/80 backdrop-blur-md">
        <div className="w-full max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-3 group shrink-0">
            <div className="w-6 h-6 flex items-center justify-center text-[#e9ecee] group-hover:text-white transition-colors">
              <svg viewBox="0 0 32 32" fill="none" className="w-full h-full stroke-current" strokeWidth="1.3">
                <polygon points="16,3 29,26 3,26" strokeLinejoin="round" />
                <polygon points="16,10 24,24 8,24" strokeLinejoin="round" strokeOpacity="0.35" />
                <circle cx="16" cy="18" r="2.2" fill="currentColor" fillOpacity="0.8" />
              </svg>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-heading font-medium tracking-[0.24em] text-sm text-[#e9ecee] group-hover:text-white transition-colors">
                MATCHAIN
              </span>
              <span className="hidden sm:inline font-mono text-[9px] uppercase tracking-[0.2em] text-[#6e8799] border-l border-white/[0.08] pl-2">
                Discovery
              </span>
            </div>
          </Link>

          {/* Centered Spaced Navigation Links */}
          <nav className="hidden md:flex items-center gap-9 lg:gap-11">
            {navLinks.map(({ to, label }) => (
              <NavLink
                key={label}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `nav-link font-mono text-[11px] uppercase tracking-[0.18em] transition-all py-1.5 ${
                    isActive
                      ? 'text-white font-medium border-b border-white/50'
                      : 'text-[#6e8799] hover:text-[#e9ecee]'
                  }`
                }
              >
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Right Floating Actions (Wallet & Identity) */}
          <div className="flex items-center gap-3">
            {/* Wallet Status Chip / Connect Button */}
            {connected ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/[0.03] text-[11px] font-mono text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="tracking-wider">{address?.slice(0, 6)}…{address?.slice(-4)}</span>
                {!correctNetwork && (
                  <button
                    type="button"
                    onClick={() => void wallet?.switchNetwork().catch(() => undefined)}
                    className="ml-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] hover:bg-amber-500/30 transition flex items-center gap-1"
                    title="Switch MetaMask to Chain 1337 (Local EVM)"
                  >
                    <span>Switch Chain</span>
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConnectWallet}
                disabled={isConnecting}
                className="btn-overworld text-[11px] py-1.5 px-3.5 flex items-center gap-2 group"
                title="Connect Web3 Wallet"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin text-[#38bdf8]" />
                    <span>Connecting…</span>
                  </>
                ) : (
                  <>
                    <Wallet className="h-3.5 w-3.5 text-[#aab9c7] group-hover:text-white transition-colors" />
                    <span>Connect</span>
                  </>
                )}
              </button>
            )}

            {/* Researcher Profile / Sign In */}
            {user ? (
              <button
                type="button"
                onClick={() => setIsEditProfileOpen(true)}
                className="flex items-center gap-2 pl-2.5 pr-2 py-1 rounded-full border border-[#e9ecee]/12 bg-[#e9ecee]/[0.02] text-[11px] text-[#e9ecee] hover:border-[#e9ecee]/25 hover:bg-[#e9ecee]/[0.05] transition"
                title="Edit Researcher Identity"
              >
                <span className="w-5 h-5 rounded-full bg-white/[0.08] flex items-center justify-center font-mono text-[9px] text-white">
                  {userProfile?.displayName ? userProfile.displayName.charAt(0).toUpperCase() : 'R'}
                </span>
                <span className="hidden sm:inline font-mono text-[10px] max-w-[90px] truncate">
                  {userProfile?.displayName || user.email?.split('@')[0]}
                </span>
                <Edit3 className="h-2.5 w-2.5 text-[#6e8799]" />
              </button>
            ) : (
              <Link
                to="/login"
                className="btn-overworld-primary text-[11px] py-1.5 px-3.5"
              >
                <span>Portal</span>
              </Link>
            )}

            {/* Mobile Menu Hamburger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 text-[#6e8799] hover:text-white transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/[0.06] bg-[#080c16]/95 backdrop-blur-xl px-6 py-4 space-y-2">
            {navLinks.map(({ to, label }) => (
              <NavLink
                key={label}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center justify-between py-2 text-xs font-mono uppercase tracking-widest ${
                    isActive ? 'text-white font-medium' : 'text-[#6e8799]'
                  }`
                }
              >
                <span>{label}</span>
                <ChevronRight className="h-3.5 w-3.5 opacity-40" />
              </NavLink>
            ))}
          </div>
        )}

        {/* Wallet Error Banner */}
        {walletError && (
          <div className="bg-amber-500/10 border-t border-amber-500/20 px-6 py-2 text-xs font-mono text-amber-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span>{walletError}</span>
            </div>
            <button
              type="button"
              onClick={() => wallet?.clearError()}
              className="text-[10px] uppercase tracking-wider text-amber-400 hover:text-white underline ml-4"
            >
              Dismiss
            </button>
          </div>
        )}
      </header>

      {/* Main Workspace Canvas & Viewport */}
      <main className="relative flex-1 w-full z-10 flex flex-col">
        {isHomePage ? (
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-500 font-mono text-xs">Initializing crystal lattice…</div>}>
            <LandingPage />
          </Suspense>
        ) : (
          <div className="w-full max-w-7xl mx-auto px-4 md:px-8 pt-24 pb-16 flex-1">
            <Suspense fallback={<div className="card p-12 text-center text-slate-400 font-mono text-xs">Loading workspace view…</div>}>
              <Routes>
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <DashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/discovery"
                  element={
                    <ProtectedRoute>
                      <DiscoveryPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/analytics"
                  element={
                    <ProtectedRoute>
                      <AnalyticsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/marketplace"
                  element={
                    <ProtectedRoute>
                      <MarketplacePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/registry"
                  element={
                    <ProtectedRoute>
                      <RegistryPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/storage"
                  element={
                    <ProtectedRoute>
                      <StoragePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <SettingsPage />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </Suspense>
          </div>
        )}
      </main>

      {/* Interactive Researcher Profile Modal */}
      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
      />

      {/* MetaMask Install Helper Modal */}
      {metaMaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="card max-w-md w-full p-6 border-white/[0.12] space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="font-heading text-lg font-medium text-white flex items-center gap-2">
                <Wallet className="h-4 w-4 text-[#38bdf8]" />
                MetaMask Extension Required
              </h3>
              <button
                type="button"
                onClick={() => setMetaMaskModalOpen(false)}
                className="text-[#6e8799] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-[#aab9c7] leading-relaxed">
              MetaMask was not detected in this browser. To anchor discoveries to the EVM registry and transact in the materials marketplace, please install the MetaMask browser extension.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setMetaMaskModalOpen(false)}
                className="btn-overworld text-xs py-1.5 px-3"
              >
                Cancel
              </button>
              <a
                href="https://metamask.io/download/"
                target="_blank"
                rel="noreferrer"
                className="btn-overworld-primary text-xs py-1.5 px-4 flex items-center gap-1.5"
              >
                <span>Install MetaMask</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
