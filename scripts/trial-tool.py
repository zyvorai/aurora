#!/usr/bin/env python3
"""
Zyvor Sales — Ed25519 trial token tooling for Aurora (private repo only).

Matches Veyron's trial-tool (keygen / issue). Do NOT ship this script or
secrets/ in customer packages. Uses only ``cryptography`` (no PyJWT).

Usage:
  python3 scripts/trial-tool.py keygen
  python3 scripts/trial-tool.py issue --who "Acme Corp" --days 30 -o trial.token
"""

from __future__ import annotations

import argparse
import base64
import json
from datetime import datetime, timezone
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PRIVATE = ROOT / "secrets" / "trial-ed25519-private.pem"
DEFAULT_PUBLIC = ROOT / "secrets" / "trial-ed25519-public.b64"
PRODUCT_TAG = "aurora-trial"


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def mint_token(who: str, days: int, private_pem: bytes) -> str:
    private = serialization.load_pem_private_key(private_pem, password=None)
    if not isinstance(private, Ed25519PrivateKey):
        raise SystemExit("private key must be Ed25519")
    now = datetime.now(tz=timezone.utc)
    claims = {
        "sub": who,
        "iat": int(now.timestamp()),
        "exp": int(now.timestamp()) + int(days) * 86_400,
        "product": PRODUCT_TAG,
    }
    header = _b64url(json.dumps({"alg": "EdDSA", "typ": "JWT"}, separators=(",", ":")).encode())
    payload = _b64url(json.dumps(claims, separators=(",", ":")).encode())
    signing_input = f"{header}.{payload}".encode()
    sig = _b64url(private.sign(signing_input))
    return f"{header}.{payload}.{sig}"


def cmd_keygen(out_private: Path) -> None:
    out_private.parent.mkdir(parents=True, exist_ok=True)
    key = Ed25519PrivateKey.generate()
    pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    )
    out_private.write_bytes(pem)
    out_private.chmod(0o600)
    pub = key.public_key().public_bytes(
        serialization.Encoding.Raw,
        serialization.PublicFormat.Raw,
    )
    pub_b64 = base64.b64encode(pub).decode()
    DEFAULT_PUBLIC.parent.mkdir(parents=True, exist_ok=True)
    DEFAULT_PUBLIC.write_text(pub_b64 + "\n")
    print(f"Wrote private PEM → {out_private}")
    print(f"Wrote public b64  → {DEFAULT_PUBLIC}")
    print("\nPaste into apps/api/gtm_api/services/licensing.py:\n")
    print(f'TRIAL_PUBLIC_KEY_B64 = "{pub_b64}"')


def cmd_issue(who: str, days: int, private_key: Path, output: Path) -> None:
    token = mint_token(who, days, private_key.read_bytes())
    output.write_text(token + "\n")
    print(f"Issued {PRODUCT_TAG} token for \"{who}\" → {output} ({days} days)")
    print("Ship trial.token next to the package (or set AURORA_TRIAL_TOKEN / AURORA_LICENSE_KEY).")


def main() -> None:
    ap = argparse.ArgumentParser(description="Aurora Ed25519 trial token tool")
    sub = ap.add_subparsers(dest="cmd", required=True)
    kg = sub.add_parser("keygen", help="Generate Ed25519 keypair")
    kg.add_argument("--out-private", type=Path, default=DEFAULT_PRIVATE)
    iss = sub.add_parser("issue", help="Sign a trial.token")
    iss.add_argument("--who", required=True)
    iss.add_argument("--days", type=int, default=30)
    iss.add_argument("--private-key", type=Path, default=DEFAULT_PRIVATE)
    iss.add_argument("-o", "--output", type=Path, default=Path("trial.token"))
    args = ap.parse_args()
    if args.cmd == "keygen":
        cmd_keygen(args.out_private)
    else:
        cmd_issue(args.who, args.days, args.private_key, args.output)


if __name__ == "__main__":
    main()
