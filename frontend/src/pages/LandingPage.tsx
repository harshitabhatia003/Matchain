import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Blocks, Database, ExternalLink, ShieldCheck, X } from 'lucide-react';
import CrystalCanvas, { DISCOVERED_MARKERS, type MarkerMaterial } from '../components/CrystalCanvas';
import { fetchJson } from '../lib/api';
import type { Stats } from '../types';

export default function LandingPage() {
  const [selectedMarker, setSelectedMarker] = useState<MarkerMaterial | null>(DISCOVERED_MARKERS[0]);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetchJson<Stats>('/api/dashboard/stats').then(setStats).catch(() => setStats(null));
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden select-none">
      {/* 3D Interactive Crystal Landscape Canvas */}
      <CrystalCanvas
        onSelectMarker={(m) => setSelectedMarker(m)}
        selectedMarkerId={selectedMarker?.id}
      />

      {/* Floating Editorial Headline (Upper-Left Anchor) */}
      <div className="absolute top-[18vh] md:top-[22vh] left-[4vw] max-w-xl z-20 pointer-events-none">
        <div className="ts-caption text-[#6e8799] tracking-[0.3em] mb-3">
          CRYSTAL VAE • ENSEMBLE JURY • BLOCKCHAIN REGISTRY
        </div>
        <h1 className="font-serif-headline text-3xl sm:text-5xl md:text-6xl text-[#e9ecee] leading-[1.08]">
          Building autonomous materials intelligence
        </h1>
        <p className="mt-4 text-xs sm:text-sm text-[#aab9c7] leading-relaxed max-w-md font-light">
          Conditioned latent sampling for novel functional crystals, validated by neural surrogate consensus and immutably anchored on-chain.
        </p>

        {/* Live Pipeline Telemetry Pills */}
        <div className="mt-6 flex items-center gap-4 text-[10px] font-mono text-[#aab9c7] pointer-events-auto">
          <div className="px-3 py-1.5 rounded border border-[#e9ecee]/10 bg-[#080c16]/80 backdrop-blur-md">
            <span className="text-[#6e8799] uppercase mr-2">SAMPLED:</span>
            <span className="text-white font-semibold">{stats?.total_candidates_generated ?? '200'}</span>
          </div>
          <div className="px-3 py-1.5 rounded border border-[#e9ecee]/10 bg-[#080c16]/80 backdrop-blur-md">
            <span className="text-[#6e8799] uppercase mr-2">VALIDATED:</span>
            <span className="text-[#38bdf8] font-semibold">{stats?.structurally_valid_candidates ?? '178'}</span>
          </div>
        </div>
      </div>

      {/* Bottom Floating Bar & Controls (Overworld Chrome) */}
      <div className="absolute bottom-[2.5rem] left-0 w-full z-30 pointer-events-none px-[4vw]">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Bottom Left: Action Triggers */}
          <div className="flex items-center gap-3 pointer-events-auto">
            <Link
              to="/discovery"
              className="btn-overworld text-[10px] tracking-[0.25em]"
            >
              <span>INVERSE DESIGN</span>
              <ArrowRight className="h-3 w-3 text-[#38bdf8]" />
            </Link>

            <Link
              to="/marketplace"
              className="btn-overworld text-[10px] tracking-[0.25em]"
            >
              <span>MARKETPLACE</span>
            </Link>

            <Link
              to="/registry"
              className="btn-overworld text-[10px] tracking-[0.25em]"
            >
              <span>REGISTRY</span>
            </Link>
          </div>

          {/* Bottom Center: Active Material Candidate Focus Pill */}
          {selectedMarker && (
            <div className="pointer-events-auto relative rounded-xl border border-[#e9ecee]/15 bg-[#080c16]/90 backdrop-blur-xl p-4 sm:p-5 max-w-sm w-full shadow-2xl transition-all">
              <button
                type="button"
                onClick={() => setSelectedMarker(null)}
                className="absolute top-3 right-3 text-[#6e8799] hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>

              <div className="flex items-center justify-between border-b border-[#e9ecee]/08 pb-2.5">
                <div>
                  <span className="font-serif-headline text-xl text-white font-medium">
                    {selectedMarker.formula}
                  </span>
                  <div className="text-[10px] text-[#6e8799] uppercase tracking-wider font-mono">
                    {selectedMarker.name}
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[9px] font-mono border border-emerald-500/30 text-emerald-300 bg-emerald-500/10">
                  Jury Pass
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-mono">
                <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04]">
                  <div className="text-[9px] text-[#6e8799] uppercase">E Above Hull</div>
                  <div className="text-white font-semibold mt-0.5">{selectedMarker.e_hull} eV</div>
                </div>
                <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04]">
                  <div className="text-[9px] text-[#6e8799] uppercase">Band Gap</div>
                  <div className="text-white font-semibold mt-0.5">{selectedMarker.band_gap} eV</div>
                </div>
                <div className="p-2 rounded bg-white/[0.02] border border-white/[0.04]">
                  <div className="text-[9px] text-[#6e8799] uppercase">Density</div>
                  <div className="text-white font-semibold mt-0.5">{selectedMarker.density} g/cm³</div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#e9ecee]/06 text-[10px] font-mono text-[#6e8799]">
                <span>FINGERPRINT: {selectedMarker.hash.slice(0, 12)}…</span>
                <Link
                  to="/discovery"
                  className="text-[#38bdf8] hover:underline flex items-center gap-1"
                >
                  <span>Synthesize</span>
                  <ArrowRight className="h-2.5 w-2.5" />
                </Link>
              </div>
            </div>
          )}

          {/* Bottom Right: Interactive Scene Guidance */}
          <div className="hidden lg:block text-right pointer-events-none">
            <p className="ts-caption text-[10px] text-[#6e8799] tracking-[0.15em] leading-relaxed">
              Drag or rotate to explore crystal lattice.<br />
              Click nodes to inspect provenance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
