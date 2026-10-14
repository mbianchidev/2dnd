#!/usr/bin/env bash
set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
if ! command -v node >/dev/null 2>&1; then
  printf 'Release requires Node.js 24 or newer.\n' >&2
  exit 127
fi
cd "$ROOT"
exec node "$ROOT/hacks/release.mjs" "$@"
