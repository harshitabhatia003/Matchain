# MatChain: AI-Assisted Materials Discovery & Provenance Platform

[![Python Version](https://img.shields.io/badge/python-3.12-blue.svg)](https://www.python.org/downloads/release/python-3120/)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)](https://nodejs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev/)
[![Hardhat](https://img.shields.io/badge/Hardhat-2.22-yellow.svg)](https://hardhat.org/)
[![IPFS](https://img.shields.io/badge/IPFS-Kubo-65C2CB.svg)](https://ipfs.tech/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

MatChain is an end-to-end materials discovery and decentralized intellectual property platform. It pairs a **CrystalVAE-style generative AI pipeline** with thermodynamic stability screening, a **FastAPI** backend, a modern **React + Vite** frontend, a local **EVM smart contract layer** (registry and licensing marketplace), and **IPFS content-addressed storage** secured by **AES-256-GCM authenticated encryption**.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Repository Structure](#repository-structure)
4. [Step-by-Step Installation (Windows PowerShell)](#step-by-step-installation-windows-powershell)
   - [Step 1: Clone Repository](#step-1-clone-repository)
   - [Step 2: Backend Setup (Python 3.12)](#step-2-backend-setup-python-312)
   - [Step 3: Frontend Setup (Node.js & Vite)](#step-3-frontend-setup-nodejs--vite)
   - [Step 4: Smart Contracts Setup (Hardhat & Ganache)](#step-4-smart-contracts-setup-hardhat--ganache)
   - [Step 5: Environment Variables Configuration](#step-5-environment-variables-configuration)
   - [Step 6: Optional Services Setup (IPFS & Firebase)](#step-6-optional-services-setup-ipfs--firebase)
5. [Running MatChain Locally (Multi-Terminal Guide)](#running-matchain-locally-multi-terminal-guide)
   - [Service Port & URL Reference](#service-port--url-reference)
   - [Terminal 1: Local Blockchain](#terminal-1-local-blockchain)
   - [Terminal 2: Smart Contract Deployment](#terminal-2-smart-contract-deployment)
   - [Terminal 3: FastAPI Backend](#terminal-3-fastapi-backend)
   - [Terminal 4: React Frontend](#terminal-4-react-frontend)
   - [Terminal 5: IPFS Kubo Daemon (Optional)](#terminal-5-ipfs-kubo-daemon-optional)
6. [MetaMask Wallet Setup](#metamask-wallet-setup)
7. [Security & Access-Control Architecture](#security--access-control-architecture)
   - [IPFS Content Protection (AES-256-GCM)](#ipfs-content-protection-aes-256-gcm)
   - [Buyer vs. Seller Access Control Matrix](#buyer-vs-seller-access-control-matrix)
   - [On-Chain Purchase Verification](#on-chain-purchase-verification)
8. [Verification & Testing](#verification--testing)
9. [Troubleshooting Guide](#troubleshooting-guide)
10. [Local Environment Cleanup & Reset](#local-environment-cleanup--reset)
11. [Commands to Push to GitHub](#commands-to-push-to-github)

---

## Architecture Overview

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                        React + Vite Frontend                           │
 │        (Dashboard, Discovery, IPFS Hub, Marketplace, Registry)        │
 └──────────────────┬─────────────────────────────────┬───────────────────┘
                    │ REST API Calls                  │ MetaMask (Web3 Ethers)
                    ▼                                 ▼
 ┌──────────────────────────────────────┐  ┌──────────────────────────────┐
 │         FastAPI Backend              │  │    Local Blockchain (EVM)    │
 │  • Discovery Queue & ML Engine       │  │ • MatChainRegistry.sol       │
 │  • AES-256-GCM Encryption Layer      │  │ • MatChainMarketplace.sol    │
 │  • Server-Side Purchase Verification │  │   (Chain ID: 1337)           │
 └─────────┬──────────────────┬─────────┘  └──────────────────────────────┘
           │                  │
           ▼                  ▼
 ┌───────────────────┐  ┌─────────────────────────────────────────────────┐
 │ SQLite Database   │  │ IPFS / Kubo Storage Layer                       │
 │ • Jobs & Results  │  │ • Pinned Ciphertext Objects (CIDv1 Raw SHA-256) │
 │ • Access Records  │  │ • Local Cache Fallback (matchain_ipfs_store.json)│
 │ • Secret Keys     │  │ • Public Gateway Links (ipfs.io, dweb.link)     │
 └───────────────────┘  └─────────────────────────────────────────────────┘
```

1. **AI Discovery Engine**: Generates crystal structures targeting specific density, band gap, and formation energy using a variational autoencoder (VAE) coupled with thermodynamic convex hull energy ($E_{\text{hull}}$) and model consensus screening (XGBoost, MatMiner, PyMatGen, optional CHGNet/M3GNet).
2. **Confidential Storage (IPFS + AES-256)**: When sellers upload crystal structure files (`.cif`, `POSCAR`), the backend encrypts them with AES-256-GCM before pinning them to IPFS. The decryption key is held securely in the backend database.
3. **Smart Contract Registry & Marketplace**: Tracks immutable SHA-256 crystal fingerprints on-chain and manages licensing escrow. Purchases are confirmed directly through smart contract storage.

---

## Prerequisites

Before setting up MatChain, ensure the following tools are installed on your computer:

| Tool | Required? | Recommended Version | Purpose | Download Link |
| :--- | :---: | :--- | :--- | :--- |
| **Git** | **Mandatory** | Latest | Clone and manage the codebase | [git-scm.com](https://git-scm.com/downloads) |
| **Python** | **Mandatory** | **3.12.x (64-bit)** | Backend API, PyTorch, PyMatGen, MatMiner | [python.org/downloads](https://www.python.org/downloads/release/python-3120/) |
| **Node.js & npm** | **Mandatory** | **v18 LTS or v20 LTS** | React frontend and Hardhat compiler | [nodejs.org](https://nodejs.org/en/download/) |
| **Ganache** | **Mandatory** | CLI or v7.9+ | Local Ethereum blockchain (Chain ID 1337) | [trufflesuite.com/ganache](https://trufflesuite.com/ganache/) |
| **MetaMask** | **Mandatory** | Browser Extension | Web3 wallet for signing on-chain transactions | [metamask.io](https://metamask.io/download/) |
| **IPFS / Kubo** | Optional | v0.24+ | Local IPFS daemon for decentralized storage | [docs.ipfs.tech/install/kubo](https://docs.ipfs.tech/install/command-line/) |
| **Materials Project API Key** | Optional | v2 REST Key | Live crystal dataset queries | [materialsproject.org/api](https://next-gen.materialsproject.org/api) |

> [!IMPORTANT]
> **Python Version Warning:** Python **3.12** is strongly recommended. Python 3.13 is currently incompatible with pre-compiled wheels for scientific packages used in this stack (`pymatgen`, `matminer`, `torch 2.2.1`).

---

## Repository Structure

```
Matchain/
├── backend/                        # FastAPI Application
│   ├── app/
│   │   ├── main.py                 # API router and entrypoint
│   │   ├── config.py               # Settings & environment parser
│   │   ├── auth.py                 # Bearer & Web3 wallet authentication
│   │   ├── schemas.py              # Pydantic request/response schemas
│   │   └── services/
│   │       ├── matchain_service.py # Discovery pipeline coordinator
│   │       ├── storage_service.py  # IPFS client & AES-256-GCM crypto
│   │       ├── blockchain_service.py# Web3 contract integration
│   │       ├── jobs_store.py       # Discovery job persistence
│   │       └── material_access_store.py # Confidential key & access store
│   ├── data/                       # Local SQLite database (matchain.sqlite3)
│   ├── requirements.txt            # Python dependencies
│   └── tests/                      # Pytest test suite (17 automated tests)
├── frontend/                       # React 18 + Vite Web Application
│   ├── src/
│   │   ├── pages/                  # Storage, Marketplace, Registry, Discovery, Dashboard
│   │   ├── components/             # Reusable UI & IpfsShareModal
│   │   ├── context/                # AuthContext (Firebase + Wallet link)
│   │   ├── services/               # Contract client & Web3 wallet provider
│   │   └── lib/                    # API client (with auth injection & download)
│   ├── package.json                # Frontend dependencies
│   └── vite.config.ts              # Vite configuration
├── contracts/                      # Hardhat Smart Contracts
│   ├── contracts/
│   │   ├── MatChainRegistry.sol    # Crystal provenance registry
│   │   └── MatChainMarketplace.sol # Licensing escrow marketplace
│   ├── scripts/
│   │   ├── deploy.js               # Contract deployment & auto-config
│   │   └── ganache-e2e.js          # Automated end-to-end blockchain test
│   ├── hardhat.config.js           # Hardhat network configuration
│   └── package.json                # Hardhat & Ganache dependencies
├── matchain_colab_corrected.py     # Core scientific discovery pipeline
├── matchain_ipfs_store.json        # Offline fallback IPFS key-value store
├── .env.example                    # Template environment variables
└── README.md                       # Documentation
```

---

## Step-by-Step Installation (Windows PowerShell)

Open **Windows PowerShell** (or Terminal) and follow these steps:

### Step 1: Clone Repository

```powershell
git clone <YOUR_REPOSITORY_URL>
cd matchain-new/Matchain
```

### Step 2: Backend Setup (Python 3.12)

1. Check your Python version:
   ```powershell
   py --version
   ```
   *(Ensure it reports Python 3.12.x)*

2. Create and activate a virtual environment:
   ```powershell
   cd backend
   py -3.12 -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```
   *(If PowerShell displays a script execution policy error, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` and retry).*

3. Upgrade `pip` and install dependencies:
   ```powershell
   python -m pip install --upgrade pip
   pip install -r requirements.txt
   pip install pycryptodome
   ```

4. Return to the project root:
   ```powershell
   cd ..
   ```

### Step 3: Frontend Setup (Node.js & Vite)

1. Navigate to the frontend directory:
   ```powershell
   cd frontend
   ```

2. Install Node dependencies:
   ```powershell
   npm install
   ```

3. Return to the root directory:
   ```powershell
   cd ..
   ```

### Step 4: Smart Contracts Setup (Hardhat & Ganache)

1. Navigate to the contracts directory:
   ```powershell
   cd contracts
   ```

2. Install dependencies:
   ```powershell
   npm install
   ```

3. Compile the Solidity contracts:
   ```powershell
   npm run compile
   ```

4. Return to the root directory:
   ```powershell
   cd ..
   ```

### Step 5: Environment Variables Configuration

Copy the example environment file to `.env`:

```powershell
# In the root directory:
Copy-Item .env.example .env
```

Here is an explanation of the environment variables in `.env`:

```ini
# --- Backend Settings ---
MP_API_KEY=                         # (Optional) Materials Project API key. If empty, uses synthetic fallback.
BACKEND_PORT=8000                  # Port for FastAPI (default: 8000)
FRONTEND_URL=http://localhost:5173  # URL for CORS allowance
GANACHE_RPC_URL=http://127.0.0.1:8545 # RPC endpoint of your local blockchain
GANACHE_CHAIN_ID=1337               # Chain ID of Ganache / Local EVM
BLOCKCHAIN_ACCOUNT=                 # (Optional) Unlocked account for backend-signed transactions
CONTRACT_REGISTRY_ADDRESS=          # Auto-populated by deployment script
CONTRACT_MARKETPLACE_ADDRESS=       # Auto-populated by deployment script
IPFS_API_URL=http://127.0.0.1:5001   # Local Kubo RPC endpoint
IPFS_GATEWAY_URL=http://127.0.0.1:8080/ipfs # Local gateway URL
IPFS_TIMEOUT_SECONDS=20             # IPFS timeout in seconds
DATABASE_PATH=backend/data/matchain.sqlite3 # Path to SQLite database

# --- Frontend Settings ---
VITE_API_URL=http://localhost:8000  # Backend endpoint URL
VITE_CHAIN_ID=1337                  # Blockchain chain ID
VITE_CHAIN_NAME="Ganache Local"     # Display name in MetaMask prompt
VITE_GANACHE_RPC_URL=http://127.0.0.1:8545 # RPC endpoint queried by frontend
VITE_CONTRACT_REGISTRY_ADDRESS=     # Auto-populated by deployment script
VITE_CONTRACT_MARKETPLACE_ADDRESS=  # Auto-populated by deployment script
```

> [!NOTE]
> When you deploy the smart contracts (Step 4 / Terminal 2), the deployment script **automatically updates** both `.env` and `frontend/.env.local` with the deployed contract addresses! You do not need to paste them manually.

### Step 6: Optional Services Setup (IPFS & Firebase)

#### IPFS Kubo Daemon Setup (Optional)
If you wish to run a live IPFS node rather than the offline store fallback:
1. Download Kubo from [dist.ipfs.tech/#kubo](https://dist.ipfs.tech/#kubo) or install via chocolatey: `choco install ipfs`.
2. Initialize and configure CORS (so the web app can communicate with it):
   ```powershell
   ipfs init
   ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["*"]'
   ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["PUT", "POST", "GET"]'
   ```

#### Firebase Authentication Setup (Optional)
MatChain comes with a built-in guest login mode. If you want full Firebase email and Google sign-in:
1. Create a free project at [console.firebase.google.com](https://console.firebase.google.com/).
2. Enable **Authentication** (Email/Password & Google) and **Firestore** (Test Mode).
3. Add a Web App and place the credentials in `frontend/.env.local`:
   ```ini
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-app
   VITE_FIREBASE_STORAGE_BUCKET=your-app.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
   ```

---

## Running MatChain Locally (Multi-Terminal Guide)

To run the complete platform, open **4 separate PowerShell terminal windows**.

### Service Port & URL Reference

| Service | Working Directory | Command | URL |
| :--- | :--- | :--- | :--- |
| **Local Blockchain (Ganache)** | `contracts` | `npm run node` | `http://127.0.0.1:8545` (or `7545`) |
| **FastAPI Backend** | `backend` | `python -m uvicorn app.main:app --reload` | `http://127.0.0.1:8000` |
| **API Documentation (Swagger)** | — | — | `http://127.0.0.1:8000/docs` |
| **React Frontend (Vite)** | `frontend` | `npm run dev` | `http://127.0.0.1:5173` |
| **IPFS Kubo Daemon** *(Optional)* | Any | `ipfs daemon` | `http://127.0.0.1:5001` (Gateway: `8080`) |

---

### Terminal 1: Local Blockchain
In your first terminal, start the local Ganache EVM blockchain:

```powershell
cd Matchain/contracts
npm run node
```
*Keep this terminal open.* Ganache will listen on `127.0.0.1:8545` (Chain ID `1337`) and display 10 pre-funded test accounts with 10,000 ETH each.

---

### Terminal 2: Smart Contract Deployment
In a second terminal, deploy the contracts onto your running local node:

```powershell
cd Matchain/contracts
npm run deploy
```
*Expected Output:*
```
MatChainRegistry deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
MatChainMarketplace deployed to: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
Updated frontend/.env.local for the persistent local network.
Updated .env with matching backend Ganache/contract settings.
```
*(This terminal can be closed after deployment finishes, or kept for running tests).*

---

### Terminal 3: FastAPI Backend
In your third terminal, start the Python backend:

```powershell
cd Matchain/backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
*Verify in your browser:* Visit [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health) to confirm the blockchain and storage services are connected.

---

### Terminal 4: React Frontend
In your fourth terminal, start the frontend development server:

```powershell
cd Matchain/frontend
npm run dev
```
*Open in your browser:* [http://localhost:5173](http://localhost:5173).

---

### Terminal 5: IPFS Kubo Daemon (Optional)
If you installed the local Kubo IPFS daemon:

```powershell
ipfs daemon
```
*If this daemon is not running, MatChain will seamlessly use its local JSON fallback cache (`matchain_ipfs_store.json`), allowing full offline functionality.*

---

## MetaMask Wallet Setup

To interact with on-chain material registration and marketplace licensing:

1. Open MetaMask in your browser and click on the **Network selector** (top-left) > **Add a network** > **Add a network manually**:
   - **Network Name**: `Ganache Local`
   - **New RPC URL**: `http://127.0.0.1:8545` *(or `http://127.0.0.1:7545` depending on your Ganache port)*
   - **Chain ID**: `1337`
   - **Currency Symbol**: `ETH`
2. Save and switch to the `Ganache Local` network.
3. Import a pre-funded test account:
   - In MetaMask, click your **Account avatar** > **Add account or hardware wallet** > **Import account**.
   - Copy one of the Private Keys displayed in **Terminal 1** (Ganache) and paste it into MetaMask.
   - The account will immediately display a 10,000 ETH test balance.

---

## Materials IP Marketplace Architecture (Buyer, Seller, Validator)

The MatChain marketplace operates as a decentralized intellectual property protocol tailored for crystal structures, pairing automated smart contract escrow with off-chain AES-256-GCM encrypted IPFS delivery and a cryptoeconomic **Proof-of-Validation** consensus model:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        3-ROLE MARKETPLACE ENGINE                       │
├────────────────────────────────────────────────────────────────────────┤
│ 🛒 BUYER CATALOG                                                       │
│ • Filter by application: Battery, Solar/Perovskite, Superconductor     │
│ • Obfuscated 3D Crystal preview (masks fractional coordinates)         │
│ • 1-Click MetaMask escrow purchase (0.1 ETH)                           │
│ • "My Purchased Vault": Decrypted CIF download & License Certificate   │
├────────────────────────────────────────────────────────────────────────┤
│ 💼 SELLER STUDIO                                                       │
│ • Selects AI candidates from Discovery Hub or custom CIF upload        │
│ • Sets pricing in ETH and chooses licensing terms (Research/Commercial)│
│ • Automated AES-256-GCM encryption & IPFS pinning                      │
│ • Real-time revenue analytics: Total ETH earned & license sales counter│
├────────────────────────────────────────────────────────────────────────┤
│ 🛡️ VALIDATOR HUB (Proof-of-Validation Consensus Engine)               │
│ • Requires 0.05 ETH security bond stake (Skin in the Game)             │
│ • Audit Queue: Physics screening pipeline (E_hull <= 0.05 eV/atom,     │
│   atomic distance packing, and multi-model jury consensus)            │
│ • 1-Click "Approve & Stake Attestation" stamps Verified badge on-chain│
│ • Earns 5% protocol fee reward; dishonest approvals are slashed       │
│ • 48-hour dispute / challenge window protects against fraud            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Security & Access-Control Architecture

### IPFS Content Protection (AES-256-GCM)

> [!WARNING]
> **IPFS Is Globally Public**: Any unencrypted file pinned to IPFS can be retrieved by anyone in the world who knows or scans for its CID. Hiding the CID in frontend JavaScript does not provide confidentiality.

To guarantee true confidentiality for proprietary crystal structures:
1. **Server-Side Encryption**: When a seller uploads a `.cif` or `POSCAR` structure file, the backend generates a random 256-bit key and encrypts the content using **AES-256-GCM**.
2. **Ciphertext on IPFS**: Only the encrypted ciphertext is pinned to IPFS or published to gateways. The resulting CID points strictly to ciphertext.
3. **Key Isolation**: The decryption key, initialization vector (nonce), and authentication tag are stored exclusively in the backend SQLite database (`material_access_records`). **Keys are never placed on-chain or sent to unauthorized clients.**

### Buyer vs. Seller Access Control Matrix

| Feature / Data | Unauthenticated | Authenticated Buyer (Before Purchase) | Authenticated Buyer (After Purchase) | Seller (Material Owner) | Validator |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Public Metadata** (`formula`, `density`, `price`) | Allowed | Allowed | Allowed | Allowed | Allowed |
| **Material Private CID / IPFS URI** | ❌ Blocked | ❌ Blocked | ❌ **Permanently Hidden** | Allowed | ❌ Blocked |
| **IPFS Gateway Links & Share Modal** | ❌ Blocked | ❌ Blocked | ❌ Blocked | Allowed | ❌ Blocked |
| **Storage Pins Listing** (`/api/storage/pins`) | `401 Unauthorized` | Shows only buyer's own uploads | Shows only buyer's own uploads | Shows seller's own CIDs | Shows own uploads |
| **Content Retrieval** (`/api/storage/content/{cid}`) | `401 Unauthorized` | `403 Forbidden` | Decrypted data (CID omitted) | Decrypted data + CID | Decrypted audit screen |
| **Authorized File Download** (`/api/storage/download/{id}`) | `401 Unauthorized` | `403 Forbidden` | Decrypted file download | Decrypted file download | ❌ Blocked |

### On-Chain Purchase Verification

Purchase verification is strictly enforced server-side:
1. When a buyer executes `purchaseMaterial(bytes32 materialHash)` via MetaMask, the `MatChainMarketplace.sol` smart contract records `sold = true` and `buyer = msg.sender`.
2. When the buyer requests their licensed material file via `GET /api/storage/download/{material_hash}`, the backend queries the contract:
   ```python
   listing = self.marketplace.functions.listings(digest).call()
   if listing[5] and listing[2].lower() == user.wallet_address.lower():
       # Authorized: Decrypt ciphertext in-memory and stream attachment
   ```
3. The server never relies on client-side state, unauthenticated request headers, or simple query flags.

---

## Verification & Testing

### 1. Run Backend Automated Tests (21/21 Tests)

Activate the backend virtual environment and execute `pytest`:

```powershell
cd Matchain/backend
.\.venv\Scripts\Activate.ps1
python -m pytest tests -v
```

*Expected output:*
```
tests/test_access_control.py::test_1_seller_can_upload_and_retrieve_own_material_cid PASSED
tests/test_access_control.py::test_2_another_seller_cannot_retrieve_that_cid PASSED
tests/test_access_control.py::test_3_authenticated_buyer_cannot_retrieve_cid_before_purchasing PASSED
tests/test_access_control.py::test_4_buyer_cannot_access_restricted_file_contents_using_known_cid PASSED
tests/test_access_control.py::test_5_buyer_with_verified_purchase_receives_only_allowed_access PASSED
tests/test_access_control.py::test_6_unauthenticated_user_cannot_access_private_material PASSED
tests/test_access_control.py::test_7_pins_content_raw_and_share_endpoints_cannot_bypass_authorization PASSED
tests/test_access_control.py::test_8_public_material_metadata_remains_accessible PASSED
tests/test_blockchain_service.py::test_transaction_requires_configured_signer_and_successful_mined_receipt PASSED
tests/test_blockchain_service.py::test_deployment_manifest_detects_chain_reset_and_wrong_marketplace_link PASSED
tests/test_blockchain_service.py::test_contract_loader_checks_address_has_code_and_chain PASSED
tests/test_marketplace.py::test_marketplace_stats PASSED
tests/test_marketplace.py::test_marketplace_audit PASSED
tests/test_marketplace.py::test_marketplace_validate_attestation PASSED
tests/test_marketplace.py::test_marketplace_listings_enriched PASSED
tests/test_persistence_and_storage.py::test_jobs_survive_restart_and_running_jobs_are_marked_interrupted PASSED
tests/test_persistence_and_storage.py::test_discovery_service_persists_completed_results_and_material_views PASSED
tests/test_persistence_and_storage.py::test_storage_uses_explicit_local_json_fallback PASSED
tests/test_persistence_and_storage.py::test_storage_uses_configured_ipfs_api PASSED
tests/test_persistence_and_storage.py::test_storage_service_upload_file_and_get_content PASSED
tests/test_persistence_and_storage.py::test_cidv1_computation_standard_format PASSED
======================= 21 passed in 43.07s =======================
```

### 2. Run Frontend Build & Type Check

```powershell
cd Matchain/frontend
npm run build
```
*(Confirms `tsc -b` and `vite build` complete with zero errors).*

### 3. Run Smart Contract Tests

```powershell
cd Matchain/contracts
npm test
```

---

## Troubleshooting Guide

### 1. Python Dependency Issues (`pymatgen` or `torch` fails to install)
- **Cause**: Using Python 3.13 or 32-bit Python.
- **Solution**: Install **Python 3.12 (64-bit)** from [python.org](https://www.python.org/downloads/release/python-3120/). Recreate the virtual environment using `py -3.12 -m venv .venv`.

### 2. PowerShell Script Execution Blocked (`Activate.ps1 cannot be loaded`)
- **Cause**: Windows execution policy restricts running unsigned local scripts.
- **Solution**: Run this command once in your PowerShell session:
  ```powershell
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
  ```

### 3. Blockchain Connection Failed (`HTTP 503: Contract is not available`)
- **Cause**: Contracts have not been deployed to the active Ganache instance, or Ganache was restarted.
- **Solution**:
  1. Ensure **Terminal 1** (`npm run node`) is running.
  2. In **Terminal 2**, re-run `npm run deploy`.
  3. Restart the backend (**Terminal 3**) and refresh the frontend.

### 4. MetaMask "Wrong Network" or Transaction Rejection
- **Cause**: MetaMask is connected to Ethereum Mainnet or a different testnet instead of Ganache.
- **Solution**: Switch MetaMask to `Ganache Local` (`http://127.0.0.1:7545`, Chain ID `1337`). If you restarted Ganache, reset your account nonce in MetaMask: **Settings > Advanced > Clear activity tab data**.

### 5. IPFS Status Shows "Offline (Cache Mode)"
- **Cause**: The local Kubo daemon is not running on port 5001.
- **Solution**: This is a normal and supported fallback state! MatChain will store and retrieve discoveries from `matchain_ipfs_store.json`. To enable live IPFS daemon mode, open a terminal and run `ipfs daemon`.

---

## End-to-End Localhost Demo Walkthrough (Aarav, Priya & Rohan)

Follow this 3-step script to demo the complete decentralized materials economy on localhost:

### Step 1: Aarav (Seller) Lists a Crystal
1. Open the frontend at [http://localhost:5173](http://localhost:5173).
2. Connect your wallet (e.g. Account 0: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`).
3. Click **Marketplace** in the navigation bar and select the **Seller Studio** tab.
4. Pick a crystal recipe from the dropdown (e.g., `Li3V2(PO4)3` or `TiVAl`), set a license price (e.g., `0.02 ETH`), choose **Commercial Research**, and click **Publish to Marketplace**.
5. Confirm the transaction in MetaMask. The listing is now recorded on the local EVM blockchain.

### Step 2: Priya (Validator) Audits & Attests Stability
1. Switch to the **Validator Hub** tab in the Marketplace.
2. Click **Run Pre-Audit Inspection** on the pending material.
3. The screening pipeline computes:
   - Energy above convex hull ($E_{\text{hull}} \le 0.05 \text{ eV/atom}$)
   - Atomic packing distance clearances
   - Multi-model ensemble consensus
4. Click **Stake 0.05 ETH & Approve Attestation**.
5. Priya's cryptographic attestation is saved, and the material earns the **Verified Material** badge.

### Step 3: Rohan (Buyer) Purchases & Accesses the Protected Structure
1. Switch MetaMask to Buyer account (Account 1: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`).
2. In the **Browse Marketplace** tab, locate the verified listing.
3. Click **Acquire License (0.02 ETH)** and approve the transaction.
4. Switch to the **My Purchased Licenses** tab:
   - Click **View License & Provenance Certificate** to view the on-chain ownership certificate.
   - Click **Download Decrypted CIF** to retrieve the AES-256 decrypted crystal structure file directly to your disk.

---

## Local Environment Cleanup & Reset

To reset all local databases, blockchain state, and IPFS caches to a clean state:

```powershell
# In Matchain root:

# 1. Clear backend SQLite database
Remove-Item -Force backend/data/matchain.sqlite3 -ErrorAction SilentlyContinue

# 2. Clear local offline IPFS store
Remove-Item -Force matchain_ipfs_store.json -ErrorAction SilentlyContinue

# 3. Clean contract build artifacts
cd contracts
Remove-Item -Recurse -Force artifacts, cache, deployments -ErrorAction SilentlyContinue
npm run compile
cd ..
```

---

## Commands to Push to GitHub

To commit and push your changes to your GitHub repository:

```powershell
# 1. Review status of modified and new files
git status

# 2. Stage the modified code files, new modules, tests, and updated documentation
git add backend/app/
git add backend/tests/
git add backend/requirements.txt
git add frontend/src/
git add contracts/package.json
git add .env.example
git add README.md

# 3. Commit the changes with a clear message
git commit -m "feat: implement secure IPFS access control, AES-256 encryption, and setup documentation"

# 4. Push to your active branch on GitHub
git push origin main
```
*(If your default branch is `master`, use `git push origin master` instead).*
