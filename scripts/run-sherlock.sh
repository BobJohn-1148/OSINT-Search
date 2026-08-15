#!/usr/bin/env bash
# run-sherlock.sh — take a username, run Sherlock in WSL, emit parseable results + CSV.
# Usage: ./run-sherlock.sh <username> [outdir]   Install: pipx install sherlock-project
set -euo pipefail
USER_NAME="${1:?usage: run-sherlock.sh <username> [outdir]}"
OUTDIR="${2:-/tmp/reacher-sherlock}"; mkdir -p "$OUTDIR"
sherlock "$USER_NAME" --print-found --timeout 20 --csv --folderoutput "$OUTDIR" || true
echo "REACHER_CSV=${OUTDIR}/${USER_NAME}.csv"
