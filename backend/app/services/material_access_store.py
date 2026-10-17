from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, List, Optional

from sqlalchemy import Boolean, Float, Integer, String, Text, create_engine, select, update
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_DATABASE_PATH = PROJECT_ROOT / "backend" / "data" / "matchain.sqlite3"


class AccessBase(DeclarativeBase):
    pass


class MaterialAccessRecord(AccessBase):
    __tablename__ = "material_access_records"

    material_hash: Mapped[str] = mapped_column(String(66), primary_key=True)
    cid: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    owner_wallet: Mapped[str] = mapped_column(String(42), nullable=False, index=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(128), nullable=False, default="application/octet-stream")
    encryption_key_hex: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    encryption_nonce_hex: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    encryption_tag_hex: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    is_encrypted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_confidential: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[float] = mapped_column(Float, nullable=False, index=True)
    public_metadata_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class MaterialAccessStore:
    """Persistent storage for material ownership, confidential access records,
    and server-side AES encryption keys.
    """

    def __init__(self, database_path: Path = DEFAULT_DATABASE_PATH) -> None:
        database_path.parent.mkdir(parents=True, exist_ok=True)
        self.engine = create_engine(
            f"sqlite:///{database_path.as_posix()}",
            connect_args={"check_same_thread": False},
        )
        self.sessions = sessionmaker(self.engine, expire_on_commit=False)
        AccessBase.metadata.create_all(self.engine)

    def register_material(
        self,
        material_hash: str,
        cid: str,
        owner_wallet: str,
        filename: str,
        content_type: str = "application/octet-stream",
        encryption_key_hex: Optional[str] = None,
        encryption_nonce_hex: Optional[str] = None,
        encryption_tag_hex: Optional[str] = None,
        is_encrypted: bool = True,
        is_confidential: bool = True,
        size_bytes: int = 0,
        public_metadata: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        clean_owner = owner_wallet.strip().lower()
        now = time.time()
        metadata_str = json.dumps(public_metadata, sort_keys=True) if public_metadata else None

        with self.sessions.begin() as session:
            existing = session.get(MaterialAccessRecord, material_hash)
            if existing:
                existing.cid = cid
                existing.owner_wallet = clean_owner
                existing.filename = filename
                existing.content_type = content_type
                existing.encryption_key_hex = encryption_key_hex
                existing.encryption_nonce_hex = encryption_nonce_hex
                existing.encryption_tag_hex = encryption_tag_hex
                existing.is_encrypted = is_encrypted
                existing.is_confidential = is_confidential
                existing.size_bytes = size_bytes
                existing.public_metadata_json = metadata_str
                record = existing
            else:
                record = MaterialAccessRecord(
                    material_hash=material_hash,
                    cid=cid,
                    owner_wallet=clean_owner,
                    filename=filename,
                    content_type=content_type,
                    encryption_key_hex=encryption_key_hex,
                    encryption_nonce_hex=encryption_nonce_hex,
                    encryption_tag_hex=encryption_tag_hex,
                    is_encrypted=is_encrypted,
                    is_confidential=is_confidential,
                    size_bytes=size_bytes,
                    created_at=now,
                    public_metadata_json=metadata_str,
                )
                session.add(record)

        return self.get_by_material_hash(material_hash) or {}

    def get_by_material_hash(self, material_hash: str) -> Optional[dict[str, Any]]:
        with self.sessions() as session:
            record = session.get(MaterialAccessRecord, material_hash)
            return self._to_dict(record) if record else None

    def get_by_cid(self, cid: str) -> Optional[dict[str, Any]]:
        clean_cid = cid.strip()
        if clean_cid.startswith("ipfs://"):
            clean_cid = clean_cid[7:]
        if clean_cid.startswith("local-sha256:"):
            clean_cid = clean_cid.split(":", 1)[1]
        clean_cid = clean_cid.strip("/")

        with self.sessions() as session:
            records = session.scalars(
                select(MaterialAccessRecord).where(MaterialAccessRecord.cid == clean_cid)
            ).all()
            if records:
                return self._to_dict(records[0])
            return None

    def find_by_identifier(self, identifier: str) -> Optional[dict[str, Any]]:
        """Finds record by material_hash or CID."""
        clean = identifier.strip()
        if clean.startswith("0x") and len(clean) == 66:
            rec = self.get_by_material_hash(clean)
            if rec:
                return rec
        rec = self.get_by_cid(clean)
        if rec:
            return rec
        return self.get_by_material_hash(clean)

    def list_by_owner(self, owner_wallet: str) -> List[dict[str, Any]]:
        clean_owner = owner_wallet.strip().lower()
        with self.sessions() as session:
            records = session.scalars(
                select(MaterialAccessRecord)
                .where(MaterialAccessRecord.owner_wallet == clean_owner)
                .order_by(MaterialAccessRecord.created_at.desc())
            ).all()
            return [self._to_dict(r) for r in records]

    def is_owner(self, identifier: str, wallet_address: Optional[str]) -> bool:
        if not wallet_address:
            return False
        rec = self.find_by_identifier(identifier)
        if not rec:
            return False
        return rec["owner_wallet"].lower() == wallet_address.strip().lower()

    @staticmethod
    def _to_dict(record: MaterialAccessRecord) -> dict[str, Any]:
        return {
            "material_hash": record.material_hash,
            "cid": record.cid,
            "owner_wallet": record.owner_wallet,
            "filename": record.filename,
            "content_type": record.content_type,
            "encryption_key_hex": record.encryption_key_hex,
            "encryption_nonce_hex": record.encryption_nonce_hex,
            "encryption_tag_hex": record.encryption_tag_hex,
            "is_encrypted": record.is_encrypted,
            "is_confidential": record.is_confidential,
            "size_bytes": record.size_bytes,
            "created_at": record.created_at,
            "public_metadata": json.loads(record.public_metadata_json) if record.public_metadata_json else None,
        }
