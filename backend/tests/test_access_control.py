import json
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app, blockchain, storage


@pytest.fixture
def client_and_stores(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    import app.services.storage_service as storage_module
    from app.services.material_access_store import MaterialAccessStore
    from app.services.storage_service import StorageService

    db_path = tmp_path / "test_access.sqlite3"
    content_store = tmp_path / "matchain_ipfs_store.json"

    monkeypatch.setattr(storage_module, "LOCAL_STORE_PATH", content_store)
    test_storage = StorageService(database_path=db_path)
    monkeypatch.setattr("app.main.storage", test_storage)

    client = TestClient(app)
    return client, test_storage, db_path


SELLER_HEADERS = {"Authorization": "Bearer seller-token"}
OTHER_SELLER_HEADERS = {"Authorization": "Bearer other-seller-token"}
BUYER_HEADERS = {"Authorization": "Bearer buyer-token"}


def test_1_seller_can_upload_and_retrieve_own_material_cid(client_and_stores):
    """1. A seller can retrieve their own material CID."""
    client, test_storage, _ = client_and_stores
    cif_content = "data_crystal_sellerA\n_cell_length_a 5.43\n_cell_length_b 5.43\n_cell_length_c 5.43"

    res = client.post(
        "/api/storage/upload-file",
        files={"file": ("silicon.cif", cif_content.encode("utf-8"), "chemical/x-cif")},
        headers=SELLER_HEADERS,
    )
    assert res.status_code == 200, res.text
    data = res.json()
    cid = data["cid"]
    assert cid.startswith("b")
    assert data["ipfs_uri"] == f"ipfs://{cid}"
    assert data["is_encrypted"] is True

    # Seller retrieves content by CID
    content_res = client.get(f"/api/storage/content/{cid}", headers=SELLER_HEADERS)
    assert content_res.status_code == 200
    content_json = content_res.json()
    assert content_json["cid"] == cid
    assert content_json["filename"] == "silicon.cif"
    assert "data_crystal_sellerA" in content_json["raw_text"]
    assert content_json["access_role"] == "seller"
    assert content_json["share_bundle"]["cid"] == cid

    # Seller can see the CID in their own pins
    pins_res = client.get("/api/storage/pins", headers=SELLER_HEADERS)
    assert pins_res.status_code == 200
    seller_cids = [item["cid"] for item in pins_res.json()]
    assert cid in seller_cids


def test_2_another_seller_cannot_retrieve_that_cid(client_and_stores):
    """2. Another seller cannot retrieve that CID."""
    client, test_storage, _ = client_and_stores
    cif_content = "data_confidential_prop\n_symmetry_space_group_name_H-M 'P 1'"

    # Upload as Seller A
    upload_res = client.post(
        "/api/storage/upload-file",
        files={"file": ("secret.cif", cif_content.encode("utf-8"), "chemical/x-cif")},
        headers=SELLER_HEADERS,
    )
    assert upload_res.status_code == 200
    cid = upload_res.json()["cid"]

    # Seller B attempts to access Seller A's material by CID -> 403 Forbidden
    b_content_res = client.get(f"/api/storage/content/{cid}", headers=OTHER_SELLER_HEADERS)
    assert b_content_res.status_code == 403
    assert "Access denied" in b_content_res.json()["detail"]

    # Seller B attempts to get share bundle -> 403 Forbidden
    b_share_res = client.get(f"/api/storage/share/{cid}", headers=OTHER_SELLER_HEADERS)
    assert b_share_res.status_code == 403

    # Seller B attempts to download raw file -> 403 Forbidden
    b_raw_res = client.get(f"/api/storage/raw/{cid}", headers=OTHER_SELLER_HEADERS)
    assert b_raw_res.status_code == 403

    # Seller B lists pins -> Seller A's CID is NOT present
    b_pins = client.get("/api/storage/pins", headers=OTHER_SELLER_HEADERS).json()
    assert cid not in [item["cid"] for item in b_pins]


def test_3_authenticated_buyer_cannot_retrieve_cid_before_purchasing(client_and_stores, monkeypatch: pytest.MonkeyPatch):
    """3. An authenticated buyer cannot retrieve the CID before purchasing."""
    client, test_storage, _ = client_and_stores
    cif_content = "data_buyer_test\n_cell_volume 120.5"

    upload_res = client.post(
        "/api/storage/upload-file",
        files={"file": ("buyer_test.cif", cif_content.encode("utf-8"), "chemical/x-cif")},
        headers=SELLER_HEADERS,
    )
    assert upload_res.status_code == 200
    cid = upload_res.json()["cid"]
    material_hash = upload_res.json()["material_hash"]

    # Buyer has NOT purchased yet (blockchain reports False)
    monkeypatch.setattr(blockchain, "is_verified_purchaser", lambda m_hash, wallet: False)
    mock_listing = [{
        "material_hash": material_hash,
        "seller": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        "buyer": "0x0000000000000000000000000000000000000000",
        "price_wei": 1000000000000000000,
        "price_eth": "1.0",
        "license": "single-lab",
        "sold": False,
    }]
    monkeypatch.setattr(blockchain, "get_marketplace", lambda: mock_listing)
    monkeypatch.setattr(blockchain, "deployment_matches", lambda: True)
    monkeypatch.setattr(blockchain, "marketplace", MagicMock())

    # Check public marketplace listing: CID must NOT appear in network response
    listings_res = client.get("/api/marketplace/listings", headers=BUYER_HEADERS)
    assert listings_res.status_code == 200
    listings_json = listings_res.json()
    assert len(listings_json) == 1
    listing = listings_json[0]
    assert "cid" not in listing
    assert "ipfs_cid" not in listing
    assert "storage_reference" not in listing
    assert "encryption_key" not in listing

    # Buyer queries pins endpoint -> CID must not appear
    buyer_pins = client.get("/api/storage/pins", headers=BUYER_HEADERS).json()
    assert cid not in [item["cid"] for item in buyer_pins]

    # Buyer queries registry endpoint -> CID must be masked
    mock_registry = [{
        "fingerprint": material_hash,
        "creator": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        "block_number": 10,
        "verified": True,
        "metadata": json.dumps({"formula": "Fe2O3"}),
        "ipfs_cid": cid,
    }]
    monkeypatch.setattr(blockchain, "get_registry", lambda: mock_registry)
    monkeypatch.setattr(blockchain, "registry", MagicMock())

    reg_res = client.get("/api/registry", headers=BUYER_HEADERS)
    assert reg_res.status_code == 200
    reg_items = reg_res.json()
    assert reg_items[0]["ipfs_cid"] == "[RESTRICTED - CREATOR ONLY]"
    assert cid not in json.dumps(reg_items)


def test_4_buyer_cannot_access_restricted_file_contents_using_known_cid(client_and_stores, monkeypatch: pytest.MonkeyPatch):
    """4. A buyer cannot access restricted file contents using a known CID directly."""
    client, test_storage, _ = client_and_stores
    cif_content = "data_confidential_crystal\n_secret_parameter 42"

    upload_res = client.post(
        "/api/storage/upload-file",
        files={"file": ("restricted.cif", cif_content.encode("utf-8"), "chemical/x-cif")},
        headers=SELLER_HEADERS,
    )
    cid = upload_res.json()["cid"]
    material_hash = upload_res.json()["material_hash"]

    # Not purchased
    monkeypatch.setattr(blockchain, "is_verified_purchaser", lambda m_hash, wallet: False)

    # Buyer copies CID into content URL -> 403 Forbidden
    content_res = client.get(f"/api/storage/content/{cid}", headers=BUYER_HEADERS)
    assert content_res.status_code == 403

    # Buyer copies CID into raw URL -> 403 Forbidden
    raw_res = client.get(f"/api/storage/raw/{cid}", headers=BUYER_HEADERS)
    assert raw_res.status_code == 403

    # Buyer copies CID into download endpoint -> 403 Forbidden
    download_res = client.get(f"/api/storage/download/{cid}", headers=BUYER_HEADERS)
    assert download_res.status_code == 403

    # Buyer copies material hash into download endpoint -> 403 Forbidden
    download_hash_res = client.get(f"/api/storage/download/{material_hash}", headers=BUYER_HEADERS)
    assert download_hash_res.status_code == 403


def test_5_buyer_with_verified_purchase_receives_only_allowed_access(client_and_stores, monkeypatch: pytest.MonkeyPatch):
    """5. A buyer with a verified purchase receives only the access allowed by the business rules."""
    client, test_storage, _ = client_and_stores
    cif_content = "data_verified_license\n_cell_length_a 3.84\n_crystal_density 6.12"

    upload_res = client.post(
        "/api/storage/upload-file",
        files={"file": ("licensed_crystal.cif", cif_content.encode("utf-8"), "chemical/x-cif")},
        headers=SELLER_HEADERS,
    )
    cid = upload_res.json()["cid"]
    material_hash = upload_res.json()["material_hash"]

    # Simulate verified on-chain purchase: buyer's wallet address confirmed on-chain
    buyer_wallet = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
    monkeypatch.setattr(
        blockchain,
        "is_verified_purchaser",
        lambda m_hash, wallet: m_hash == material_hash and wallet.lower() == buyer_wallet.lower(),
    )

    # 1. Buyer accesses content: gets decrypted data, but private CID is NEVER returned
    content_res = client.get(f"/api/storage/content/{cid}", headers=BUYER_HEADERS)
    assert content_res.status_code == 200
    buyer_view = content_res.json()
    assert "data_verified_license" in buyer_view["raw_text"]
    assert buyer_view["access_role"] == "buyer"
    assert buyer_view["license_status"] == "active_license"
    # CID is permanently shielded from buyer
    assert "cid" not in buyer_view
    assert "share_bundle" not in buyer_view

    # 2. Buyer downloads authorized material file via download endpoint
    download_res = client.get(f"/api/storage/download/{material_hash}", headers=BUYER_HEADERS)
    assert download_res.status_code == 200
    assert "attachment; filename=\"licensed_crystal.cif\"" in download_res.headers["content-disposition"]
    assert download_res.content == cif_content.encode("utf-8")

    # 3. Buyer cannot generate public IPFS share links (share endpoint is seller-only)
    share_res = client.get(f"/api/storage/share/{cid}", headers=BUYER_HEADERS)
    assert share_res.status_code == 403


def test_6_unauthenticated_user_cannot_access_private_material(client_and_stores):
    """6. An unauthenticated user cannot access private material."""
    client, test_storage, _ = client_and_stores
    cif_content = "data_private\n_secret 123"

    upload_res = client.post(
        "/api/storage/upload-file",
        files={"file": ("priv.cif", cif_content.encode("utf-8"), "chemical/x-cif")},
        headers=SELLER_HEADERS,
    )
    cid = upload_res.json()["cid"]
    material_hash = upload_res.json()["material_hash"]

    # No Authorization header
    assert client.get(f"/api/storage/content/{cid}").status_code == 401
    assert client.get(f"/api/storage/raw/{cid}").status_code == 401
    assert client.get(f"/api/storage/share/{cid}").status_code == 401
    assert client.get(f"/api/storage/download/{material_hash}").status_code == 401
    assert client.get("/api/storage/pins").status_code == 401
    assert client.post("/api/storage/upload-file").status_code == 401


def test_7_pins_content_raw_and_share_endpoints_cannot_bypass_authorization(client_and_stores, monkeypatch: pytest.MonkeyPatch):
    """7. The pins, content, raw-download, and share endpoints cannot bypass authorization."""
    client, test_storage, _ = client_and_stores
    cif_content = "data_sensitive\n_value 999"

    upload_res = client.post(
        "/api/storage/upload-file",
        files={"file": ("sensitive.cif", cif_content.encode("utf-8"), "chemical/x-cif")},
        headers=SELLER_HEADERS,
    )
    cid = upload_res.json()["cid"]

    # Attacker tries fake headers or unauthorized wallet
    attacker_headers = {"Authorization": "Bearer 0x0000000000000000000000000000000000000001"}
    monkeypatch.setattr(blockchain, "is_verified_purchaser", lambda m_hash, wallet: False)

    assert client.get(f"/api/storage/content/{cid}", headers=attacker_headers).status_code == 403
    assert client.get(f"/api/storage/share/{cid}", headers=attacker_headers).status_code == 403
    assert client.get(f"/api/storage/raw/{cid}", headers=attacker_headers).status_code == 403
    assert client.get(f"/api/storage/download/{cid}", headers=attacker_headers).status_code == 403

    # Pins endpoint returns empty for attacker
    pins = client.get("/api/storage/pins", headers=attacker_headers).json()
    assert cid not in [item["cid"] for item in pins]


def test_8_public_material_metadata_remains_accessible(client_and_stores):
    """8. Public material metadata remains accessible."""
    client, _, _ = client_and_stores

    # /api/health is accessible without auth
    health_res = client.get("/api/health")
    assert health_res.status_code == 200

    # /api/materials returns public metadata without leaking CIDs
    materials_res = client.get("/api/materials")
    assert materials_res.status_code == 200
    for mat in materials_res.json():
        assert "cid" not in mat
        assert "ipfs_cid" not in mat
        assert "encryption_key" not in mat

    # Storage node status is public diagnostic
    status_res = client.get("/api/storage/status")
    assert status_res.status_code == 200
    assert "public_gateways" in status_res.json()
