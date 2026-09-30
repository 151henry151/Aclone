// SPDX-License-Identifier: GPL-3.0-or-later
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { Store } from './store.ts';
import { Universe, tokenHash, type Account } from './universe.ts';
export type Mailer = (
  to: string,
  link: string,
  purpose: 'verify' | 'reset',
  pilot: string,
) => Promise<void>;
const password = z.string().min(12, 'Use at least 12 characters').max(128);
let hashing = 0;
async function derive(value: string, salt: string): Promise<Buffer> {
  if (hashing >= 4) throw Error('Sign-in service is busy. Try again shortly.');
  hashing++;
  try {
    return await new Promise<Buffer>((resolve, reject) =>
      scrypt(value, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }, (err, key) =>
        err ? reject(err) : resolve(key),
      ),
    );
  } finally {
    hashing--;
  }
}
async function hash(value: string) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + (await derive(password.parse(value), salt)).toString('hex');
}
async function matches(value: string, encoded?: string) {
  if (typeof value !== 'string' || value.length > 128) return false;
  const [salt, key] = (encoded ?? '0'.repeat(32) + ':' + '0'.repeat(128)).split(':');
  const result = await derive(value, salt);
  return timingSafeEqual(result, Buffer.from(key, 'hex')) && !!encoded;
}
export class Accounts {
  constructor(
    private store: Store,
    private universe: Universe,
    private mail?: Mailer,
    private origin?: string,
  ) {
    store.db
      .exec(`CREATE TABLE IF NOT EXISTS credentials (account TEXT PRIMARY KEY REFERENCES accounts(id), password TEXT NOT NULL, email TEXT, verified INTEGER NOT NULL DEFAULT 0);
      DROP INDEX IF EXISTS credential_email;
      CREATE UNIQUE INDEX IF NOT EXISTS verified_credential_email ON credentials(email) WHERE verified=1 AND email IS NOT NULL;
      CREATE TABLE IF NOT EXISTS recovery (hash TEXT PRIMARY KEY, account TEXT NOT NULL REFERENCES accounts(id), purpose TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS recovery_account ON recovery(account);`);
  }
  private credentials(id: string) {
    return this.store.db.prepare('SELECT * FROM credentials WHERE account=?').get(id);
  }
  status(id: string) {
    const row = this.credentials(id);
    return {
      password: !!row,
      email: row?.email ?? '',
      verified: !!row?.verified,
      recoveryAvailable: !!this.mail && !!this.origin,
    };
  }
  async configure(
    id: string,
    data: { password: string; currentPassword?: string; email?: string },
  ) {
    password.parse(data.password);
    const before = this.credentials(id);
    if (before && !(await matches(data.currentPassword ?? '', String(before.password))))
      throw Error('Enter your current password');
    const email = data.email?.trim()
      ? z.email().max(254).parse(data.email.trim()).toLowerCase()
      : (before?.email ?? null);
    if (email && (!this.mail || !this.origin))
      throw Error(
        'Email recovery is not configured on this server. You can still set a password without email.',
      );
    if (
      email &&
      this.store.db
        .prepare('SELECT account FROM credentials WHERE email=? AND verified=1 AND account<>?')
        .get(email, id)
    )
      throw Error('Unable to save credentials. That email may already be in use.');
    const encoded = await hash(data.password);
    // Recheck after asynchronous hashing so concurrent credential changes cannot overwrite one another.
    if (this.credentials(id)?.password !== before?.password)
      throw Error('Account changed. Please try again.');
    try {
      this.store.transaction(() => {
        this.store.db
          .prepare(
            'INSERT INTO credentials VALUES (?,?,?,?) ON CONFLICT(account) DO UPDATE SET password=excluded.password,email=excluded.email,verified=excluded.verified',
          )
          .run(id, encoded, email, email === before?.email ? Number(before?.verified ?? 0) : 0);
        this.store.db.prepare('DELETE FROM recovery WHERE account=?').run(id);
      });
    } catch {
      throw Error('Unable to save credentials. That email may already be in use.');
    }
    let deliveryError = false;
    if (email && !this.status(id).verified) {
      try {
        await this.deliver(id, String(email), 'verify');
      } catch {
        deliveryError = true;
      }
    }
    return { ...this.status(id), deliveryError };
  }
  async login(name: string, value: string) {
    const row = this.store.db
      .prepare('SELECT id FROM accounts WHERE name_key=?')
      .get(String(name).normalize('NFKC').trim().toLocaleLowerCase('en-US'));
    const before = row ? this.credentials(String(row.id)) : undefined;
    if (!(await matches(value, before ? String(before.password) : undefined)) || !row)
      throw Error('Invalid pilot name or password');
    if (this.credentials(String(row.id))?.password !== before?.password)
      throw Error('Account changed. Please sign in again.');
    return this.rotate(String(row.id));
  }
  rotate(id: string) {
    const token = randomBytes(32).toString('base64url');
    this.store.db.prepare('UPDATE accounts SET token_hash=? WHERE id=?').run(tokenHash(token), id);
    const account = JSON.parse(
      String(this.store.db.prepare('SELECT state FROM accounts WHERE id=?').get(id)!.state),
    ) as Account;
    return { token, account };
  }
  async resend(id: string) {
    const row = this.credentials(id);
    if (!row?.email || row.verified) throw Error('No unverified recovery email');
    if (
      this.store.db
        .prepare("SELECT hash FROM recovery WHERE account=? AND purpose='verify' AND expires>?")
        .get(id, Date.now() + 86340000)
    )
      return;
    await this.deliver(id, String(row.email), 'verify');
  }
  async requestReset(email: string) {
    if (!this.mail || !this.origin) throw Error('Email recovery is not configured on this server');
    const row = this.store.db
      .prepare('SELECT account FROM credentials WHERE email=? AND verified=1')
      .get(String(email).trim().toLowerCase());
    if (
      row &&
      this.store.db
        .prepare("SELECT hash FROM recovery WHERE account=? AND purpose='reset' AND expires>?")
        .get(row.account, Date.now() + 1740000)
    )
      return;
    if (row) await this.deliver(String(row.account), email.trim().toLowerCase(), 'reset');
  }
  private async deliver(id: string, email: string, purpose: 'verify' | 'reset') {
    if (!this.mail || !this.origin) throw Error('Email recovery is not configured on this server');
    const token = randomBytes(32).toString('base64url');
    const link = new URL(this.origin);
    link.hash = purpose + '=' + token;
    this.store.transaction(() => {
      this.store.db
        .prepare('DELETE FROM recovery WHERE expires<? OR (account=? AND purpose=?)')
        .run(Date.now(), id, purpose);
      this.store.db
        .prepare('INSERT INTO recovery VALUES (?,?,?,?)')
        .run(
          tokenHash(token),
          id,
          purpose,
          Date.now() + (purpose === 'verify' ? 86400000 : 1800000),
        );
    });
    try {
      await this.mail(
        email,
        link.toString(),
        purpose,
        String(this.store.db.prepare('SELECT name FROM accounts WHERE id=?').get(id)!.name),
      );
    } catch {
      this.store.db.prepare('DELETE FROM recovery WHERE hash=?').run(tokenHash(token));
      throw Error('Email delivery failed. Please try again later.');
    }
  }
  private link(token: string, purpose: string) {
    const row = this.store.db
      .prepare('SELECT account FROM recovery WHERE hash=? AND purpose=? AND expires>?')
      .get(tokenHash(String(token)), purpose, Date.now());
    if (!row) throw Error('Link is invalid or expired. Request a new one.');
    return String(row.account);
  }
  verify(token: string) {
    this.store.transaction(() => {
      const id = this.link(token, 'verify');
      this.store.db.prepare('UPDATE credentials SET verified=1 WHERE account=?').run(id);
      this.store.db.prepare('DELETE FROM recovery WHERE hash=?').run(tokenHash(token));
    });
  }
  async reset(token: string, value: string) {
    this.link(token, 'reset');
    const encoded = await hash(value);
    return this.store.transaction(() => {
      const id = this.link(token, 'reset');
      this.store.db.prepare('UPDATE credentials SET password=? WHERE account=?').run(encoded, id);
      this.store.db.prepare('DELETE FROM recovery WHERE account=?').run(id);
      this.rotate(id); // invalidate every old pilot key; the reset link never signs in automatically
      return id;
    });
  }
}
