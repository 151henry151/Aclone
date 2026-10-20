#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Install the changelog publisher on nogits when explicitly requested.
# The bot token and verified channel ID must already be in /etc/aclone-discord.env.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
host="${DEPLOY_HOST:-root@nogits.com}"
stage="$(ssh "$host" mktemp -d /tmp/aclone-discord.XXXXXXXX)"
[[ "$stage" == /tmp/aclone-discord.* ]] || exit 1
trap 'ssh "$host" rm -rf -- "$stage"' EXIT
scp -q scripts/discord-changelog.ts deploy/aclone-discord.service deploy/aclone-discord.timer "$host:$stage/"
ssh "$host" bash -s -- "$stage" <<'REMOTE'
set -euo pipefail
stage=$1
test -f /etc/aclone-discord.env
test -f /opt/aclone/CHANGELOG.md
node --env-file=/etc/aclone-discord.env -e 'if (!process.env.DISCORD_CHANGELOG_BOT_TOKEN || !process.env.DISCORD_CHANGELOG_CHANNEL_ID) process.exit(1)'
chmod 600 /etc/aclone-discord.env
chown root:root /etc/aclone-discord.env
if ! id aclone-discord >/dev/null 2>&1; then
  useradd --system --no-create-home --shell /usr/sbin/nologin aclone-discord
fi
# Stop only the publisher when updating its code. Discord history preserves
# accepted messages even if an earlier backfill was interrupted.
systemctl stop aclone-discord.timer aclone-discord.service 2>/dev/null || true
install -d -m 755 /opt/aclone-discord
install -m 644 "$stage/discord-changelog.ts" /opt/aclone-discord/discord-changelog.ts
install -m 644 "$stage/aclone-discord.service" /etc/systemd/system/aclone-discord.service
install -m 644 "$stage/aclone-discord.timer" /etc/systemd/system/aclone-discord.timer
node_binary="$(command -v node)"
sed -i "s|^ExecStart=/usr/bin/node |ExecStart=$node_binary |" /etc/systemd/system/aclone-discord.service
systemd-analyze verify /etc/systemd/system/aclone-discord.service /etc/systemd/system/aclone-discord.timer
systemctl daemon-reload
systemctl enable --now aclone-discord.timer
systemctl start aclone-discord.service
systemctl is-active aclone-discord.timer
systemctl show aclone-discord.service -p Result -p ExecMainStatus
REMOTE
