import os
import json
import time
import warnings
import numpy as np
import pandas as pd
import streamlit as st
import py3Dmol
from pymatgen.io.cif import CifWriter

warnings.filterwarnings("ignore")

# --- Import Core MatChain Pipeline (Single Source of Truth) ---
from matchain_colab_corrected import (
    get_dataset,
    load_all_models,
    matchain_pipeline,
    register_discovery,
    list_material,
    buy_material,
    _load_json,
    LEDGER_PATH,
    IPFS_STORE_PATH,
    MARKETPLACE_PATH
)

# Page Configuration
st.set_page_config(
    page_title="MatChain — Inverse Materials Discovery",
    page_icon="M",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Inject High-End Obsidian & Titanium Design System
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Outfit:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

html, body, [data-testid="stAppViewContainer"] {
    background-color: #090b10 !important;
    color: #f1f5f9 !important;
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif !important;
}

[data-testid="stSidebar"] {
    background-color: #0c1017 !important;
    border-right: 1px solid rgba(255, 255, 255, 0.08) !important;
}

h1, h2, h3, h4 {
    font-family: 'Outfit', sans-serif !important;
    letter-spacing: -0.02em !important;
    color: #ffffff !important;
}

div[data-testid="stMetricValue"] {
    font-family: 'Outfit', sans-serif !important;
    font-size: 1.75rem !important;
    font-weight: 600 !important;
    color: #f8fafc !important;
}

div[data-testid="metric-container"] {
    background: linear-gradient(145deg, rgba(16, 21, 31, 0.75) 0%, rgba(10, 14, 21, 0.85) 100%) !important;
    border: 1px solid rgba(255, 255, 255, 0.08) !important;
    border-radius: 1rem !important;
    padding: 1rem !important;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4) !important;
    transition: transform 0.2s ease, border-color 0.2s ease !important;
}

div[data-testid="metric-container"]:hover {
    border-color: rgba(255, 255, 255, 0.16) !important;
    transform: translateY(-2px) !important;
}

button[kind="primary"] {
    background: linear-gradient(180deg, #f59e0b 0%, #d97706 100%) !important;
    color: #0a0d14 !important;
    font-weight: 600 !important;
    border: 1px solid rgba(251, 191, 36, 0.4) !important;
    border-radius: 0.75rem !important;
    box-shadow: 0 4px 14px rgba(245, 158, 11, 0.25) !important;
    transition: all 0.2s ease !important;
}

button[kind="primary"]:hover {
    background: linear-gradient(180deg, #fbbf24 0%, #f59e0b 100%) !important;
    transform: translateY(-1px) !important;
}

div[data-baseweb="input"] {
    background-color: rgba(255, 255, 255, 0.03) !important;
    border: 1px solid rgba(255, 255, 255, 0.1) !important;
    border-radius: 0.75rem !important;
}

div[data-testid="stExpander"] {
    background: rgba(14, 18, 27, 0.7) !important;
    border: 1px solid rgba(255, 255, 255, 0.08) !important;
    border-radius: 1rem !important;
    backdrop-filter: blur(12px) !important;
}
</style>
""", unsafe_allow_html=True)

# Application Header & Branding
st.title("MatChain")
st.markdown("### Generative Inverse Design for Materials with Blockchain Provenance")
st.caption("*Property-conditioned Crystal VAE, Multi-Model Ensemble Jury (CHGNet, M3GNet, XGBoost), and Cryptographic Ledger Verification.*")

# --- Streamlit Caching for Performance ---
@st.cache_data(show_spinner=False)
def cached_get_dataset(api_key=None):
    return get_dataset(api_key=api_key)

@st.cache_resource(show_spinner=False)
def cached_load_all_models(_dataset_df):
    return load_all_models(_dataset_df)

# Sidebar Configuration
st.sidebar.title("Control Panel")

# Safe handling of st.secrets for Materials Project API Key
default_api_key = ""
try:
    if "MP_API_KEY" in st.secrets:
        default_api_key = st.secrets["MP_API_KEY"]
except Exception:
    pass

if not default_api_key:
    default_api_key = os.environ.get("MP_API_KEY", "")
mp_api_key = st.sidebar.text_input(
    "Materials Project API Key",
    value=default_api_key,
    type="password",
    help="Optional: Enter a free Materials Project API key. If left blank, MatChain automatically runs on the dataset."
)

tau_threshold = st.sidebar.slider(
    "Ensemble Jury Threshold (τ)",
    min_value=0.05,
    max_value=1.00,
    value=0.15,
    step=0.05,
    help="Maximum normalized spread allowed between model predictions for consensus validation."
)

enable_relaxation = st.sidebar.checkbox(
    "Enable CHGNet Structure Relaxation",
    value=False,
    help="Optionally optimizes generated atomic coordinates using CHGNet StructOptimizer before thermodynamic filtering."
)

role = st.sidebar.radio("Navigation", ["Inventor Dashboard", "Model Performance & Analytics", "Marketplace", "Ledger Explorer"])

# --- Load Core Dataset & Models ---
with st.spinner("Initializing MatChain core engine & loading neural models..."):
    dataset_df = cached_get_dataset(api_key=mp_api_key)
    models = cached_load_all_models(dataset_df)

# Display model availability status in sidebar
availability = models.get("model_availability", {})
st.sidebar.markdown("---")
st.sidebar.subheader("Model Availability Status")
st.sidebar.write(f"• **CHGNet:** {'Active' if availability.get('chgnet') else 'Unavailable'}")
st.sidebar.write(f"• **M3GNet (PES):** {'Active' if availability.get('m3gnet') else 'Unavailable'}")
st.sidebar.write(f"• **XGBoost (Magpie):** {'Active' if availability.get('xgboost') else 'Unavailable'}")

# =========================================================
# NAVIGATION TAB 1: INVENTOR DASHBOARD
# =========================================================
if role == "Inventor Dashboard":
    st.header("Inverse Design Engine")
    
    col_input1, col_input2 = st.columns([2, 1])

    with col_input1:
        prompt = st.text_input(
            "Natural Language Objective (Metadata prompt)",
            "Lightweight alloy for aerospace application",
            help="Descriptive design intent. Numerical targets below drive the inverse VAE generator."
        )
        st.caption("*Note: Numerical property targets below condition the inverse design engine.*")

    with col_input2:
        n_candidates = st.slider(
            "Candidates to Sample",
            min_value=100,
            max_value=1000,
            value=300,
            step=50
        )

    st.subheader("Target Material Properties")
    c1, c2, c3 = st.columns(3)
    with c1:
        form_e = st.slider("Formation Energy (eV/atom)", -4.0, 0.5, -1.5, step=0.1)
    with c2:
        band_gap = st.slider("Band Gap (eV)", 0.0, 6.0, 0.0, step=0.1)
    with c3:
        density = st.slider("Density (g/cm³)", 1.0, 15.0, 5.0, step=0.1)

    if st.button("Run Generation & Validation Pipeline", type="primary"):
        with st.spinner("Generating candidate structures, evaluating thermodynamics & running ensemble jury..."):
            target_condition = {
                "formation_energy_per_atom": form_e,
                "band_gap": band_gap,
                "density": density
            }
            results, elapsed, diagnostics = matchain_pipeline(
                target_condition=target_condition,
                n_candidates=n_candidates,
                tau=tau_threshold,
                top_k=5,
                models=models,
                dataset_df=dataset_df,
                relax=enable_relaxation,
                verbose=False
            )
            st.session_state["pipeline_results"] = results
            st.session_state["pipeline_elapsed"] = elapsed
            st.session_state["pipeline_diagnostics"] = diagnostics

    # Display Pipeline Output & Diagnostics
    if "pipeline_results" in st.session_state:
        results = st.session_state["pipeline_results"]
        elapsed = st.session_state["pipeline_elapsed"]
        diagnostics = st.session_state["pipeline_diagnostics"]

        st.markdown("---")
        
        # High-level Metrics Summary (Exact Accounting)
        m1, m2, m3, m4, m5, m6 = st.columns(6)
        m1.metric("1. Generated", diagnostics.get("generated", 0))
        m2.metric("2. Valid Geometry", diagnostics.get("geometry_valid", 0))
        m3.metric("3. E_hull Evaluated", diagnostics.get("thermodynamic_evaluated", 0))
        m4.metric("4. E_hull Passed", diagnostics.get("e_hull_passed", 0))
        m5.metric("5. Jury Evaluated", diagnostics.get("jury_evaluated", 0))
        m6.metric("6. Final Validated", diagnostics.get("final_validated", 0))

        if results:
            st.success(f"Discovered and validated **{len(results)}** candidate materials in {elapsed:.2f} seconds.")
        else:
            st.warning("Discovered and validated **0** candidate materials.")
            st.info("**Diagnostic Analysis**: See the exact pipeline accounting breakdown below to inspect where candidates were filtered.")

        # Detailed Diagnostic Breakdown Expander
        with st.expander("Exact Pipeline Diagnostic Accounting", expanded=(len(results) == 0)):
            st.caption("*This demo uses a property-conditioned composition+lattice VAE with structure grounding from the Materials Project dataset. It is a simplified stand-in for the full CDVAE described in the paper.*")
            st.markdown("#### Pipeline Filtering Flow (Conservation Laws Enforced)")
            st.write(f"1. **Candidates Generated by VAE:** `{diagnostics.get('generated', 0)}`")
            st.write(f"2. **Geometry Check:** `{diagnostics.get('geometry_valid', 0)}` valid | `{diagnostics.get('geometry_rejected', 0)}` rejected (lattice/collision cutoff $< 0.7\\text{{\\AA}}$)")
            st.write(f"3. **Thermodynamic Filter ($E_{{hull}} < 0.05\\text{{ eV/atom}}$):** `{diagnostics.get('thermodynamic_evaluated', 0)}` evaluated | `{diagnostics.get('e_hull_passed', 0)}` passed | `{diagnostics.get('e_hull_rejected', 0)}` rejected | `{diagnostics.get('e_hull_failed', 0)}` calculation failed")
            st.write(f"4. **Ensemble Jury Consensus ($\\tau \\le {tau_threshold}$):** `{diagnostics.get('jury_evaluated', 0)}` evaluated | `{diagnostics.get('jury_passed', 0)}` passed | `{diagnostics.get('jury_rejected', 0)}` rejected")
            st.write(f"5. **Final Validated Discoveries:** `{diagnostics.get('final_validated', 0)}`")

            errors_dict = diagnostics.get("errors", {})
            if any(errors_dict.values()):
                st.markdown("#### Representative Stage Failure Reasons")
                if errors_dict.get("geometry"):
                    st.write("**Geometry Failures:**")
                    for err in errors_dict["geometry"][:5]:
                        st.caption(f"• `{err}`")
                if errors_dict.get("thermodynamic"):
                    st.write("**Thermodynamic ($E_{hull}$) Failures:**")
                    for err in errors_dict["thermodynamic"][:5]:
                        st.caption(f"• `{err}`")
                if errors_dict.get("jury"):
                    st.write("**Ensemble Jury Failures:**")
                    for err in errors_dict["jury"][:5]:
                        st.caption(f"• `{err}`")

            # Per-Candidate Prediction Table
            candidate_details = diagnostics.get("candidate_details", [])
            if candidate_details:
                st.markdown("#### Evaluated Candidate Predictions & Spread")
                table_rows = []
                for d in candidate_details:
                    preds = d.get("model_preds", {})
                    table_rows.append({
                        "Formula": d["formula"],
                        "E_hull (eV/atom)": f"{d['e_hull']:.4f}",
                        "Mean Pred (eV/atom)": f"{d['mean_pred']:.4f}",
                        "Spread (τ)": f"{d['spread']:.4f}",
                        "CHGNet": f"{preds.get('chgnet', 0.0):.4f}" if preds.get("chgnet") is not None else "N/A",
                        "M3GNet": f"{preds.get('m3gnet', 0.0):.4f}" if preds.get("m3gnet") is not None else "N/A",
                        "XGBoost": f"{preds.get('xgboost', 0.0):.4f}" if preds.get("xgboost") is not None else "N/A",
                        "Status": d["status"]
                    })
                st.table(pd.DataFrame(table_rows))

        # Render Candidates Display Cards & 3D Visualizer
        if results:
            st.subheader("Validated Top Candidate Discoveries")
            for idx, res in enumerate(results):
                struct = res["structure"]
                formula = struct.composition.reduced_formula
                
                with st.expander(f"Material #{idx+1}: {formula} (Spread τ = {res['consensus_spread']:.4f})", expanded=(idx == 0)):
                    c_col1, c_col2 = st.columns([1, 1])
                    with c_col1:
                        st.markdown(f"**Predicted Formation Energy:** `{res['predicted_formation_energy']:.4f} eV/atom`")
                        st.markdown(f"**Energy Above Hull ($E_{{hull}}$):** `{res['e_hull']:.4f} eV/atom`")
                        st.markdown(f"**Ensemble Spread (τ):** `{res['consensus_spread']:.4f}`")
                        st.write(f"**Lattice Parameters:** a={struct.lattice.a:.2f}Å, b={struct.lattice.b:.2f}Å, c={struct.lattice.c:.2f}Å")
                        st.write(f"**Volume:** {struct.lattice.volume:.2f} Å³ | **Density:** {struct.density:.2f} g/cm³")
                        
                        # Model Breakdown
                        st.markdown("**Ensemble Jury Predictions:**")
                        m_preds = res["model_predictions"]
                        st.write(f"• CHGNet: `{m_preds.get('chgnet', 'N/A')}`")
                        st.write(f"• M3GNet: `{m_preds.get('m3gnet', 'N/A')}`")
                        st.write(f"• XGBoost: `{m_preds.get('xgboost', 'N/A')}`")

                        # Register on Blockchain Button
                        if st.button(f"Register {formula} on Blockchain Ledger", key=f"reg_{idx}"):
                            block = register_discovery(
                                struct,
                                creator_id="Inventor_0x71C...",
                                predicted_properties={
                                    "formation_energy": res["predicted_formation_energy"],
                                    "e_hull": res["e_hull"],
                                    "spread": res["consensus_spread"]
                                }
                            )
                            st.success(f"Registered on Ledger! Block Index #{block['block_index']} | Hash: `{block['structure_hash'][:16]}...`")

                    with c_col2:
                        st.markdown("**3D Crystal Structure View**")
                        try:
                            cw = CifWriter(struct)
                            cif_str = str(cw)
                            view = py3Dmol.view(width=400, height=300)
                            view.addModel(cif_str, "cif")
                            view.setStyle({'sphere': {'scale': 0.25}, 'stick': {'radius': 0.15}})
                            view.addUnitCell()
                            view.zoomTo()
                            st.components.v1.html(view._make_html(), height=310)
                        except Exception as e:
                            st.error(f"3D view rendering error: {e}")

# =========================================================
# NAVIGATION TAB 2: MODEL PERFORMANCE & ANALYTICS
# =========================================================
elif role == "Model Performance & Analytics":
    st.header("Model Performance & Evaluation Analytics")
    st.caption("*Quantitative evaluation of surrogate models on a 20% held-out test set from Materials Project (eV/atom), VAE training loss curves, and inverse design target matching.*")

    eval_results = models.get("eval_results", {})

    st.subheader("1. Surrogate Model Performance Summary Table")
    st.markdown("Metrics evaluated on held-out test structures not seen during XGBoost training or elemental reference fitting.")

    table_data = []
    for model_key, model_name in [("xgboost", "XGBoost (Magpie)"), ("chgnet", "CHGNet v0.3.0"), ("m3gnet", "M3GNet (MatPES)")]:
        res = eval_results.get(model_key)
        if res is not None:
            table_data.append({
                "Model": model_name,
                "R² Score": f"{res['r2']:.4f}",
                "MAE (eV/atom)": f"{res['mae']:.4f}",
                "RMSE (eV/atom)": f"{res['rmse']:.4f}",
                "Mean Bias (eV/atom)": f"{res['mean_bias']:.4f}",
                "Max Abs Err (eV/atom)": f"{res['max_abs_err']:.4f}",
                "Test Samples (N)": res["n_test"]
            })
        else:
            table_data.append({
                "Model": model_name,
                "R² Score": "Unavailable",
                "MAE (eV/atom)": "Unavailable",
                "RMSE (eV/atom)": "Unavailable",
                "Mean Bias (eV/atom)": "Unavailable",
                "Max Abs Err (eV/atom)": "Unavailable",
                "Test Samples (N)": 0
            })

    st.table(pd.DataFrame(table_data))

    # --- Actual vs Predicted Scatter Plots ---
    st.subheader("2. Actual vs. Predicted Formation Energy Scatter Plots")
    col_p1, col_p2, col_p3 = st.columns(3)

    for col, (model_key, model_name) in zip([col_p1, col_p2, col_p3], [("xgboost", "XGBoost"), ("chgnet", "CHGNet"), ("m3gnet", "M3GNet")]):
        with col:
            res = eval_results.get(model_key)
            if res and res.get("y_true") and res.get("y_pred"):
                df_plot = pd.DataFrame({"Actual (eV/atom)": res["y_true"], "Predicted (eV/atom)": res["y_pred"]})
                st.markdown(f"**{model_name} Prediction Scatter**")
                st.scatter_chart(df_plot, x="Actual (eV/atom)", y="Predicted (eV/atom)")
            else:
                st.info(f"Scatter plot for {model_name} unavailable.")

    # --- Prediction Error Distribution Histograms ---
    st.subheader("3. Prediction Error Distribution (y_pred - y_true)")
    col_e1, col_e2, col_e3 = st.columns(3)

    for col, (model_key, model_name) in zip([col_e1, col_e2, col_e3], [("xgboost", "XGBoost"), ("chgnet", "CHGNet"), ("m3gnet", "M3GNet")]):
        with col:
            res = eval_results.get(model_key)
            if res and res.get("errors"):
                st.markdown(f"**{model_name} Error Spread**")
                hist_vals, hist_bins = np.histogram(res["errors"], bins=12)
                df_hist = pd.DataFrame({"Count": hist_vals}, index=[f"{hist_bins[i]:.2f}" for i in range(len(hist_vals))])
                st.bar_chart(df_hist)
            else:
                st.info(f"Error distribution for {model_name} unavailable.")

    # --- VAE Loss Curve ---
    st.subheader("4. Property-Conditioned Crystal VAE Training Loss")
    vae_history = models.get("vae_history", {})
    if vae_history and "total_loss" in vae_history:
        v_c1, v_c2, v_c3 = st.columns(3)
        v_c1.metric("Final Total Loss", f"{vae_history['total_loss'][-1]:.4f}")
        v_c2.metric("Final Recon Loss", f"{vae_history['reconstruction_loss'][-1]:.4f}")
        v_c3.metric("Final KL Loss", f"{vae_history['kl_loss'][-1]:.4f}")

        df_vae = pd.DataFrame({
            "Epoch": vae_history["epochs"],
            "Total Loss": vae_history["total_loss"],
            "Reconstruction Loss": vae_history["reconstruction_loss"],
            "KL Loss": vae_history["kl_loss"]
        }).set_index("Epoch")
        st.line_chart(df_vae)
    else:
        st.info("VAE Loss history unavailable.")

    # --- Pipeline & Jury Statistics ---
    st.subheader("5. Latest Run Generation & Pipeline Analytics")
    if "pipeline_diagnostics" in st.session_state:
        diag = st.session_state["pipeline_diagnostics"]
        t_match = diag.get("target_matching", {})
        ens_stats = diag.get("ensemble_stats", {})

        st.markdown("#### Inverse Design Target Matching (Requested vs Generated)")
        tm_c1, tm_c2, tm_c3 = st.columns(3)

        fe_match = t_match.get("formation_energy", {})
        if fe_match.get("target") is not None and fe_match.get("mean_generated") is not None:
            tm_c1.metric("Formation Energy Target", f"{fe_match['target']:.2f} eV/atom", f"Gen Mean: {fe_match['mean_generated']:.2f} | MAE: {fe_match['mae']:.2f}")

        de_match = t_match.get("density", {})
        if de_match.get("target") is not None and de_match.get("mean_generated") is not None:
            tm_c2.metric("Density Target", f"{de_match['target']:.2f} g/cm³", f"Gen Mean: {de_match['mean_generated']:.2f} | MAE: {de_match['mae']:.2f}")

        bg_match = t_match.get("band_gap", {})
        if bg_match.get("target") is not None:
            tm_c3.metric("Band Gap Target", f"{bg_match['target']:.2f} eV", "Conditioning Enabled")

        st.markdown("#### Stage Conversion Pass Rates")
        p_c1, p_c2, p_c3, p_c4 = st.columns(4)
        gen_cnt = diag.get("generated", 1)
        geo_valid = diag.get("geometry_valid", 0)
        e_eval = diag.get("thermodynamic_evaluated", 0)
        e_pass = diag.get("e_hull_passed", 0)
        j_eval = diag.get("jury_evaluated", 0)
        j_pass = diag.get("jury_passed", 0)

        p_c1.metric("Geometry Pass Rate", f"{(geo_valid / max(1, gen_cnt) * 100):.1f}%", f"{geo_valid} / {gen_cnt}")
        p_c2.metric("E_hull Pass Rate", f"{(e_pass / max(1, e_eval) * 100):.1f}%", f"{e_pass} / {e_eval}")
        p_c3.metric("Jury Consensus Rate", f"{(j_pass / max(1, j_eval) * 100):.1f}%", f"{j_pass} / {j_eval}")
        p_c4.metric("Final Validation Rate", f"{(j_pass / max(1, gen_cnt) * 100):.1f}%", f"{j_pass} / {gen_cnt}")
    else:
        st.info("Run the Inverse Design Pipeline on the Inventor Dashboard tab to generate target matching & stage conversion pass rate analytics.")

# =========================================================
# NAVIGATION TAB 3: MARKETPLACE
# =========================================================
elif role == "Marketplace":
    st.header("Decentralized Materials Marketplace")
    st.caption("Trade validated crystal discoveries with simulated IPFS content keys.")
    
    market = _load_json(MARKETPLACE_PATH, {})
    ledger = _load_json(LEDGER_PATH, [])
    
    col_m1, col_m2 = st.columns([1, 1])

    with col_m1:
        st.subheader("Active Listings")
        if not market:
            st.info("No active marketplace listings.")
        else:
            for h, item in list(market.items()):
                status_badge = "[Sold]" if item.get("sold") else "[Available]"
                st.write(f"**Hash:** `{h[:16]}...` | **Price:** `{item['price']} ETH` | {status_badge}")
                if not item.get("sold"):
                    if st.button(f"Buy Material ({h[:8]})", key=f"buy_{h}"):
                        res = buy_material(h, "Buyer_0x3F8...")
                        if res["status"] == "success":
                            st.success(f"Purchase Successful! Download Key: `{res['download_key']}`")
                        else:
                            st.error(f"Purchase Error: {res['status']}")

    with col_m2:
        st.subheader("List Discovery for Sale")
        if not ledger:
            st.warning("No discoveries registered on ledger yet.")
        else:
            opts = [b["structure_hash"] for b in ledger]
            sel_hash = st.selectbox("Select Registered Discovery", opts)
            price = st.number_input("Listing Price (ETH)", min_value=0.01, max_value=100.0, value=1.5, step=0.1)
            terms = st.text_input("License Terms", "academic-open-license")
            if st.button("List Material on Marketplace"):
                res = list_material(sel_hash, price, terms)
                st.success(f"Listed {sel_hash[:16]}... for {price} ETH!")

# =========================================================
# NAVIGATION TAB 4: LEDGER EXPLORER
# =========================================================
elif role == "Ledger Explorer":
    st.header("Blockchain Ledger Provenance Explorer")
    st.caption("Cryptographic audit trail of registered material discoveries.")

    ledger = _load_json(LEDGER_PATH, [])
    if not ledger:
        st.info("Ledger is currently empty. Run the pipeline and click 'Register on Blockchain Ledger' to create blocks.")
    else:
        st.subheader(f"Total Blocks Mined: {len(ledger)}")
        for block in reversed(ledger):
            with st.expander(f"Block #{block['block_index']} — Formula: {block['metadata'].get('formula', 'N/A')}", expanded=False):
                st.json(block)
