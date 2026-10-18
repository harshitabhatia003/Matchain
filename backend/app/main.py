import asyncio
import base64
import json
import time
from typing import Any, Dict, Optional

from fastapi import Depends, FastAPI, File, HTTPException, Query, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.auth import AuthenticatedUser, get_current_user, get_current_user_optional
from app.config import DATABASE_PATH, FRONTEND_URL, MP_API_KEY
from app.schemas import (
    DiscoveryRequest,
    FileUploadPayload,
    ListingCreate,
    MarketplaceAuditRequest,
    MarketplaceValidateRequest,
    RegistryCreate,
    StorageUpload,
)
from app.services.blockchain_service import BlockchainService
from app.services.matchain_service import MatchainService
from app.services.storage_service import StorageService

app = FastAPI(title="MatChain API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(dict.fromkeys([FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"])),
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
service = MatchainService(database_path=DATABASE_PATH)
blockchain = BlockchainService()
storage = StorageService(database_path=DATABASE_PATH)


@app.get("/api/health")
def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "service": "MatChain",
        "version": "0.1.0",
        "blockchain": "connected" if blockchain.available else "unavailable",
        "chain_id": blockchain.web3.eth.chain_id if blockchain.available else None,
        "registry_contract": blockchain.registry.address if blockchain.deployment_matches() and blockchain.registry else None,
        "marketplace_contract": blockchain.marketplace.address if blockchain.deployment_matches() and blockchain.marketplace else None,
        "backend_signing_enabled": blockchain.transactions_enabled,
        "deployment_matches": blockchain.deployment_matches(),
        "storage_backend": "ipfs" if storage.provider_configured else "local-json-fallback (not IPFS)",
        "materials_project_configured": bool(MP_API_KEY),
    }


@app.get("/api/dashboard/stats")
def dashboard_stats(user: Optional[AuthenticatedUser] = Depends(get_current_user_optional)) -> Dict[str, Any]:
    stats = service.get_dashboard_stats(user.wallet_address if user else None)
    if not user:
        stats.update({"total_candidates_generated": 0, "structurally_valid_candidates": 0, "thermodynamically_accepted": 0, "recent_jobs": []})
    stats["recent_transactions"] = blockchain.get_recent_events()
    if blockchain.deployment_matches() and blockchain.registry is not None:
        stats["registered_materials"] = len(blockchain.get_registry())
    if blockchain.deployment_matches() and blockchain.marketplace is not None:
        listings = blockchain.get_marketplace()
        stats["active_marketplace_listings"] = sum(not item["sold"] for item in listings)
        stats["completed_licenses"] = sum(item["sold"] for item in listings)
    return stats


@app.get("/api/analytics")
def analytics(user: Optional[AuthenticatedUser] = Depends(get_current_user_optional)) -> Dict[str, Any]:
    if not user:
        return {"job_id": None, "model_availability": {}, "model_evaluation": {}, "vae_history": {"epochs": [], "total_loss": []}}
    return service.get_analytics(user.wallet_address if user else None)


@app.post("/api/discovery/generate")
async def generate_discovery(payload: DiscoveryRequest, user: Optional[AuthenticatedUser] = Depends(get_current_user_optional)):
    payload_data = payload.model_dump(mode="json")
    job_id = service.create_job(payload_data, user.wallet_address if user else None)
    asyncio.create_task(asyncio.to_thread(service.run_job, job_id, payload_data))
    return {"job_id": job_id, "status": "queued"}


@app.get("/api/discovery/jobs/{job_id}")
def get_job(job_id: str, user: Optional[AuthenticatedUser] = Depends(get_current_user_optional)):
    try:
        return service.get_job(job_id, user.wallet_address if user else None)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/materials")
def get_materials(user: Optional[AuthenticatedUser] = Depends(get_current_user_optional)) -> list[dict[str, Any]]:
    """Returns approved public materials metadata. Never exposes private CIDs, keys, or direct links."""
    if not user:
        return []
    materials = service.get_materials(user.wallet_address if user else None)
    sanitized = []
    for mat in materials:
        item = {
            "id": mat.get("id"),
            "material_hash": mat.get("material_hash"),
            "job_id": mat.get("job_id"),
            "formula": mat.get("formula"),
            "composition": mat.get("composition"),
            "density": mat.get("density"),
            "e_hull": mat.get("e_hull"),
            "predicted_formation_energy": mat.get("predicted_formation_energy"),
            "consensus_spread": mat.get("consensus_spread"),
            "model_predictions": mat.get("model_predictions"),
            "status": mat.get("status", "validated"),
        }
        sanitized.append(item)
    return sanitized


@app.get("/api/materials/{material_id}")
def get_material(material_id: str):
    for material in service.get_materials():
        if material["id"] == material_id:
            return {
                "id": material.get("id"),
                "material_hash": material.get("material_hash"),
                "job_id": material.get("job_id"),
                "formula": material.get("formula"),
                "composition": material.get("composition"),
                "density": material.get("density"),
                "e_hull": material.get("e_hull"),
                "predicted_formation_energy": material.get("predicted_formation_energy"),
                "consensus_spread": material.get("consensus_spread"),
                "model_predictions": material.get("model_predictions"),
                "status": material.get("status", "validated"),
            }
    raise HTTPException(status_code=404, detail="Material not found")


@app.get("/api/registry")
def get_registry(user: Optional[AuthenticatedUser] = Depends(get_current_user_optional)):
    """Returns registry records. Masks CIDs for any record that the requester does not own."""
    if not blockchain.deployment_matches() or blockchain.registry is None:
        raise HTTPException(status_code=503, detail="Registry contract is not available on the configured local chain")
    records = blockchain.get_registry()
    sanitized = []
    user_wallet = user.wallet_address.lower() if user else None

    for item in records:
        creator_wallet = item.get("creator", "").lower()
        is_creator = bool(user_wallet and creator_wallet == user_wallet)

        sanitized.append({
            "fingerprint": item.get("fingerprint"),
            "creator": item.get("creator"),
            "block_number": item.get("block_number"),
            "verified": item.get("verified"),
            "metadata": item.get("metadata"),
            # Only the seller/creator can see the CID; masked for buyers and public
            "ipfs_cid": item.get("ipfs_cid") if is_creator else "[RESTRICTED - CREATOR ONLY]",
            "is_owner": is_creator,
        })
    return sanitized


@app.post("/api/storage/upload")
def upload_storage(
    payload: StorageUpload,
    user: Optional[AuthenticatedUser] = Depends(get_current_user_optional),
):
    try:
        owner_wallet = user.wallet_address if user else None
        structure_data = payload.content.get("structure") if isinstance(payload.content, dict) else None
        if structure_data and payload.material_hash and owner_wallet:
            from pymatgen.core import Lattice, Structure
            structure = Structure(
                Lattice(structure_data["lattice"]),
                structure_data["species"],
                structure_data["frac_coords"],
            )
            cif_text = structure.to(fmt="cif")
            formula = str(structure.composition.reduced_formula)
            return storage.upload_file(
                f"{formula}.cif",
                cif_text.encode("utf-8"),
                "chemical/x-cif",
                owner_wallet=owner_wallet,
                is_confidential=True,
                material_hash=payload.material_hash,
            )
        return storage.upload_json(
            payload.content,
            owner_wallet=owner_wallet,
            is_confidential=payload.is_confidential,
            material_hash=payload.material_hash,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Storage upload failed: {exc}") from exc


def _recover_legacy_candidate_file(material_hash: str, buyer_wallet: str) -> Optional[dict[str, Any]]:
    """Rebuilds a CIF access record for legacy registrations that stored the
    structure JSON but accidentally omitted the fingerprint from the upload envelope.

    Recovery is only available to a wallet whose purchase is confirmed on-chain.
    New registrations store the encrypted CIF directly and do not use this path.
    """
    if not blockchain.deployment_matches() or blockchain.registry is None:
        return None
    try:
        digest = blockchain.fingerprint(material_hash)
        canonical_hash = "0x" + digest.hex()
        if not blockchain.is_verified_purchaser(canonical_hash, buyer_wallet):
            return None

        registry_entry = next(
            (item for item in blockchain.get_registry() if item["fingerprint"].lower() == canonical_hash.lower()),
            None,
        )
        if not registry_entry:
            return None
        legacy = storage.get_content(registry_entry["ipfs_cid"])
        payload = legacy.get("data")
        if not isinstance(payload, dict):
            return None
        structure_data = payload.get("structure")
        if not isinstance(structure_data, dict):
            return None

        from pymatgen.core import Lattice, Structure

        structure = Structure(
            Lattice(structure_data["lattice"]),
            structure_data["species"],
            structure_data["frac_coords"],
        )
        return storage.upload_file(
            f"{structure.composition.reduced_formula}.cif",
            structure.to(fmt="cif").encode("utf-8"),
            "chemical/x-cif",
            owner_wallet=registry_entry["creator"],
            is_confidential=True,
            material_hash=canonical_hash,
        )
    except Exception:
        # Recovery is best-effort; the normal path below returns the useful
        # storage error and never masks authorization failures.
        return None


@app.get("/api/storage/status")
def get_storage_status() -> Dict[str, Any]:
    return storage.get_node_status()


@app.get("/api/storage/pins")
def list_storage_pins(
    user: AuthenticatedUser = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Lists storage pins. Requires authentication and returns only pins owned by the requester
    or public non-confidential items. Other sellers' private CIDs are completely excluded.
    """
    return storage.list_stored_items(owner_wallet=user.wallet_address)


@app.post("/api/storage/upload-file")
async def upload_storage_file(
    file: Optional[UploadFile] = File(None),
    payload: Optional[FileUploadPayload] = None,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Allows an authenticated seller to upload a material file (CIF/POSCAR).
    Encrypts the file with AES-256-GCM before pinning to IPFS, keeping keys on the backend.
    Returns the CID and IPFS URI to the authorized seller.
    """
    try:
        if file is not None and file.filename:
            content_bytes = await file.read()
            filename = file.filename
            content_type = file.content_type or "application/octet-stream"
            return storage.upload_file(
                filename,
                content_bytes,
                content_type,
                owner_wallet=user.wallet_address,
                is_confidential=True,
            )
        elif payload is not None:
            if payload.content_text is not None:
                content_bytes = payload.content_text.encode("utf-8")
            elif payload.content_base64 is not None:
                content_bytes = base64.b64decode(payload.content_base64)
            else:
                raise HTTPException(status_code=400, detail="Either content_text or content_base64 must be provided")
            return storage.upload_file(
                payload.filename,
                content_bytes,
                payload.content_type,
                owner_wallet=user.wallet_address,
                is_confidential=payload.is_confidential,
                material_hash=payload.material_hash,
            )
        else:
            raise HTTPException(status_code=400, detail="No file or payload provided")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"File upload to IPFS failed: {exc}") from exc


@app.get("/api/storage/share/{cid:path}")
def get_storage_share(
    cid: str,
    user: AuthenticatedUser = Depends(get_current_user),
) -> Dict[str, Any]:
    """Generates an IPFS share bundle. Restricted exclusively to the material's seller/owner."""
    rec = storage.access_store.find_by_identifier(cid)
    if rec and rec["is_confidential"]:
        if rec["owner_wallet"].lower() != user.wallet_address.lower():
            raise HTTPException(
                status_code=403,
                detail="Access denied: Only the material seller/owner may view or generate share bundles.",
            )
    try:
        return storage.get_share_bundle(cid)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/storage/content/{cid:path}")
def get_storage_content(
    cid: str,
    user: AuthenticatedUser = Depends(get_current_user),
) -> Dict[str, Any]:
    """Retrieves stored content with access control.
    - Owner receives full decrypted content with CID and share bundle.
    - Verified on-chain buyer receives decrypted content without exposing private CID or keys.
    - Unauthorized users receive 403 Forbidden.
    """
    rec = storage.access_store.find_by_identifier(cid)
    if not rec and cid.lower().startswith("0x"):
        _recover_legacy_candidate_file(cid, user.wallet_address)
        rec = storage.access_store.find_by_identifier(cid)
    is_owner = False
    is_purchaser = False

    if rec:
        is_owner = rec["owner_wallet"].lower() == user.wallet_address.lower()
        if not is_owner:
            is_purchaser = blockchain.is_verified_purchaser(rec["material_hash"], user.wallet_address)
        if rec["is_confidential"] and not is_owner and not is_purchaser:
            raise HTTPException(
                status_code=403,
                detail="Access denied: You are not authorized to view this private material.",
            )

    try:
        return storage.get_content(
            cid,
            requester_wallet=user.wallet_address,
            is_verified_purchaser=is_purchaser,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not retrieve IPFS content: {exc}") from exc


@app.get("/api/storage/raw/{cid:path}")
def get_storage_raw(
    cid: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Downloads raw material content. Verifies ownership or on-chain purchase before decrypting."""
    rec = storage.access_store.find_by_identifier(cid)
    if rec and rec["is_confidential"]:
        is_owner = rec["owner_wallet"].lower() == user.wallet_address.lower()
        is_purchaser = blockchain.is_verified_purchaser(rec["material_hash"], user.wallet_address)
        if not is_owner and not is_purchaser:
            raise HTTPException(
                status_code=403,
                detail="Access denied: You are not authorized to download this private material.",
            )
        try:
            decrypted_bytes, filename, content_type = storage.decrypt_for_download(cid)
            return Response(
                content=decrypted_bytes,
                media_type=content_type,
                headers={"Content-Disposition": f'attachment; filename="{filename}"'},
            )
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Decryption failed: {exc}") from exc

    # Non-confidential / legacy item
    try:
        record = storage.get_content(cid, requester_wallet=user.wallet_address)
        raw_text = record.get("raw_text")
        if raw_text is not None:
            media_type = "application/json" if record.get("is_json") else "text/plain"
            return Response(content=raw_text, media_type=media_type)
        return record.get("data")
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/storage/download/{identifier:path}")
def download_authorized_material(
    identifier: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Authorized file download for buyers with a verified purchase or sellers who own the material.
    Decrypts the file server-side and streams the attachment without exposing the private CID.
    """
    rec = storage.access_store.find_by_identifier(identifier)
    if not rec and identifier.lower().startswith("0x"):
        _recover_legacy_candidate_file(identifier, user.wallet_address)
        rec = storage.access_store.find_by_identifier(identifier)
    if not rec:
        raise HTTPException(status_code=404, detail=f"Material record '{identifier}' not found.")

    is_owner = rec["owner_wallet"].lower() == user.wallet_address.lower()
    is_purchaser = False
    if not is_owner:
        is_purchaser = blockchain.is_verified_purchaser(rec["material_hash"], user.wallet_address)

    if not is_owner and not is_purchaser:
        raise HTTPException(
            status_code=403,
            detail="Access denied: A verified on-chain purchase or material ownership is required to download this file.",
        )

    try:
        decrypted_bytes, filename, content_type = storage.decrypt_for_download(identifier)
        return Response(
            content=decrypted_bytes,
            media_type=content_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "X-Material-Hash": rec["material_hash"],
            },
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Download failed: {exc}") from exc


@app.post("/api/registry")
def register_discovery(
    payload: RegistryCreate,
    user: AuthenticatedUser = Depends(get_current_user),
):
    if not blockchain.deployment_matches() or not blockchain.transactions_enabled or blockchain.registry is None:
        raise HTTPException(status_code=503, detail="A configured unlocked backend account and deployed registry are required; otherwise sign this transaction using MetaMask")
    try:
        stored = storage.upload_json(
            {"metadata": payload.metadata, "material_hash": payload.material_hash},
            owner_wallet=user.wallet_address,
            is_confidential=False,  # Public metadata
            material_hash=payload.material_hash,
        )
        result = blockchain.register_discovery(
            payload.material_hash,
            stored["storage_reference"],
            json.dumps(payload.metadata, sort_keys=True),
        )
        return {**result, "storage_backend": stored["storage_backend"], "is_ipfs": stored["is_ipfs"]}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _audit_material(material_hash: str) -> dict[str, Any]:
    """Evaluates physical and thermodynamic stability for marketplace attestation."""
    clean_hash = material_hash.strip().lower()
    
    # 1. Search in discovery service materials
    mat_data = None
    for item in service.get_materials():
        if item.get("material_hash", "").lower() == clean_hash or item.get("id", "").lower() == clean_hash:
            mat_data = item
            break

    # Registered chain metadata is the authoritative fallback for materials
    # whose discovery job is no longer present in this backend database.
    if not mat_data and blockchain.deployment_matches() and blockchain.registry is not None:
        digest = blockchain.fingerprint(material_hash)
        record = blockchain.registry.functions.discoveries(digest).call()
        if record[1] != "0x0000000000000000000000000000000000000000":
            try:
                mat_data = json.loads(record[4] or "{}")
            except (TypeError, json.JSONDecodeError):
                mat_data = {}
            
    # 2. Search in access store
    if not mat_data:
        access_rec = storage.access_store.get_by_material_hash(clean_hash)
        if access_rec and access_rec.get("public_metadata"):
            mat_data = access_rec["public_metadata"]

    if not mat_data:
        raise ValueError("Material is not available in discovery or registry metadata.")
    required_values = ("e_hull", "density", "predicted_formation_energy", "consensus_spread")
    missing = [key for key in required_values if mat_data.get(key) is None]
    if missing:
        raise ValueError(f"Material metadata is missing audit inputs: {', '.join(missing)}.")
    formula = mat_data.get("formula", "Registered Material")
    e_hull = float(mat_data["e_hull"])
    density = float(mat_data["density"])
    predicted_fe = float(mat_data["predicted_formation_energy"])
    spread = float(mat_data["consensus_spread"])

    # Cryptoeconomic Audit Checks
    e_hull_passed = e_hull <= 0.05
    distance_passed = 1.0 <= density <= 25.0
    consensus_passed = spread <= 0.15

    passed_count = sum([e_hull_passed, distance_passed, consensus_passed])
    score = round(0.70 + (0.10 * passed_count), 2)
    if e_hull_passed and e_hull <= 0.02:
        score = min(0.99, score + 0.05)

    is_approved = passed_count >= 2

    return {
        "material_hash": material_hash,
        "formula": formula,
        "density": density,
        "e_hull": e_hull,
        "predicted_formation_energy": predicted_fe,
        "consensus_spread": spread,
        "e_hull_passed": e_hull_passed,
        "e_hull_status": "Thermodynamically Stable (E_hull <= 0.05 eV/atom)" if e_hull_passed else "Metastable / High E_hull Risk",
        "distance_passed": distance_passed,
        "distance_status": "Density is within supported bounds (1.0 - 25.0 g/cm³)" if distance_passed else "Density is outside supported bounds",
        "consensus_passed": consensus_passed,
        "consensus_status": "High ML Jury consensus spread (spread <= 0.15 eV)" if consensus_passed else "High model variance across jurors",
        "overall_score": score,
        "tier": "Tier-2 Peer Staked" if is_approved else "Tier-1 Unverified",
        "recommendation": "APPROVED_FOR_MARKETPLACE" if is_approved else "REJECTED_UNSTABLE",
        "timestamp": time.time(),
    }


@app.post("/api/marketplace/audit")
def audit_marketplace_material(payload: MarketplaceAuditRequest) -> dict[str, Any]:
    """Runs automated thermodynamic & physical screening for a candidate crystal."""
    try:
        return _audit_material(payload.material_hash)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Audit failed: {exc}") from exc


@app.post("/api/marketplace/validate")
def validate_marketplace_material(
    payload: MarketplaceValidateRequest,
    user: AuthenticatedUser = Depends(get_current_user),
) -> dict[str, Any]:
    """Allows a staked validator to attest a material's thermodynamic validity."""
    audit_report = _audit_material(payload.material_hash)
    
    if audit_report["recommendation"] != "APPROVED_FOR_MARKETPLACE":
        raise HTTPException(status_code=400, detail="The material did not pass the stability audit.")
    
    if not blockchain.deployment_matches() or not blockchain.registry:
        raise HTTPException(status_code=503, detail="Registry contract is not available.")
    try:
        receipt = blockchain.web3.eth.get_transaction_receipt(payload.transaction_hash)
        events = blockchain.registry.events.DiscoveryAttested().process_receipt(receipt)
        digest = blockchain.fingerprint(payload.material_hash)
        attestation = next((event["args"] for event in events if event["args"]["fingerprint"] == digest), None)
        if not attestation or attestation["validator"].lower() != user.wallet_address.lower() or int(attestation["stake"]) != blockchain.web3.to_wei("0.05", "ether"):
            raise ValueError("Transaction does not contain this wallet's 0.05 ETH attestation for this material.")
        onchain_verified = bool(blockchain.registry.functions.discoveries(digest).call()[5])
    except Exception as exc:
        raise HTTPException(status_code=409, detail=f"Could not verify the wallet attestation transaction: {exc}") from exc
    if not onchain_verified:
        raise HTTPException(status_code=409, detail="The material is not verified on-chain.")

    result = storage.access_store.record_validation(
        material_hash=payload.material_hash,
        status="verified",
        validator_wallet=user.wallet_address,
        score=payload.score or audit_report["overall_score"],
        e_hull_passed=audit_report["e_hull_passed"],
        distance_passed=audit_report["distance_passed"],
        consensus_passed=audit_report["consensus_passed"],
        report=audit_report,
        staked_amount_eth=0.05,
    )

    return {
        "status": "success",
        "validation": result,
        "onchain_verified": onchain_verified,
        "validator_reward_earned_eth": 0,
    }


@app.get("/api/marketplace/validations")
def list_marketplace_validations() -> list[dict[str, Any]]:
    """Lists all validator attestations."""
    return storage.access_store.list_validations()


@app.get("/api/marketplace/stats")
def get_marketplace_stats() -> dict[str, Any]:
    """Returns real-time marketplace stats including validator metrics."""
    validations = storage.access_store.list_validations()
    registry_records = blockchain.get_registry() if blockchain.deployment_matches() and blockchain.registry else []
    verified_hashes = {item["fingerprint"].lower() for item in registry_records if item.get("verified")}
    current_validations = [item for item in validations if item.get("material_hash", "").lower() in verified_hashes]
    
    onchain_listings = []
    if blockchain.deployment_matches() and blockchain.marketplace:
        try:
            onchain_listings = blockchain.get_marketplace()
        except Exception:
            pass

    active_listings_count = sum(1 for l in onchain_listings if not l.get("sold"))
    completed_licenses = sum(1 for l in onchain_listings if l.get("sold"))
    total_volume_eth = sum(float(l.get("price_eth", 0)) for l in onchain_listings if l.get("sold"))
    
    return {
        "active_listings": active_listings_count,
        "completed_licenses": completed_licenses,
        "total_volume_eth": round(total_volume_eth, 4),
        "verified_materials": len(verified_hashes),
        "staked_validators_active": len(set(v.get("validator_wallet") for v in current_validations if v.get("validator_wallet"))),
        "validator_pool_rewards_eth": 0,
        "dispute_window_hours": 0,
    }


@app.get("/api/marketplace/listings")
def get_marketplace_listings():
    """Returns enriched marketplace listings with thermodynamic properties and validation badges."""
    listings = []
    if blockchain.deployment_matches() and blockchain.marketplace is not None:
        try:
            listings = blockchain.get_marketplace()
        except Exception:
            listings = []

    # Map of all validations
    validations_map = {v["material_hash"].lower(): v for v in storage.access_store.list_validations()}

    # Use public metadata anchored with the registry record; avoid demo defaults.
    known_materials = {}
    if blockchain.deployment_matches() and blockchain.registry is not None:
        for record in blockchain.get_registry():
            try:
                props = json.loads(record.get("metadata") or "{}")
            except (TypeError, json.JSONDecodeError):
                props = {}
            known_materials[record["fingerprint"].lower()] = {**props, "verified": record.get("verified", False)}

    sanitized = []
    for item in listings:
        h = item["material_hash"].lower()
        val_rec = validations_map.get(h)
        prop = known_materials.get(h, {})
        
        sanitized.append({
            "material_hash": item["material_hash"],
            "seller": item["seller"],
            "buyer": item["buyer"],
            "price_wei": item["price_wei"],
            "price_eth": item["price_eth"],
            "license": item["license"],
            "sold": item["sold"],
            "formula": prop.get("formula", "Registered Crystal"),
            "density": prop.get("density"),
            "e_hull": prop.get("e_hull"),
            "predicted_formation_energy": prop.get("predicted_formation_energy"),
            "consensus_spread": prop.get("consensus_spread"),
            "verified": bool(prop.get("verified")),
            "validator": val_rec.get("validator_wallet") if val_rec else None,
            "validation_score": val_rec.get("score", 0.95) if val_rec else None,
        })
    return sanitized


@app.post("/api/marketplace/listings")
def create_listing(
    payload: ListingCreate,
    user: AuthenticatedUser = Depends(get_current_user),
):
    if not blockchain.deployment_matches() or not blockchain.transactions_enabled or blockchain.marketplace is None:
        raise HTTPException(status_code=503, detail="A configured unlocked backend account and deployed marketplace are required; otherwise use MetaMask")
    try:
        return blockchain.create_listing(payload.material_hash, payload.price, payload.license_terms)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/marketplace/listings/{listing_id}/purchase")
def purchase_listing(
    listing_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    if not blockchain.deployment_matches() or not blockchain.transactions_enabled or blockchain.marketplace is None:
        raise HTTPException(status_code=503, detail="A configured unlocked backend account and deployed marketplace are required; otherwise use MetaMask")
    try:
        return blockchain.purchase_listing(listing_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/users/me/materials")
def my_materials(
    wallet_address: str = Query(..., description="Wallet address to match against public registry creator records"),
    user: AuthenticatedUser = Depends(get_current_user),
):
    if not blockchain.deployment_matches():
        raise HTTPException(status_code=503, detail="Registry contract is not available on the configured deployment")
    try:
        address = blockchain.web3.to_checksum_address(wallet_address)
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Invalid wallet address") from exc
    if user.wallet_address.lower() != address.lower():
        raise HTTPException(status_code=403, detail="Access denied: Cannot query another user's private materials.")
    return [item for item in blockchain.get_registry() if item["creator"].lower() == address.lower()]


@app.get("/api/users/me/licenses")
def my_licenses(
    wallet_address: str = Query(..., description="Wallet address to match against public marketplace buyer records"),
    user: AuthenticatedUser = Depends(get_current_user),
):
    if not blockchain.deployment_matches():
        raise HTTPException(status_code=503, detail="Marketplace contract is not available on the configured deployment")
    try:
        address = blockchain.web3.to_checksum_address(wallet_address)
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Invalid wallet address") from exc
    if user.wallet_address.lower() != address.lower():
        raise HTTPException(status_code=403, detail="Access denied: Cannot query another user's licenses.")
    return [
        item for item in blockchain.get_marketplace()
        if item["sold"] and item["buyer"].lower() == address.lower()
    ]


@app.get("/")
def root() -> Dict[str, str]:
    return {"message": "MatChain API running"}
