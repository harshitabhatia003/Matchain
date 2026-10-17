export type Candidate = {
  formula: string;
  material_hash: string;
  density?: number;
  e_hull?: number;
  predicted_formation_energy?: number;
  consensus_spread?: number;
  status?: string;
};

export type TargetCondition = {
  formation_energy_per_atom?: number;
  band_gap?: number;
  density?: number;
};

export type DiscoveryJob = {
  id: string;
  status: string;
  created_at: number;
  updated_at?: number;
  objective?: string;
  candidates_count: number;
  materials_produced: string[];
  primary_material: string | null;
  target_condition?: TargetCondition;
  diagnostics?: {
    generated?: number;
    geometry_valid?: number;
    geometry_rejected?: number;
    thermodynamic_evaluated?: number;
    e_hull_passed?: number;
    e_hull_rejected?: number;
    jury_evaluated?: number;
    jury_passed?: number;
    jury_rejected?: number;
    final_validated?: number;
    model_availability?: Record<string, boolean>;
    errors?: {
      thermodynamic?: string[];
      geometry?: string[];
      jury?: string[];
    };
    target_matching?: {
      formation_energy?: { target?: number; mean_generated?: number; mae?: number };
      density?: { target?: number; mean_generated?: number; mae?: number };
      band_gap?: { target?: number; mean_generated?: number; mae?: number };
    };
    ensemble_stats?: {
      jury_evaluated?: number;
      jury_passed?: number;
      consensus_rate_pct?: number;
      avg_spread?: number;
      min_spread?: number;
      max_spread?: number;
    };
  };
  elapsed?: number;
  top_candidates?: Candidate[];
};

export type Stats = {
  total_candidates_generated: number;
  structurally_valid_candidates: number;
  thermodynamically_accepted: number;
  registered_materials: number;
  active_marketplace_listings: number;
  completed_licenses: number;
  recent_jobs: DiscoveryJob[];
  recent_transactions: Array<{ hash: string; type: string; status: string }>;
};

export type Material = {
  id: string;
  material_hash?: string;
  job_id?: string;
  formula: string;
  composition: Record<string, number>;
  density: number;
  e_hull: number;
  predicted_formation_energy?: number;
  consensus_spread: number;
  model_predictions?: Record<string, number | null>;
  structure_payload?: {
    lattice?: number[][];
    species?: string[];
    frac_coords?: number[][];
    formula?: string;
  };
  status: string;
};
