import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Atom,
  Mail,
  Lock,
  User as UserIcon,
  Briefcase,
  Building2,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Shield,
  Layers,
  FlaskConical,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { RESEARCH_ROLES } from '../components/EditProfileModal';

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user,
    userProfile,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signInAsGuest,
    isConfigured,
    formatAuthError,
    logOut,
  } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedRole, setSelectedRole] = useState(RESEARCH_ROLES[0]);
  const [customRole, setCustomRole] = useState('');
  const [organization, setOrganization] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
        setSuccessMsg('Authenticated successfully. Redirecting to workspace…');
      } else {
        if (!displayName.trim()) {
          throw new Error('Please enter your full name.');
        }
        const finalRole = selectedRole === 'Other' ? customRole.trim() : selectedRole;
        if (!finalRole) {
          throw new Error('Please select or specify your research role.');
        }

        await signUpWithEmail(email, password, displayName, finalRole, organization || 'Independent Researcher');
        setSuccessMsg('Researcher profile initialized. Welcome to MatChain.');
      }

      setTimeout(() => {
        const from = (location.state as any)?.from?.pathname || '/dashboard';
        navigate(from, { replace: true });
      }, 700);
    } catch (err: any) {
      console.error('Auth error:', err);
      setErrorMsg(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      setSuccessMsg('Single sign-on authorized. Redirecting…');
      setTimeout(() => {
        const from = (location.state as any)?.from?.pathname || '/dashboard';
        navigate(from, { replace: true });
      }, 700);
    } catch (err: any) {
      console.error('Google sign in error:', err);
      setErrorMsg(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#080c16] text-[#e9ecee] flex flex-col justify-center items-center p-4 selection:bg-[#38bdf8]/20 selection:text-[#38bdf8]">
      {/* Cinematic Film Grain & Vignette */}
      <div className="film-grain" />
      <div className="vignette-overlay" />

      {/* Back to Home link */}
      <div className="absolute top-6 left-6 z-20">
        <Link
          to="/"
          className="flex items-center gap-2 text-xs font-mono text-[#aab9c7] hover:text-white px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] backdrop-blur-md transition-all hover:border-white/[0.2]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Return to Overview</span>
        </Link>
      </div>

      {/* Ambient Lighting Gradients */}
      <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[34rem] h-[34rem] bg-cyan-500/[0.05] rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 right-1/4 w-[28rem] h-[28rem] bg-emerald-500/[0.04] rounded-full blur-3xl" />

      <div className="relative w-full max-w-lg my-8 z-10">
        {/* If already logged in, show intuitive session banner instead of trapping */}
        {user && (
          <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4 text-xs font-mono text-emerald-200 backdrop-blur-md">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-emerald-500/20">
              <div className="flex items-center gap-2 font-medium text-emerald-300">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                <span>Active Session Detected</span>
              </div>
              <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded-full text-emerald-300 font-semibold">
                Logged In
              </span>
            </div>
            <p className="text-slate-300 text-[11px] mb-3">
              Signed in as <strong className="text-white">{userProfile?.displayName || user.email}</strong> ({userProfile?.role || 'Scientist'}).
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const from = (location.state as any)?.from?.pathname || '/dashboard';
                  navigate(from, { replace: true });
                }}
                className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-xs font-mono font-medium flex items-center justify-center gap-1.5 transition border border-emerald-500/30"
              >
                <span>Continue to Workspace</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => void logOut()}
                className="py-1.5 px-3 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-mono flex items-center justify-center gap-1.5 transition border border-rose-500/20"
                title="Sign out of current account"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}

        {/* Firebase Config Notice if .env variables missing */}
        {!isConfigured && (
          <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/[0.05] p-4 text-xs font-mono text-amber-200 backdrop-blur-md">
            <div className="flex items-center gap-2 font-medium text-amber-100 mb-1">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <span>Firebase Environment Notice</span>
            </div>
            <p className="text-slate-300">
              Live Firebase credentials are not yet configured in <code className="text-amber-300">frontend/.env.local</code>. Running in offline/demo mode.
            </p>
          </div>
        )}

        {/* Main Glassmorphic Auth Card */}
        <div className="card border-white/[0.08] bg-[#0c1222]/85 backdrop-blur-2xl p-7 md:p-9 shadow-2xl rounded-2xl">
          {/* Header */}
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-950/40 to-slate-900 border border-cyan-500/30 text-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
              <Atom className="h-6 w-6 animate-spin text-cyan-400" style={{ animationDuration: '16s' }} />
            </div>
            <div className="ts-caption text-[#6e8799] tracking-[0.28em] mb-1.5">
              MATCHAIN RESEARCH IDENTITY
            </div>
            <h1 className="font-serif-headline text-2xl font-semibold tracking-tight text-white md:text-3xl">
              {mode === 'signin' ? 'Researcher Portal Sign In' : 'Create Researcher Account'}
            </h1>
            <p className="mt-1.5 text-xs font-mono text-[#aab9c7]">
              {mode === 'signin'
                ? 'Access your computational discoveries and registered material ledgers'
                : 'Join the decentralized inverse materials discovery network'}
            </p>

            {/* Mode Switcher Tabs */}
            <div className="mt-5 inline-flex rounded-xl border border-white/[0.08] bg-black/40 p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMsg(null);
                }}
                className={`rounded-lg px-6 py-1.5 text-xs font-mono font-medium transition ${
                  mode === 'signin'
                    ? 'bg-cyan-500/20 text-cyan-300 shadow-sm border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMsg(null);
                }}
                className={`rounded-lg px-6 py-1.5 text-xs font-mono font-medium transition ${
                  mode === 'signup'
                    ? 'bg-cyan-500/20 text-cyan-300 shadow-sm border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Register
              </button>
            </div>
          </div>

          {/* Feedback Messages */}
          {errorMsg && (
            <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/[0.08] p-3.5 text-xs font-mono text-rose-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div role="status" className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] p-3.5 text-xs font-mono text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Google 1-Click Sign In */}
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading || !isConfigured}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-xs font-mono font-medium text-slate-200 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{mode === 'signin' ? 'Sign in with Google Workspace' : 'Sign up with Google Workspace'}</span>
            </button>

            <div className="relative flex items-center justify-center">
              <div className="w-full border-t border-white/[0.06]" />
              <span className="bg-[#0c1222] px-3 text-[10px] uppercase font-mono tracking-wider text-slate-500">
                Or authenticate with credentials
              </span>
              <div className="w-full border-t border-white/[0.06]" />
            </div>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-300 mb-1">
                    Full Name & Title
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Dr. Eleanor Vance"
                      className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2 pl-10 pr-4 text-xs text-white placeholder-slate-600 focus:border-cyan-400/50 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-300 mb-1">
                      Research Discipline
                    </label>
                    <div className="relative">
                      <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <select
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value)}
                        className="w-full rounded-xl border border-white/[0.08] bg-[#0c1222] py-2 pl-10 pr-4 text-xs text-white focus:border-cyan-400/50 focus:outline-none transition-colors"
                      >
                        {RESEARCH_ROLES.map((r) => (
                          <option key={r} value={r} className="bg-slate-900 text-white">
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-300 mb-1">
                      Affiliation / Institution
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input
                        type="text"
                        value={organization}
                        onChange={(e) => setOrganization(e.target.value)}
                        placeholder="e.g. Max Planck Institute"
                        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2 pl-10 pr-4 text-xs text-white placeholder-slate-600 focus:border-cyan-400/50 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {selectedRole === 'Other' && (
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-cyan-300 mb-1">
                      Specify Custom Research Domain
                    </label>
                    <input
                      type="text"
                      required
                      value={customRole}
                      onChange={(e) => setCustomRole(e.target.value)}
                      placeholder="e.g. Topological Quantum Materials"
                      className="w-full rounded-xl border border-cyan-500/30 bg-white/[0.03] py-2 px-3.5 text-xs text-white placeholder-slate-600 focus:border-cyan-400 focus:outline-none transition-colors"
                    />
                  </div>
                )}
              </>
            )}

            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-300 mb-1">
                Academic or Institutional Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="scientist@institution.edu"
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2 pl-10 pr-4 text-xs text-white placeholder-slate-600 focus:border-cyan-400/50 focus:outline-none transition-colors font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-300 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2 pl-10 pr-10 text-xs text-white placeholder-slate-600 focus:border-cyan-400/50 focus:outline-none transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !isConfigured}
              className="w-full py-2.5 px-4 rounded-xl border border-cyan-500/40 bg-cyan-500/20 hover:bg-cyan-500/30 hover:border-cyan-500/60 text-white font-mono text-xs font-semibold flex items-center justify-center gap-2 mt-3 transition shadow-[0_0_15px_rgba(6,182,212,0.15)] disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Verifying Credentials…
                </span>
              ) : (
                <>
                  <span>{mode === 'signin' ? 'Enter Workspace' : 'Initialize Account'}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-cyan-300" />
                </>
              )}
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-white/[0.08]"></div>
              <span className="flex-shrink mx-4 font-mono text-[10px] text-[#6e8799] uppercase tracking-widest">or instant access</span>
              <div className="flex-grow border-t border-white/[0.08]"></div>
            </div>

            <button
              type="button"
              onClick={() => {
                signInAsGuest();
                const from = (location.state as any)?.from?.pathname || '/dashboard';
                navigate(from, { replace: true });
              }}
              className="btn-overworld w-full py-2.5 text-xs flex items-center justify-center gap-2 text-[#e9ecee] hover:text-white"
            >
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              <span>Explore as Guest Researcher</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </form>

          {/* Footer security badges */}
          <div className="mt-6 border-t border-white/[0.06] pt-4 flex items-center justify-around text-[10px] font-mono text-slate-400">
            <div className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-cyan-400" />
              <span>Cloud Auth</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-emerald-400" />
              <span>Profile Vault</span>
            </div>
            <div className="flex items-center gap-1.5">
              <FlaskConical className="h-3.5 w-3.5 text-amber-400" />
              <span>EVM Linked</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
