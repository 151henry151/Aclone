#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Deploy the pushed main branch to https://nogits.com/aclone/ over SSH.
# Run from a workstation that can `ssh root@nogits.com`. The server's private
# .env is never read or copied; the service loads it itself on restart.
#
# Steps: refuse a dirty server checkout, take an online SQLite backup,
# fast-forward to origin/main, `npm ci` when the lockfile changed, build with
# the /aclone/ prefix, restart, then check the public page, its assets and
# /api/health report the expected version.
#
# Override with DEPLOY_HOST, DEPLOY_DIR, DEPLOY_USER, DEPLOY_SERVICE,
# DEPLOY_DATA_DIR, DEPLOY_REF, BASE_PATH and PUBLIC_URL.
set -euo pipefail

host="${DEPLOY_HOST:-root@nogits.com}"
dir="${DEPLOY_DIR:-/opt/aclone}"
user="${DEPLOY_USER:-aclone}"
service="${DEPLOY_SERVICE:-aclone}"
data="${DEPLOY_DATA_DIR:-/var/lib/aclone}"
ref="${DEPLOY_REF:-origin/main}"
base="${BASE_PATH:-/aclone/}"
[[ "$base" == */ ]] || base="$base/"
url="${PUBLIC_URL:-https://nogits.com/aclone/}"

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
git fetch -q origin
target="$(git rev-parse "$ref")"
version="$(git show "$target:package.json" | sed -nE 's/^  "version": "([^"]+)".*/\1/p')"
if [[ "$(git rev-parse HEAD)" != "$target" ]]; then
  echo "Note: local HEAD is not $ref; deploying $ref ($(git log -1 --format=%h "$target"))." >&2
fi
echo "Deploying $version ($(git log -1 --format='%h %s' "$target")) to $host:$dir"

ssh "$host" bash -s -- "$dir" "$user" "$service" "$data" "$base" "$target" <<'REMOTE'
set -euo pipefail
dir=$1 user=$2 service=$3 data=$4 base=$5 target=$6
cd "$dir"
as() { runuser -u "$user" -- "$@"; }
if [[ -n "$(as git status --porcelain)" ]]; then
  echo "The server checkout has local changes. Commit or discard them first:" >&2
  as git status --short >&2
  exit 1
fi
before="$(as git rev-parse HEAD)"
echo "Backing up the database before upgrading from $(as git log -1 --format=%h)…"
as env DATA_DIR="$data" npm run -s backup -- "$data/backups/pre-deploy-$(date +%Y%m%d-%H%M%S).sqlite"
as git fetch -q origin
as git merge -q --ff-only "$target"
if ! as git diff --quiet "$before" HEAD -- package-lock.json; then
  echo 'Dependencies changed; running npm ci…'
  as npm ci --no-audit --no-fund
fi
as env BASE_PATH="$base" npm run -s build
if ! grep -q "src=\"${base}assets/" dist/index.html; then
  echo "dist/index.html does not load assets from $base; not restarting." >&2
  exit 1
fi
systemctl restart "$service"
sleep 3
systemctl is-active --quiet "$service"
journalctl -u "$service" -n 2 --no-pager -o cat
REMOTE

origin="$(sed -E 's#^(https?://[^/]+).*#\1#' <<<"$url")"
page="$(curl -fsS "$url")"
script="$(grep -oE 'src="[^"]+\.js"' <<<"$page" | head -1 | cut -d'"' -f2)"
if [[ "$script" != "$base"* ]]; then
  echo "The public page loads its script from '$script', outside $base." >&2
  exit 1
fi
type="$(curl -fsS -o /dev/null -w '%{content_type}' "$origin$script")"
if [[ "$type" != *javascript* ]]; then
  echo "$origin$script is served as '$type', not JavaScript." >&2
  exit 1
fi
health="$(curl -fsS "${url}api/health")"
if [[ "$health" != *"\"version\":\"$version\""* ]]; then
  echo "Health check did not report $version: $health" >&2
  exit 1
fi
echo "Deployed $version: $url ($health)"
