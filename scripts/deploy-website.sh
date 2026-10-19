#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Publish only when authorized. Does not restart or change the game or its database.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
npm run build:website
host="${DEPLOY_HOST:-root@nogits.com}"
site="${WEBSITE_DIR:-/var/www/nogits.com}"
stage="$(ssh "$host" mktemp -d /tmp/aclone-website.XXXXXXXX)"
[[ "$stage" == /tmp/aclone-website.* ]] || { echo 'Invalid staging directory' >&2; exit 1; }
trap 'ssh "$host" rm -rf -- "$stage"' EXIT
scp -q -r website-dist/. "$host:$stage/"
ssh "$host" bash -s -- "$site" "$stage" <<'REMOTE'
set -euo pipefail
site=$1 stage=$2
mkdir -p /var/backups/aclone-website "$site"
# Keep the existing site, including legacy image links and ACME files, recoverable.
backup="/var/backups/aclone-website/site-$(date +%Y%m%d-%H%M%S).tar.gz"
tar -czf "$backup" -C "$site" .
cp -R "$stage/assets" "$site/"
cp "$stage/site.css" "$stage/site.js" "$site/"
mkdir -p "$site/buildings"
cp "$stage/buildings/gallery.css" "$stage/buildings/gallery.js" "$site/buildings/"
cp "$stage/buildings/index.html" "$site/buildings/index.html.next"
chmod -R a+rX "$site/buildings"
mv "$site/buildings/index.html.next" "$site/buildings/index.html"
cp "$stage/index.html" "$site/index.html.next"
chmod -R a+rX "$site/assets"
chmod a+r "$site/site.css" "$site/site.js" "$site/index.html.next"
mv "$site/index.html.next" "$site/index.html"
echo "Published website; previous files saved at $backup"
REMOTE
curl -fsS "${WEBSITE_URL:-https://nogits.com/}" | grep -F 'A little world.' >/dev/null
echo "Website available at ${WEBSITE_URL:-https://nogits.com/}"
