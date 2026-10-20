// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  discordTransport,
  OFFICIAL_GUILD,
  parseChangelog,
  permissionsFor,
  publishReleases,
  releasePost,
  type Post,
  type Transport,
} from '../scripts/discord-changelog';

const channel = '1562183438403112963';
const bot = '1562183434254680199';
const role = '1562183434254680198';
const all = 117760n;
const sample =
  '# Changelog\n\n## [Unreleased]\n### Added\n- Future\n\n## [1.1.0] - 2026-10-20\n### Added\n- Two\n\n## [1.0.0] - 2026-10-19\n### Fixed\n- One\n';
const releases = parseChangelog(sample);
const quiet = () => {};
function fixture() {
  const messages: { id: string; author: { id: string }; embeds: Post['payload']['embeds'] }[] = [];
  const paths: string[] = [];
  let posts = 0;
  let failAfterAccept = false;
  let channelName = 'changelog';
  let bits = all;
  const transport: Transport = async <T>(path: string, post?: Post): Promise<T> => {
    paths.push(path);
    let result: unknown;
    if (path === '/users/@me') result = { id: bot, bot: true };
    else if (path === `/channels/${channel}`)
      result = {
        id: channel,
        guild_id: OFFICIAL_GUILD,
        name: channelName,
        type: 0,
        permission_overwrites: [],
      };
    else if (path.includes('/members/')) result = { roles: [role] };
    else if (path.endsWith('/roles')) result = [{ id: role, permissions: bits.toString() }];
    else if (post) {
      posts++;
      const message = {
        id: String(1000 + messages.length),
        author: { id: bot },
        embeds: post.payload.embeds,
      };
      messages.unshift(message);
      if (failAfterAccept) {
        failAfterAccept = false;
        throw Error('Lost response after Discord accepted');
      }
      result = message;
    } else {
      const before = new URL(`https://example.test${path}`).searchParams.get('before');
      // Small pages prove that pagination cannot stop merely because length <100.
      result = messages.filter((m) => !before || BigInt(m.id) < BigInt(before)).slice(0, 1);
    }
    return result as T;
  };
  const run = (send = true) =>
    publishReleases(releases, { guild: OFFICIAL_GUILD, channel, send, transport, log: quiet });
  return {
    messages,
    paths,
    run,
    get posts() {
      return posts;
    },
    interrupt: () => {
      failAfterAccept = true;
    },
    wrongChannel: () => {
      channelName = 'general';
    },
    noHistory: () => {
      bits &= ~65536n;
    },
  };
}

test('dated releases are oldest first, Unreleased excluded, malformed/duplicate entries refused', () => {
  assert.deepEqual(
    releases.map((r) => r.version),
    ['1.0.0', '1.1.0'],
  );
  assert.equal(releases[1].notes, '### Added\n- Two');
  assert.deepEqual(parseChangelog(sample.replaceAll('\n', '\r\n')), releases);
  assert.throws(() => parseChangelog(sample.replace('1.1.0', '1.0.0')), /Duplicate/);
  assert.throws(() => parseChangelog(sample.replace('2026-10-20', '2026-02-30')), /date/);
  assert.throws(() => parseChangelog('## [bad]\n- broken'), /heading/);
  assert.throws(() => parseChangelog('## [Unreleased]\n- nothing published'), /No dated/);
  assert.throws(() => parseChangelog('## [1.0.0] - 2026-10-20\n'), /no notes/);
});

test('real changelog preserves every dated release within Discord limits', async () => {
  const text = await readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  const parsed = parseChangelog(text);
  assert.equal(parsed.length, [...text.matchAll(/^## \[.+\] - /gm)].length);
  for (const release of parsed) {
    const post = releasePost(release, channel);
    assert.ok(post.payload.embeds[0].description!.length <= 4096);
    if (post.attachment) assert.ok(post.attachment.text.includes(release.notes));
    else assert.equal(post.payload.embeds[0].description, release.notes);
    assert.deepEqual(post.payload.allowed_mentions, { parse: [] });
    assert.ok(post.payload.nonce.length <= 25);
    assert.equal(post.payload.enforce_nonce, true);
  }
});

test('oversized release stays one message with complete notes attached', () => {
  const release = { ...releases[0], notes: 'Long release notes. '.repeat(600) };
  const post = releasePost(release, channel);
  assert.ok(post.attachment?.text.includes(release.notes));
  assert.ok(post.payload.embeds[0].description!.length <= 4096);
  assert.equal(post.payload.attachments?.length, 1);
  assert.equal(releasePost(release, channel).payload.nonce, post.payload.nonce);
  assert.notEqual(releasePost(release, 'another-channel').payload.nonce, post.payload.nonce);
});

test('backfill is oldest first and reruns/revised notes create no duplicates', async () => {
  const f = fixture();
  assert.deepEqual(await f.run(), { posted: 2, pending: 2, skipped: 0 });
  assert.deepEqual(
    f.messages.map((m) => m.embeds[0].footer?.text),
    ['aclone-release:1.1.0', 'aclone-release:1.0.0'],
  );
  assert.deepEqual(await f.run(), { posted: 0, pending: 0, skipped: 2 });
  assert.equal(f.posts, 2);
  assert.ok(f.paths.some((p) => p.includes('&before=')));
});

test('resume after accepted POST with lost response does not duplicate it', async () => {
  const f = fixture();
  f.interrupt();
  await assert.rejects(f.run(), /Lost response/);
  assert.deepEqual(await f.run(), { posted: 1, pending: 1, skipped: 1 });
  assert.equal(f.posts, 2);
});

test('preview never sends and other authors cannot forge posted releases', async () => {
  const f = fixture();
  f.messages.push({
    id: '9',
    author: { id: 'other' },
    embeds: [{ footer: { text: 'aclone-release:1.0.0' } }],
  });
  assert.deepEqual(await f.run(false), { posted: 0, pending: 2, skipped: 0 });
  assert.equal(f.posts, 0);
  await f.run();
  assert.equal(f.posts, 2);
});

test('wrong channel and missing history permission fail before reading or posting', async () => {
  const f = fixture();
  f.wrongChannel();
  await assert.rejects(f.run(), /destination/);
  const missing = fixture();
  missing.noHistory();
  await assert.rejects(missing.run(), /Read Message History/);
  assert.equal(missing.posts, 0);
  assert.ok(!missing.paths.some((p) => p.includes('/messages')));
});

test('Discord permission precedence applies everyone, role union, then member overrides', () => {
  const roles = [
    { id: OFFICIAL_GUILD, permissions: all.toString() },
    { id: role, permissions: '0' },
  ];
  assert.equal(
    permissionsFor(OFFICIAL_GUILD, bot, [role], roles, [
      { id: OFFICIAL_GUILD, type: 0, deny: '65536', allow: '0' },
    ]) & 65536n,
    0n,
  );
  const overrides = [
    { id: OFFICIAL_GUILD, type: 0, deny: '65536', allow: '0' },
    { id: role, type: 0, deny: '0', allow: '65536' },
  ];
  assert.equal(permissionsFor(OFFICIAL_GUILD, bot, [role], roles, overrides), all);
  overrides.push({ id: bot, type: 1, deny: '65536', allow: '0' });
  assert.equal(permissionsFor(OFFICIAL_GUILD, bot, [role], roles, overrides) & 65536n, 0n);
});

test('transport honors 429 and bucket delays and only sends bot auth to Discord', async () => {
  const sleeps: number[] = [];
  let calls = 0;
  const transport = discordTransport(
    'test-secret',
    (async (url, init) => {
      assert.ok(String(url).startsWith('https://discord.com/api/v10/'));
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bot test-secret');
      assert.equal(init?.redirect, 'error');
      calls++;
      return calls === 1
        ? new Response(JSON.stringify({ retry_after: 0.25 }), { status: 429 })
        : new Response('{}', {
            headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset-after': '0.5' },
          });
    }) as typeof fetch,
    async (ms) => {
      sleeps.push(ms);
    },
  );
  await transport('/users/@me');
  assert.deepEqual(sleeps, [350, 600]);
});

test('transport does not retry ambiguous writes or expose server error bodies/secrets', async () => {
  let calls = 0;
  const transport = discordTransport('test-secret', (async () => {
    calls++;
    throw Error('test-secret');
  }) as typeof fetch);
  await assert.rejects(
    transport('/channels/1/messages', releasePost(releases[0], channel)),
    (error: Error) => !error.message.includes('test-secret'),
  );
  assert.equal(calls, 1);
  const denied = discordTransport(
    'test-secret',
    (async () => new Response('test-secret', { status: 403 })) as typeof fetch,
  );
  await assert.rejects(denied('/users/@me'), /HTTP 403/);
});

test('oversized notes use multipart with matching attachment metadata', async () => {
  const post = releasePost({ ...releases[0], notes: 'Long notes. '.repeat(600) }, channel);
  const transport = discordTransport('test-secret', (async (_url, init) => {
    assert.ok(init?.body instanceof FormData);
    const body = init.body as FormData;
    assert.equal(
      JSON.parse(body.get('payload_json') as string).attachments[0].filename,
      post.attachment!.name,
    );
    assert.equal(await (body.get('files[0]') as Blob).text(), post.attachment!.text);
    return new Response('{}');
  }) as typeof fetch);
  await transport('/channels/1/messages', post);
});
