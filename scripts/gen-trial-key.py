#!/usr/bin/env python3
"""
Zyvor Sales — Trial / commercial licence key generator for Aurora.

Usage:
  python3 scripts/gen-trial-key.py --who "Acme Corp" [--days 365]

Customer applies the key:
  export AURORA_LICENSE_KEY="<key>"
  # or Helm: --set license.key="<key>"
  # or Secret data key license.key + --set license.existingSecret=...

KEEP THIS SCRIPT AND THE HMAC_SECRET CONFIDENTIAL — do not ship in customer packages.
"""

from __future__ import annotations

import argparse
import datetime
import sys
from pathlib import Path

# Allow running from repo root without installing the package.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps" / "api"))

from gtm_api.services.licensing import mint_key  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser(description="Generate an Aurora licence key")
    ap.add_argument("--who", required=True, help="Licensee company/name")
    ap.add_argument("--days", type=int, default=365, help="Validity in days (default: 365)")
    ap.add_argument("--issued", help="Override issue date (YYYY-MM-DD)")
    args = ap.parse_args()

    issued = datetime.date.fromisoformat(args.issued) if args.issued else None
    key = mint_key(args.who, days=args.days, issued=issued)
    today = issued or datetime.date.today()
    expiry = today + datetime.timedelta(days=args.days)

    print("\n  Aurora Licence Key")
    print(f"  Licensee : {args.who}")
    print(f"  Issued   : {today}")
    print(f"  Expires  : {expiry}  ({args.days} days)")
    print(f"\n  KEY:\n  {key}\n")
    print("  Delivery:")
    print("  1. Email the key to the customer (sales@zyvor.dev).")
    print('  2. Customer sets: export AURORA_LICENSE_KEY="<key>"')
    print("     or Helm: --set license.key=\"<key>\"")
    print("  3. Restart / rollout the api deployment.\n")


if __name__ == "__main__":
    main()
