import React, { useState } from 'react';
import {
  X,
  User as UserIcon,
  Briefcase,
  Building2,
  Mail,
  Key,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Atom,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWalletState } from '../services/wallet';

export const RESEARCH_ROLES = [
  'Materials Scientist',
  'Computational Chemist',
  'Solid-State Physicist',
  'Battery & Energy Storage Engineer',
  'Crystallographer & Mineralogist',
  'Polymer & Soft Matter Researcher',
  'Nanotechnology Engineer',
  'Metallurgist & Alloys Specialist',
  'Machine Learning / AI Materials Scientist',
  'Academic Faculty / Professor',
  'Postdoctoral Researcher / PhD Candidate',
  'Undergraduate / Graduate Student',
  'Industry R&D Specialist',
  'Other',
];

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function EditProfileModal({ isOpen, onClose }: EditProfileModalProps) {
  const { user, userProfile, updateUserProfile } = useAuth();
  const wallet = useWalletState();
  const activeWallet = wallet?.connected && wallet?.address ? wallet.address : userProfile?.walletAddress;

  const currentRole = userProfile?.role || 'Materials Scientist';
  const isCustomRole = !RESEARCH_ROLES.slice(0, -1).includes(currentRole);

  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [selectedRole, setSelectedRole] = useState(isCustomRole ? 'Other' : currentRole);
  const [customRole, setCustomRole] = useState(isCustomRole ? currentRole : '');
  const [organization, setOrganization] = useState(userProfile?.organization || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const finalRole = selectedRole === 'Other' ? customRole.trim() : selectedRole;
    if (!finalRole) {
      setError('Please specify your research role or field.');
      return;
    }

    setSaving(true);
    try {
      await updateUserProfile({
        displayName: displayName.trim() || undefined,
        role: finalRole,
        organization: organization.trim() || undefined,
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      setError(err?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in-up">
      <div className="relative w-full max-w-lg rounded-2xl border border-white/[0.1] bg-[#0c1017] p-6 md:p-8 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white transition"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6 border-b border-white/[0.06] pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/[0.12] text-amber-300 shadow-sm">
            <Atom className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-heading text-lg font-semibold text-white">Researcher Profile</h2>
            <p className="text-xs font-mono text-slate-400">Update academic identity and institutional affiliation</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/[0.04] p-3 text-xs font-mono text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.04] p-3 text-xs font-mono text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>Profile updated successfully.</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
              Full Name / Display Name
            </label>
            <div className="relative">
              <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Dr. Marie Curie"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2 pl-10 pr-4 text-xs text-white focus:border-amber-400/50 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Research Role */}
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
              Research Discipline
            </label>
            <div className="relative">
              <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full rounded-xl border border-white/[0.08] bg-[#0c1017] py-2 pl-10 pr-4 text-xs text-white focus:border-amber-400/50 focus:outline-none transition-colors"
              >
                {RESEARCH_ROLES.map((r) => (
                  <option key={r} value={r} className="bg-slate-900 text-white">
                    {r}
                  </option>
                ))}
              </select>
            </div>
            {selectedRole === 'Other' && (
              <div className="mt-2.5">
                <input
                  type="text"
                  required
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  placeholder="Specify field (e.g., Quantum Materials Analyst)"
                  className="w-full rounded-xl border border-amber-500/30 bg-white/[0.03] py-2 px-3 text-xs text-white focus:border-amber-400 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Institution */}
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
              Affiliation / Laboratory
            </label>
            <div className="relative">
              <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="National Lab / MIT / Independent"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-2 pl-10 pr-4 text-xs text-white focus:border-amber-400/50 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Read-Only Identity Section */}
          <div className="pt-3 border-t border-white/[0.06] space-y-2 text-xs font-mono text-slate-400">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-1">
              <Lock className="h-3 w-3" />
              <span>Immutable Account Anchors</span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-black/40 px-3 py-2 border border-white/[0.04]">
              <span className="flex items-center gap-2 text-slate-400">
                <Mail className="h-3.5 w-3.5" /> Email
              </span>
              <span className="text-slate-300 text-[11px]">{user?.email || '—'}</span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-black/40 px-3 py-2 border border-white/[0.04]">
              <span className="flex items-center gap-2 text-slate-400">
                <Key className="h-3.5 w-3.5" /> UID
              </span>
              <span className="text-slate-400 text-[11px]">{user?.uid?.slice(0, 12)}…</span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-black/40 px-3 py-2 border border-white/[0.04]">
              <span className="flex items-center gap-2 text-slate-400">
                <Wallet className="h-3.5 w-3.5 text-amber-300" /> Web3 Wallet
              </span>
              {activeWallet ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-300 text-[11px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-glow" />
                  <span>{activeWallet.slice(0, 6)}…{activeWallet.slice(-4)}</span>
                </span>
              ) : (
                <span className="text-slate-500 text-[11px]">Not linked</span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              className="button-secondary text-xs px-4 py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="button-primary text-xs px-5 py-2 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Saving…</span>
                </>
              ) : (
                <span>Save Profile</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
