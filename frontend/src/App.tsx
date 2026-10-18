import { lazy, Suspense, useState, useEffect, useRef } from 'react';
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
  ChevronDown,
  LogOut,
  Copy,
  Check,
  User as UserIcon,
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
  const { user, userProfile, linkWalletAddress, logOut } = useAuth();
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [metaMaskModalOpen, setMetaMaskModalOpen] = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const walletMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const address = wallet?.address ?? null;
  const connected = wallet?.connected ?? false;
  const correctNetwork = wallet?.correctNetwork ?? false;
  const isConnecting = wallet?.connecting ?? false;
  const walletError = wallet?.error ?? '';

  // Close wallet and profile dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (walletMenuRef.current && !walletMenuRef.current.contains(target)) {
        setWalletMenuOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setProfileMenuOpen(false);
      }
    };
    if (walletMenuOpen || profileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [walletMenuOpen, profileMenuOpen]);

  const handleCopyAddress = () => {
    if (!address) return;
    void navigator.clipboard.writeText(address);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const handleDisconnect = () => {
    wallet?.disconnect();
    setWalletMenuOpen(false);
  };

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
          <div className="flex items-center gap-2">
            {/* Wallet Status Chip / Connect & Disconnect Button */}
            {connected ? (
              <div className="relative" ref={walletMenuRef}>
                {/* Unified Sleek Pill */}
                <div className="flex items-center gap-1.5 h-8 pl-3 pr-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/[0.05] hover:border-emerald-500/40 hover:bg-emerald-500/[0.08] transition-all duration-200 shadow-[0_0_12px_rgba(16,185,129,0.06)]">
                  {/* Address & Dropdown Trigger */}
                  <button
                    type="button"
                    onClick={() => setWalletMenuOpen((prev) => !prev)}
                    className="flex items-center gap-2 text-[11px] font-mono text-emerald-300 hover:text-white transition whitespace-nowrap focus:outline-none select-none"
                    title="View Wallet Details & Options"
                  >
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]"></span>
                    </span>
                    <span className="font-semibold tracking-wide whitespace-nowrap">
                      {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ''}
                    </span>
                    <ChevronDown
                      className={`h-3 w-3 text-emerald-400/70 transition-transform duration-200 ${
                        walletMenuOpen ? 'rotate-180 text-white' : ''
                      }`}
                    />
                  </button>

                  {!correctNetwork && (
                    <button
                      type="button"
                      onClick={() => void wallet?.switchNetwork().catch(() => undefined)}
                      className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-mono hover:bg-amber-500/30 transition flex items-center gap-1 whitespace-nowrap"
                      title="Switch MetaMask to Chain 1337 (Local EVM)"
                    >
                      <AlertTriangle className="h-2.5 w-2.5" />
                      <span>Switch</span>
                    </button>
                  )}

                  {/* Subtle Divider */}
                  <div className="h-3.5 w-[1px] bg-emerald-500/20 mx-0.5" />

                  {/* 1-Click Quick Disconnect */}
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="p-1 rounded-full text-emerald-400/50 hover:text-rose-400 hover:bg-rose-500/10 transition-colors focus:outline-none"
                    title="Disconnect Wallet"
                    aria-label="Disconnect Wallet"
                  >
                    <LogOut className="h-3 w-3" />
                  </button>
                </div>

                {/* Floating Web3 Dropdown Popover */}
                {walletMenuOpen && (
                  <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-white/[0.08] bg-[#0c1222]/95 backdrop-blur-xl shadow-2xl p-3.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.06]">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Connected Wallet</span>
                      </div>
                      <span className="font-mono text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full whitespace-nowrap">
                        {correctNetwork ? 'Ganache 1337' : 'Wrong Chain'}
                      </span>
                    </div>

                    {/* Full Address & Copy */}
                    <div className="mt-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-slate-200 truncate select-all">
                        {address}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyAddress}
                        className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-slate-400 hover:text-white transition shrink-0"
                        title={copiedAddress ? 'Address copied!' : 'Copy Address'}
                      >
                        {copiedAddress ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>

                    {/* Network Switcher Alert if needed */}
                    {!correctNetwork && (
                      <div className="mt-2.5 p-2 rounded-xl bg-amber-500/[0.08] border border-amber-500/20 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-amber-300 text-[11px]">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          <span>Wrong network</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => void wallet?.switchNetwork().catch(() => undefined)}
                          className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-mono transition whitespace-nowrap"
                        >
                          Switch to 1337
                        </button>
                      </div>
                    )}

                    {/* Disconnect Action */}
                    <div className="mt-3 pt-2.5 border-t border-white/[0.06]">
                      <button
                        type="button"
                        disabled={isConnecting}
                        onClick={() => void wallet?.switchAccount().catch(() => undefined)}
                        className="w-full mb-2 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 hover:border-cyan-500/40 text-cyan-200 text-xs font-mono transition disabled:opacity-50"
                      >
                        {isConnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wallet className="h-3.5 w-3.5" />}
                        <span>Switch MetaMask account</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDisconnect}
                        className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/40 text-rose-300 text-xs font-mono transition"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Disconnect Wallet</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Disconnected State - High Tech Sleek Pill Button */
              <button
                type="button"
                onClick={handleConnectWallet}
                disabled={isConnecting}
                className="h-8 px-3.5 rounded-full border border-cyan-500/35 bg-cyan-500/[0.08] hover:bg-cyan-500/[0.16] hover:border-cyan-500/60 text-cyan-300 hover:text-white transition-all duration-200 font-mono text-[11px] font-medium tracking-wide flex items-center gap-2 whitespace-nowrap shadow-[0_0_14px_rgba(6,182,212,0.1)] hover:shadow-[0_0_20px_rgba(6,182,212,0.22)] group focus:outline-none"
                title="Connect Web3 MetaMask Wallet"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                    <span className="whitespace-nowrap">Connecting…</span>
                  </>
                ) : (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-60"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
                    </span>
                    <Wallet className="h-3.5 w-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
                    <span className="whitespace-nowrap">Connect Wallet</span>
                  </>
                )}
              </button>
            )}

            {/* Researcher Profile / Sign In */}
            {user ? (
              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((prev) => !prev)}
                  className="flex items-center gap-2 h-8 pl-2 pr-3 rounded-full border border-white/[0.1] bg-white/[0.03] hover:border-white/[0.22] hover:bg-white/[0.07] transition text-[11px] text-white whitespace-nowrap shadow-sm group select-none"
                  title="Researcher Identity & Account"
                >
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center justify-center font-mono text-[9px] font-bold">
                    {userProfile?.displayName ? userProfile.displayName.charAt(0).toUpperCase() : 'R'}
                  </span>
                  <span className="hidden sm:inline font-mono text-[10px] max-w-[105px] truncate text-slate-200 group-hover:text-white">
                    {userProfile?.displayName || user.email?.split('@')[0]}
                  </span>
                  <ChevronDown
                    className={`h-3 w-3 text-slate-400 group-hover:text-white transition-transform duration-200 ${
                      profileMenuOpen ? 'rotate-180 text-white' : ''
                    }`}
                  />
                </button>

                {/* Researcher Profile Dropdown Popover */}
                {profileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-white/[0.08] bg-[#0c1222]/95 backdrop-blur-xl shadow-2xl p-3.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.06]">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">Researcher Profile</span>
                      <span className="font-mono text-[10px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full whitespace-nowrap">
                        {userProfile?.role || 'Scientist'}
                      </span>
                    </div>

                    <div className="mt-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-1">
                      <div className="font-medium text-xs text-white truncate">
                        {userProfile?.displayName || 'Anonymous Researcher'}
                      </div>
                      <div className="font-mono text-[11px] text-slate-400 truncate">
                        {user.email || 'guest@matchain.org'}
                      </div>
                      {userProfile?.organization && (
                        <div className="font-mono text-[10px] text-slate-500 truncate pt-0.5">
                          {userProfile.organization}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="mt-3 space-y-1.5 pt-2 border-t border-white/[0.06]">
                      <button
                        type="button"
                        onClick={() => {
                          setProfileMenuOpen(false);
                          setIsEditProfileOpen(true);
                        }}
                        className="w-full flex items-center justify-between py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.05] text-slate-200 hover:text-white text-xs font-mono transition"
                      >
                        <span className="flex items-center gap-2">
                          <Edit3 className="h-3.5 w-3.5 text-cyan-400" />
                          <span>Edit Profile</span>
                        </span>
                        <ChevronRight className="h-3 w-3 text-slate-500" />
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          setProfileMenuOpen(false);
                          await logOut();
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/40 text-rose-300 text-xs font-mono transition"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="h-8 px-3.5 rounded-full border border-cyan-500/40 bg-cyan-500/[0.12] hover:bg-cyan-500/[0.22] hover:border-cyan-500/60 text-cyan-300 hover:text-white font-mono text-[11px] font-medium flex items-center justify-center gap-1.5 tracking-wider transition whitespace-nowrap shadow-[0_0_12px_rgba(6,182,212,0.12)]"
                title="Sign In / Register Researcher Account"
              >
                <UserIcon className="h-3.5 w-3.5" />
                <span>Sign In</span>
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

            {/* Mobile Auth & Identity Controls */}
            <div className="pt-3 mt-2 border-t border-white/[0.06] space-y-2">
              {user ? (
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-medium text-white">{userProfile?.displayName || user.email?.split('@')[0]}</div>
                      <div className="text-[10px] font-mono text-slate-400">{user.email}</div>
                    </div>
                    <span className="font-mono text-[9px] text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                      {userProfile?.role || 'Scientist'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsEditProfileOpen(true)}
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-xs font-mono text-slate-300 flex items-center justify-center gap-1.5 transition"
                    >
                      <Edit3 className="h-3 w-3 text-cyan-400" />
                      <span>Edit Profile</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void logOut()}
                      className="py-1.5 px-3 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-mono flex items-center justify-center gap-1.5 transition border border-rose-500/20"
                    >
                      <LogOut className="h-3 w-3" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="w-full py-2.5 px-3 rounded-xl border border-cyan-500/40 bg-cyan-500/15 text-cyan-300 text-xs font-mono flex items-center justify-center gap-2 hover:bg-cyan-500/25 transition"
                >
                  <UserIcon className="h-4 w-4" />
                  <span>Sign In / Create Account</span>
                </Link>
              )}
            </div>

            {/* Mobile Wallet Controls */}
            <div className="pt-2 border-t border-white/[0.06]">
              {connected ? (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span className="font-mono text-xs text-emerald-300 select-all">{address?.slice(0, 6)}…{address?.slice(-4)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 font-mono text-[11px] hover:bg-rose-500/20 transition"
                  >
                    <LogOut className="h-3 w-3" />
                    <span>Disconnect</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectWallet}
                  disabled={isConnecting}
                  className="w-full py-2.5 px-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-xs font-mono flex items-center justify-center gap-2 hover:bg-cyan-500/20 transition"
                >
                  <Wallet className="h-4 w-4" />
                  <span>Connect Wallet</span>
                </button>
              )}
            </div>
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
