from fastapi.testclient import TestClient
from pathlib import Path
import pytest
from app.main import app, storage


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    from app.services.material_access_store import MaterialAccessStore
    test_db = tmp_path / "test_matchain.sqlite3"
    monkeypatch.setattr(storage, "access_store", MaterialAccessStore(test_db))
    return TestClient(app)


def test_marketplace_stats(client: TestClient):
    res = client.get("/api/marketplace/stats")
    assert res.status_code == 200
    data = res.json()
    assert "active_listings" in data
    assert "verified_materials" in data
    assert "staked_validators_active" in data
    assert "dispute_window_hours" in data


def test_marketplace_audit(client: TestClient):
    payload = {"material_hash": "0x7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069"}
    res = client.post("/api/marketplace/audit", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["material_hash"] == payload["material_hash"]
    assert "e_hull_passed" in data
    assert "overall_score" in data
    assert "recommendation" in data
    assert data["recommendation"] == "APPROVED_FOR_MARKETPLACE"


def test_marketplace_validate_attestation(client: TestClient):
    mat_hash = "0x7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069"
    payload = {
        "material_hash": mat_hash,
        "status": "verified",
        "score": 0.98,
        "staked_amount_eth": 0.05
    }
    # Authenticated validator call
    res = client.post(
        "/api/marketplace/validate",
        json=payload,
        headers={"Authorization": "Bearer 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["validation"]["status"] == "verified"
    assert data["validation"]["score"] == 0.98
    assert data["validation"]["validator_wallet"] == "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65"


def test_marketplace_listings_enriched(client: TestClient):
    res = client.get("/api/marketplace/listings")
    assert res.status_code == 200
    listings = res.json()
    assert isinstance(listings, list)
