#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")/.."
export PNPM_HOME="$PWD/.tools/pnpm"
export npm_config_cache="$PWD/.cache/npm"
export electron_config_cache="$PWD/.cache/electron"
export XDG_CACHE_HOME="$PWD/.cache"
export XDG_CONFIG_HOME="$PWD/.cache/xdg-config"
mkdir -p "$PNPM_HOME" "$npm_config_cache" "$electron_config_cache" "$XDG_CONFIG_HOME"
node -e "const [major,minor]=process.versions.node.split('.').map(Number);if(major!==24||minor<19)throw Error('Node 24.19+ (24.x) is required')"
if ! command -v pnpm >/dev/null || [ "$(pnpm --version)" != "11.25.0" ]; then
  npm install --prefix "$PWD/.tools/package-manager" --no-audit --no-fund pnpm@11.25.0
  export PATH="$PWD/.tools/package-manager/node_modules/.bin:$PATH"
fi
if [ -n "${HTTPS_PROXY:-}${HTTP_PROXY:-}" ]; then export ELECTRON_GET_USE_PROXY=1; fi
pnpm install --frozen-lockfile
# Official pinned installer verifies the package's checksums; returns immediately if installed.
node node_modules/electron/install.js
pnpm check
