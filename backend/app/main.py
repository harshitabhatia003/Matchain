import asyncio
import base64
import json
from typing import Any, Dict, Optional

from fastapi import Depends, FastAPI, File, HTTPException, Query, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.auth import AuthenticatedUser, get_current_user, get_current_user_optional
from app.config import DATABASE_PATH, FRONTEND_URL, MP_API_KEY
from app.schemas import DiscoveryRequest, FileUploadPayload, ListingCreate, RegistryCreate, StorageUpload
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
def dashboard_stats() -> Dict[str, Any]:
    stats = service.get_dashboard_stats()
    stats["recent_transactions"] = blockchain.get_recent_events()
    if blockchain.deployment_matches() and blockchain.registry is not None:
        stats["registered_materials"] = len(blockchain.get_registry())
    if blockchain.deployment_matches() and blockchain.marketplace is not None:
        listings = blockchain.get_marketplace()
        stats["active_marketplace_listings"] = sum(not item["sold"] for item in listings)
        stats["completed_licenses"] = sum(item["sold"] for item in listings)
    return stats


@app.get("/api/analytics")
def analytics() -> Dict[str, Any]:
    return service.get_analytics()


@app.post("/api/discovery/generate")
async def generate_discovery(payload: DiscoveryRequest):
    payload_data = payload.model_dump(mode="json")
    job_id = service.create_job(payload_data)
    asyncio.create_task(asyncio.to_thread(service.run_job, job_id, payload_data))
    return {"job_id": job_id, "status": "queued"}


@app.get("/api/discovery/jobs/{job_id}")
def get_job(job_id: str):
    try:
        return service.get_job(job_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/materials")
def get_materials() -> list[dict[str, Any]]:
    """Returns approved public materials metadata. Never exposes private CIDs, keys, or direct links."""
    materials = service.get_materials()
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
        return storage.upload_json(
            payload.content,
            owner_wallet=owner_wallet,
            is_confidential=payload.is_confidential,
            material_hash=payload.material_hash,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Storage upload failed: {exc}") from exc


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


@app.get("/api/marketplace/listings")
def get_marketplace_listings():
    """Returns marketplace listings. Never exposes private CIDs or direct storage references."""
    if not blockchain.deployment_matches() or blockchain.marketplace is None:
        raise HTTPException(status_code=503, detail="Marketplace contract is not available on the configured local chain")
    listings = blockchain.get_marketplace()
    sanitized = []
    for item in listings:
        sanitized.append({
            "material_hash": item["material_hash"],
            "seller": item["seller"],
            "buyer": item["buyer"],
            "price_wei": item["price_wei"],
            "price_eth": item["price_eth"],
            "license": item["license"],
            "sold": item["sold"],
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
