from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, Header, HTTPException, Request
from web3 import Web3

# Pre-defined test tokens mapped to standard addresses for predictable testing and dev
TEST_WALLETS = {
    "seller-token": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "buyer-token": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    "other-seller-token": "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
}


@dataclass
class AuthenticatedUser:
    wallet_address: str
    user_id: str
    role: str = "researcher"


def normalize_address(address_str: str) -> Optional[str]:
    clean = address_str.strip()
    if clean.startswith("0x") and len(clean) == 42:
        try:
            return Web3.to_checksum_address(clean)
        except Exception:
            return clean.lower()
    return None


async def get_current_user_optional(
    request: Request,
    authorization: Optional[str] = Header(None),
    x_wallet_address: Optional[str] = Header(None),
) -> Optional[AuthenticatedUser]:
    """Resolves authenticated user from Bearer authorization token or X-Wallet-Address header."""
    wallet: Optional[str] = None
    user_id: Optional[str] = None

    # 1. Check Authorization: Bearer <token>
    if authorization:
        parts = authorization.strip().split(" ", 1)
        token = parts[1].strip() if len(parts) == 2 and parts[0].lower() == "bearer" else authorization.strip()

        if token in TEST_WALLETS:
            wallet = TEST_WALLETS[token]
            user_id = f"user_{token}"
        elif token.startswith("wallet:"):
            addr = token.split(":", 1)[1]
            wallet = normalize_address(addr)
            user_id = f"wallet_{addr}"
        elif normalize_address(token):
            wallet = normalize_address(token)
            user_id = f"wallet_{token}"
        else:
            # Generic token fallback or token with embedded address
            match = re.search(r"0x[a-fA-F0-9]{40}", token)
            if match:
                wallet = normalize_address(match.group(0))
                user_id = f"user_{match.group(0)}"
            else:
                user_id = token

    # 2. Check X-Wallet-Address header if wallet not yet extracted
    if not wallet and x_wallet_address:
        norm = normalize_address(x_wallet_address)
        if norm:
            wallet = norm
            user_id = user_id or f"wallet_{norm}"

    # 3. Check query param wallet_address for direct browser downloads if permitted
    if not wallet and "wallet_address" in request.query_params:
        norm = normalize_address(request.query_params["wallet_address"])
        if norm:
            wallet = norm
            user_id = user_id or f"wallet_{norm}"

    if wallet:
        return AuthenticatedUser(wallet_address=wallet, user_id=user_id or wallet)
    return None


async def get_current_user(
    user: Optional[AuthenticatedUser] = Depends(get_current_user_optional),
) -> AuthenticatedUser:
    """Requires authentication, raising HTTP 401 if not authenticated."""
    if user is None or not user.wallet_address:
        raise HTTPException(
            status_code=401,
            detail="Authentication required. Provide a valid Bearer token or X-Wallet-Address header.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
