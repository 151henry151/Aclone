// SPDX-License-Identifier: GPL-3.0-or-later
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const API = 'https://discord.com/api/v10';
const REPO = 'https://github.com/151henry151/Aclone';
export const OFFICIAL_GUILD = '1562183434254680175';
const REQUIRED_PERMISSIONS = 1024n | 2048n | 16384n | 32768n | 65536n;
export type Release = { version: string; date: string; notes: string };
type Embed = {
  title?: string;
  url?: string;
  description?: string;
  color?: number;
  footer?: { text: string };
};
export type Post = {
  payload: {
    embeds: Embed[];
    allowed_mentions: { parse: string[] };
    nonce: string;
    enforce_nonce: boolean;
    flags: number;
    attachments?: { id: number; filename: string }[];
  };
  attachment?: { name: string; text: string };
};
type Message = { id: string; author: { id: string }; embeds?: Embed[] };
type Overwrite = { id: string; type: number; allow: string; deny: string };
type Channel = {
  id: string;
  guild_id: string;
  name: string;
  type: number;
  permission_overwrites: Overwrite[];
};
type Role = { id: string; permissions: string };
export type Transport = <T>(path: string, post?: Post) => Promise<T>;

export function parseChangelog(markdown: string): Release[] {
  const headings = [...markdown.replace(/\r\n/g, '\n').matchAll(/^## (.+)$/gm)];
  const text = markdown.replace(/\r\n/g, '\n');
  const releases: Release[] = [];
  const versions = new Set<string>();
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    if (heading[1] === '[Unreleased]') continue;
    const match =
      /^\[((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[\da-zA-Z.-]+)?(?:\+[\da-zA-Z.-]+)?)\] - (\d{4}-\d{2}-\d{2})$/.exec(
        heading[1],
      );
    if (!match) throw Error(`Invalid release heading: ${heading[1]}`);
    const [, version, date] = match;
    const timestamp = new Date(`${date}T00:00:00Z`);
    if (!Number.isFinite(timestamp.getTime()) || timestamp.toISOString().slice(0, 10) !== date)
      throw Error(`Invalid release date for ${version}`);
    if (versions.has(version)) throw Error(`Duplicate release ${version}`);
    versions.add(version);
    const notes = text
      .slice(heading.index! + heading[0].length, headings[i + 1]?.index ?? text.length)
      .trim();
    if (!notes) throw Error(`Release ${version} has no notes`);
    releases.push({ version, date, notes });
  }
  if (!releases.length) throw Error('No dated releases found');
  // Keep the changelog's deliberate order for releases on the same date.
  return releases.reverse();
}

export function releasePost(release: Release, channel: string): Post {
  const marker = `aclone-release:${release.version}`;
  const title = `Aclone ${release.version} · ${release.date}`;
  const full = `# ${title}\n\n${release.notes}\n`;
  const tooLong = release.notes.length > 4096;
  const description = tooLong
    ? release.notes.slice(0, 3600).replace(/\s+\S*$/, '') +
      '\n\n**Full release notes are attached to this message.**'
    : release.notes;
  const attachment = tooLong ? { name: `aclone-${release.version}.md`, text: full } : undefined;
  return {
    payload: {
      embeds: [
        {
          title,
          url: `${REPO}/blob/main/CHANGELOG.md`,
          description,
          color: 0x203e33,
          footer: { text: marker },
        },
      ],
      allowed_mentions: { parse: [] },
      nonce: createHash('sha256').update(`${channel}:${marker}`).digest('hex').slice(0, 24),
      enforce_nonce: true,
      flags: 4096, // Suppress push notifications during historical backfill and retry.
      ...(attachment ? { attachments: [{ id: 0, filename: attachment.name }] } : {}),
    },
    ...(attachment ? { attachment } : {}),
  };
}

export function permissionsFor(
  guild: string,
  bot: string,
  memberRoles: string[],
  roles: Role[],
  overwrites: Overwrite[],
): bigint {
  const ids = new Set([guild, ...memberRoles]);
  let permissions = roles
    .filter((r) => ids.has(r.id))
    .reduce((bits, r) => bits | BigInt(r.permissions), 0n);
  if (permissions & 8n) return REQUIRED_PERMISSIONS;
  const apply = (deny: bigint, allow: bigint) => {
    permissions = (permissions & ~deny) | allow;
  };
  const everyone = overwrites.find((o) => o.type === 0 && o.id === guild);
  if (everyone) apply(BigInt(everyone.deny), BigInt(everyone.allow));
  const roleOverrides = overwrites.filter((o) => o.type === 0 && o.id !== guild && ids.has(o.id));
  apply(
    roleOverrides.reduce((p, o) => p | BigInt(o.deny), 0n),
    roleOverrides.reduce((p, o) => p | BigInt(o.allow), 0n),
  );
  const personal = overwrites.find((o) => o.type === 1 && o.id === bot);
  if (personal) apply(BigInt(personal.deny), BigInt(personal.allow));
  return permissions;
}

export function discordTransport(
  token: string,
  fetcher: typeof fetch = fetch,
  sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
): Transport {
  return async <T>(path: string, post?: Post): Promise<T> => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const headers: Record<string, string> = {
        Authorization: `Bot ${token}`,
        'User-Agent': `DiscordBot (${REPO}, 1.0)`,
      };
      let body: BodyInit | undefined;
      if (post?.attachment) {
        const form = new FormData();
        form.set('payload_json', JSON.stringify(post.payload));
        form.set(
          'files[0]',
          new Blob([post.attachment.text], { type: 'text/plain;charset=utf-8' }),
          post.attachment.name,
        );
        body = form;
      } else if (post) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(post.payload);
      }
      let response: Response;
      try {
        response = await fetcher(`${API}${path}`, {
          method: post ? 'POST' : 'GET',
          headers,
          body,
          signal: AbortSignal.timeout(20_000),
          redirect: 'error',
        });
      } catch {
        // Do not blindly repeat an ambiguously accepted POST. A fresh run scans
        // durable channel history before deciding which releases still need posting.
        throw Error('Discord network request failed. Rerun to reconcile channel history safely.');
      }
      if (response.status === 429) {
        const limit = (await response.json()) as { retry_after?: number };
        const delay = Number(limit.retry_after);
        if (attempt === 4 || !Number.isFinite(delay) || delay < 0 || delay > 60)
          throw Error(
            'Discord is rate limited; rerun later. Already posted releases will be skipped.',
          );
        await sleep(Math.ceil(delay * 1000) + 100);
        continue;
      }
      if (!response.ok)
        throw Error(
          `Discord returned HTTP ${response.status}. Check bot membership and channel permissions, then rerun.`,
        );
      const result = (await response.json()) as T;
      const reset = Number(response.headers.get('x-ratelimit-reset-after'));
      if (
        response.headers.get('x-ratelimit-remaining') === '0' &&
        Number.isFinite(reset) &&
        reset > 0 &&
        reset <= 60
      )
        await sleep(Math.ceil(reset * 1000) + 100);
      return result;
    }
    throw Error('Discord request exhausted its retry limit');
  };
}

export async function publishReleases(
  releases: Release[],
  options: {
    guild: string;
    channel: string;
    send: boolean;
    transport: Transport;
    log?: (message: string) => void;
  },
) {
  const { guild, channel, send, transport: api, log = console.log } = options;
  if (!/^\d{17,20}$/.test(guild) || !/^\d{17,20}$/.test(channel))
    throw Error('Set numeric Discord guild and channel IDs');
  const bot = await api<{ id: string; bot: boolean }>('/users/@me');
  if (!bot.bot) throw Error('A dedicated bot token is required; user tokens are not supported');
  const target = await api<Channel>(`/channels/${channel}`);
  if (
    target.id !== channel ||
    target.guild_id !== guild ||
    target.name !== 'changelog' ||
    ![0, 5].includes(target.type)
  )
    throw Error(
      'The destination must be the configured server’s #changelog text or announcement channel',
    );
  const member = await api<{ roles: string[] }>(`/guilds/${guild}/members/${bot.id}`);
  const roles = await api<Role[]>(`/guilds/${guild}/roles`);
  const permissions = permissionsFor(
    guild,
    bot.id,
    member.roles,
    roles,
    target.permission_overwrites,
  );
  if ((permissions & REQUIRED_PERMISSIONS) !== REQUIRED_PERMISSIONS)
    throw Error(
      'Bot needs View Channel, Send Messages, Embed Links, Attach Files and Read Message History in #changelog',
    );
  // Without Read Message History Discord may return an empty page. Verify it
  // explicitly above: an empty history must not cause a duplicate backfill.
  const published = new Set<string>();
  const messageIds = new Set<string>();
  let before = '';
  for (;;) {
    const page = await api<Message[]>(
      `/channels/${channel}/messages?limit=100${before ? `&before=${before}` : ''}`,
    );
    if (!Array.isArray(page)) throw Error('Invalid channel history response');
    if (!page.length) break;
    for (const message of page) {
      if (!/^\d+$/.test(message.id) || messageIds.has(message.id))
        throw Error('Channel history pagination did not advance');
      messageIds.add(message.id);
      if (message.author.id !== bot.id) continue;
      for (const embed of message.embeds ?? []) {
        const text = embed.footer?.text;
        if (text?.startsWith('aclone-release:'))
          published.add(text.slice('aclone-release:'.length));
      }
    }
    before = page.at(-1)!.id;
  }
  const pending = releases.filter((r) => !published.has(r.version));
  log(
    `${send ? 'Publish' : 'Preview'}: ${pending.length} missing releases; ${releases.length - pending.length} already posted.`,
  );
  let posted = 0;
  for (const release of pending) {
    if (send) {
      const message = await api<Message>(
        `/channels/${channel}/messages`,
        releasePost(release, channel),
      );
      if (
        !message.id ||
        message.author.id !== bot.id ||
        !message.embeds?.some((e) => e.footer?.text === `aclone-release:${release.version}`)
      )
        throw Error(
          `Discord did not confirm release ${release.version}; rerun to reconcile history`,
        );
      posted++;
    }
    log(`${send ? 'Posted' : 'Would post'} ${release.version} (${release.date})`);
  }
  return { posted, pending: pending.length, skipped: releases.length - pending.length };
}

async function main() {
  const args = process.argv.slice(2);
  if (
    args.some((a) => !['--send', '--preview'].includes(a)) ||
    (args.includes('--send') && args.includes('--preview'))
  )
    throw Error('Usage: npm run changelog:discord -- [--preview | --send]');
  const releases = parseChangelog(
    await readFile(
      process.env.DISCORD_CHANGELOG_PATH || new URL('../CHANGELOG.md', import.meta.url),
      'utf8',
    ),
  );
  if (!args.includes('--send') && !process.env.DISCORD_CHANGELOG_BOT_TOKEN) {
    for (const release of releases) {
      const post = releasePost(release, 'preview');
      console.log(
        `${release.version} · ${release.date} · ${release.notes.length} characters${post.attachment ? ' · full notes attached' : ''}`,
      );
    }
    console.log(`${releases.length} dated releases. Offline preview only; no Discord requests.`);
    return;
  }
  const token = process.env.DISCORD_CHANGELOG_BOT_TOKEN;
  if (!token) throw Error('Missing DISCORD_CHANGELOG_BOT_TOKEN');
  await publishReleases(releases, {
    guild: process.env.DISCORD_CHANGELOG_GUILD_ID || OFFICIAL_GUILD,
    channel: process.env.DISCORD_CHANGELOG_CHANNEL_ID || '',
    send: args.includes('--send'),
    transport: discordTransport(token),
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
