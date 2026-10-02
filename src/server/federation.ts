// SPDX-License-Identifier: GPL-3.0-or-later
import {
  createHash,
  generateKeyPairSync,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  randomUUID,
  sign,
  verify,
} from 'node:crypto';
import { chmodSync, existsSync } from 'node:fs';
import { z } from 'zod';
import type { Store } from './store.ts';
import { Universe, tokenHash, type Account } from './universe.ts';
function galaxyUrl(value: string) {
  const u = new URL(value);
  if (
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    !(
      u.protocol === 'https:' ||
      (u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname))
    )
  )
    throw Error('Galaxy URLs must use HTTPS (loopback HTTP is allowed for development)');
  return u.href.replace(/\/$/, '');
}
export const peerSchema = z.object({
  name: z.string().min(1).max(64),
  url: z.string().transform(galaxyUrl),
  key: z.string().min(40).max(128),
});
export const federationConfigSchema = z.object({
  name: z.string().min(1).max(64),
  url: z.string().transform(galaxyUrl),
  peers: z.array(peerSchema).max(32).default([]),
});
export type FederationConfig = z.input<typeof federationConfigSchema>;
const certificateSchema = z.object({
  v: z.literal(1),
  home: z.string(),
  sub: z.string().uuid(),
  name: z.string().min(2).max(24),
});
const ticketSchema = z.object({
  v: z.literal(1),
  iss: z.string(),
  aud: z.string(),
  jti: z.string().uuid(),
  iat: z.number().int(),
  exp: z.number().int(),
  certificate: z.string().max(2048),
});
export class Federation {
  readonly config: z.output<typeof federationConfigSchema>;
  private privateKey: ReturnType<typeof createPrivateKey>;
  readonly publicKey: string;
  constructor(
    private store: Store,
    private universe: Universe,
    config: FederationConfig,
    private now = () => Math.floor(Date.now() / 1000),
  ) {
    this.config = federationConfigSchema.parse(config);
    if (
      new Set(this.config.peers.map((p) => p.url)).size !== this.config.peers.length ||
      this.config.peers.some((p) => p.url === this.config.url)
    )
      throw Error('Galaxy peers must be distinct other servers');
    for (const p of this.config.peers)
      if (
        createPublicKey({ key: Buffer.from(p.key, 'base64url'), format: 'der', type: 'spki' })
          .asymmetricKeyType !== 'ed25519'
      )
        throw Error('Peer keys must be Ed25519 public keys');
    // This database now holds signing material; keep the database and existing
    // SQLite journals private to the service account before writing the key.
    if (store.path !== ':memory:')
      for (const file of [store.path, store.path + '-wal', store.path + '-shm'])
        if (existsSync(file)) chmodSync(file, 0o600);
    const row = store.db.prepare("SELECT value FROM meta WHERE key='galaxy-signing-key'").get();
    const secret = row
      ? String(row.value)
      : generateKeyPairSync('ed25519')
          .privateKey.export({ type: 'pkcs8', format: 'pem' })
          .toString();
    if (!row) store.db.prepare("INSERT INTO meta VALUES ('galaxy-signing-key',?)").run(secret);
    this.privateKey = createPrivateKey(secret);
    this.publicKey = createPublicKey(this.privateKey)
      .export({ type: 'spki', format: 'der' })
      .toString('base64url');
    store.db.exec(
      'CREATE TABLE IF NOT EXISTS galaxy_visitors(home TEXT NOT NULL,subject TEXT NOT NULL,account TEXT NOT NULL,PRIMARY KEY(home,subject)); CREATE TABLE IF NOT EXISTS galaxy_arrivals(issuer TEXT NOT NULL,ticket TEXT NOT NULL,expires INTEGER NOT NULL,PRIMARY KEY(issuer,ticket));',
    );
  }
  descriptor() {
    return { protocol: 1, name: this.config.name, url: this.config.url, key: this.publicKey };
  }
  directory() {
    return {
      ...this.descriptor(),
      peers: this.config.peers.map(({ name, url }) => ({ name, url })),
    };
  }
  private signed(value: unknown) {
    const data = Buffer.from(JSON.stringify(value)).toString('base64url');
    return data + '.' + sign(null, Buffer.from(data), this.privateKey).toString('base64url');
  }
  private verified(token: string, key: string) {
    const parts = token.split('.');
    if (parts.length !== 2 || !parts.every((v) => /^[A-Za-z0-9_-]+$/.test(v)))
      throw Error('Invalid travel signature');
    const pub = createPublicKey({
      key: Buffer.from(key, 'base64url'),
      format: 'der',
      type: 'spki',
    });
    if (!verify(null, Buffer.from(parts[0]), pub, Buffer.from(parts[1], 'base64url')))
      throw Error('Invalid travel signature');
    return JSON.parse(Buffer.from(parts[0], 'base64url').toString());
  }
  private key(url: string) {
    if (url === this.config.url) return this.publicKey;
    const peer = this.config.peers.find((p) => p.url === url);
    if (!peer)
      throw Error(
        'This galaxy does not trust the issuing galaxy; ask its host to connect both servers',
      );
    return peer.key;
  }
  issue(account: Account, destination: string) {
    const peer = this.config.peers.find((p) => p.url === destination);
    if (!peer) throw Error('Choose a connected galaxy');
    if (account.npc || account.transit) throw Error('Finish your current journey first');
    const certificate =
      account.traveler?.certificate ??
      this.signed({ v: 1, home: this.config.url, sub: account.id, name: account.name });
    const now = this.now();
    const ticket = this.signed({
      v: 1,
      iss: this.config.url,
      aud: peer.url,
      jti: randomUUID(),
      iat: now,
      exp: now + 120,
      certificate,
    });
    return { url: peer.url + '/#arrival=' + encodeURIComponent(ticket), expires: now + 120 };
  }
  private validate(token: string) {
    if (token.length > 6000) throw Error('Travel ticket too large');
    // Parse only to select an already-pinned key; never fetch URLs supplied by a visitor.
    let unsigned: any;
    try {
      unsigned = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());
    } catch {
      throw Error('Malformed travel ticket');
    }
    const ticket = ticketSchema.parse(this.verified(token, this.key(unsigned.iss)));
    const now = this.now();
    if (
      ticket.aud !== this.config.url ||
      ticket.exp < now ||
      ticket.iat > now + 30 ||
      ticket.exp - ticket.iat > 120 ||
      ticket.exp <= ticket.iat
    )
      throw Error('Travel ticket expired or addressed to another galaxy');
    let identity: any;
    try {
      identity = JSON.parse(Buffer.from(ticket.certificate.split('.')[0], 'base64url').toString());
    } catch {
      throw Error('Malformed character passport');
    }
    const cert = certificateSchema.parse(
      this.verified(ticket.certificate, this.key(identity.home)),
    );
    return { ticket, cert };
  }
  preview(token: string) {
    const { ticket, cert } = this.validate(token);
    return {
      name: cert.name,
      home: cert.home,
      from: ticket.iss,
      destination: this.config.name,
      returningHome: cert.home === this.config.url,
      expires: ticket.exp,
    };
  }
  arrive(token: string, local?: { account: Account; token: string }) {
    const { ticket, cert } = this.validate(token),
      now = this.now();
    // Foreign hosts can assert guest visits, never authenticate a native account.
    if (
      cert.home === this.config.url &&
      (!local || local.account.id !== cert.sub || local.account.traveler)
    )
      throw Error('Sign in to your home pilot here before completing the return journey');
    return this.store.transaction(() => {
      this.store.db.prepare('DELETE FROM galaxy_arrivals WHERE expires<?').run(now - 300);
      if (
        this.store.db
          .prepare('SELECT 1 FROM galaxy_arrivals WHERE issuer=? AND ticket=?')
          .get(ticket.iss, ticket.jti)
      )
        throw Error('This travel ticket has already been used');
      let result: { account: Account; token: string };
      if (cert.home === this.config.url) result = local!;
      else {
        const row = this.store.db
          .prepare('SELECT account FROM galaxy_visitors WHERE home=? AND subject=?')
          .get(cert.home, cert.sub);
        if (row) {
          const saved = this.store.db
            .prepare('SELECT state FROM accounts WHERE id=?')
            .get(row.account as string);
          if (!saved) throw Error('Visitor record is unavailable');
          const account = JSON.parse(String(saved.state)) as Account;
          const key = randomBytes(32).toString('base64url');
          this.store.db
            .prepare('UPDATE accounts SET token_hash=? WHERE id=?')
            .run(tokenHash(key), account.id);
          result = { account, token: key };
        } else {
          const suffix = createHash('sha256')
            .update(cert.home + cert.sub)
            .digest('hex')
            .slice(0, 6);
          let name = cert.name.slice(0, 17) + ' ' + suffix;
          // A native player may already use the display suffix; never adopt that account.
          while (
            this.store.db
              .prepare('SELECT 1 FROM accounts WHERE name_key=?')
              .get(name.normalize('NFKC').toLocaleLowerCase('en-US'))
          )
            name = cert.name.slice(0, 15) + ' ' + randomBytes(4).toString('hex');
          result = this.universe.register(name);
          this.store.db
            .prepare('INSERT INTO galaxy_visitors VALUES (?,?,?)')
            .run(cert.home, cert.sub, result.account.id);
        }
        result.account.traveler = {
          home: cert.home,
          subject: cert.sub,
          name: cert.name,
          certificate: ticket.certificate,
        };
        this.universe.save(result.account);
      }
      this.store.db
        .prepare('INSERT INTO galaxy_arrivals VALUES (?,?,?)')
        .run(ticket.iss, ticket.jti, ticket.exp);
      return { ...result, home: cert.home, displayName: cert.name };
    });
  }
}
