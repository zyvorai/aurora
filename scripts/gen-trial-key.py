#!/usr/bin/env python3
"""Deprecated — use scripts/trial-tool.py (Ed25519 signed trial.token)."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

TOOL = Path(__file__).resolve().parent / "trial-tool.py"


def main() -> None:
    args = sys.argv[1:]
    who = None
    days = "30"
    i = 0
    while i < len(args):
        if args[i] == "--who" and i + 1 < len(args):
            who = args[i + 1]
            i += 2
            continue
        if args[i] == "--days" and i + 1 < len(args):
            days = args[i + 1]
            i += 2
            continue
        i += 1
    if not who:
        print("Usage: gen-trial-key.py --who NAME [--days N]", file=sys.stderr)
        print("Prefer: python3 scripts/trial-tool.py issue --who NAME --days N -o trial.token", file=sys.stderr)
        sys.exit(2)
    cmd = [
        sys.executable,
        str(TOOL),
        "issue",
        "--who",
        who,
        "--days",
        days,
        "-o",
        "trial.token",
    ]
    raise SystemExit(subprocess.call(cmd))


if __name__ == "__main__":
    main()
