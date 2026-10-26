// SPDX-License-Identifier: GPL-3.0-or-later
import { move } from '../shared/simulation';
import type { Input, Player, World } from '../shared/types';
import type { MotionPose } from './motion';
const idle: Input = { throttle: 0, steer: 0, boost: false };
type Command = { sequence: number; at: number; input: Input };

/** A disposable visual player. Shared movement runs only on this private copy.
 * The server acknowledges the held input and how long it has simulated it.
 * Replay is bounded: a stalled connection must not drive indefinitely. */
export class LocalPrediction {
  private commands: Command[] = [];
  private player?: Player;
  private world?: World;
  private signature = '';
  private receivedAt = -Infinity;
  private sampledAt = 0;
  private input: Input = idle;
  private correction = { x: 0, y: 0, z: 0, heading: 0 };
  correctionMetres = 0;
  reset() {
    this.commands = [];
    this.player = this.world = undefined;
    this.signature = '';
    this.input = idle;
    this.correction = { x: 0, y: 0, z: 0, heading: 0 };
  }
  sent(sequence: number, input: Input, at: number) {
    this.commands.push({ sequence, at, input: { ...input } });
    this.commands = this.commands.slice(-40);
  }
  receive(w: World, p: Player, ack: number, elapsed: number, now: number) {
    const signature = [
      w.id,
      p.id,
      p.deaths,
      p.vehicle,
      p.atHome,
      p.game,
      p.task?.kind,
      p.hitch,
    ].join(':');
    const previous = this.player;
    const jump = previous && Math.hypot(p.x - previous.x, p.z - previous.z) > 12;
    const reset = signature !== this.signature || now - this.receivedAt > 1500 || jump;
    // Reconcile two poses at the same instant. Comparing the replayed snapshot
    // with the last rendered frame mistakes normal travel for a server error,
    // pulling the vehicle backwards a little on every snapshot (especially fast ones).
    if (!reset) this.advanceTo(now, this.input);
    this.world = w;
    this.player = structuredClone(p);
    this.signature = signature;
    this.receivedAt = this.sampledAt = now;
    const command = this.commands.find((c) => c.sequence === ack);
    if (!reset && command) {
      let at = Math.max(command.at + Math.max(0, elapsed) * 1000, now - 500);
      let input = command.input;
      for (const next of this.commands.filter((c) => c.sequence > ack)) {
        if (next.at > at) this.advance(input, Math.min(now, next.at) - at);
        at = Math.max(at, next.at);
        input = next.input;
      }
      this.advance(input, now - at);
    }
    this.commands = reset ? [] : this.commands.filter((c) => c.sequence >= ack);
    const q = this.player;
    this.correctionMetres = previous ? Math.hypot(previous.x - q.x, previous.z - q.z) : 0;
    this.correction =
      !reset && previous && this.correctionMetres < 4
        ? {
            x: previous.x + this.correction.x - q.x,
            y: previous.y + this.correction.y - q.y,
            z: previous.z + this.correction.z - q.z,
            heading: Math.atan2(
              Math.sin(previous.heading + this.correction.heading - q.heading),
              Math.cos(previous.heading + this.correction.heading - q.heading),
            ),
          }
        : { x: 0, y: 0, z: 0, heading: 0 };
  }
  private advance(input: Input, milliseconds: number) {
    if (!this.player || !this.world) return;
    let seconds = Math.max(0, Math.min(500, milliseconds)) / 1000;
    // Match the server's 20 Hz movement integration, including slopes/collisions.
    while (seconds > 0.000001) {
      const dt = Math.min(0.05, seconds);
      move(this.world, this.player, input, dt, true);
      seconds -= dt;
    }
  }
  private advanceTo(now: number, input: Input) {
    const elapsed = Math.min(100, Math.max(0, now - this.sampledAt));
    this.input = input;
    if (now - this.receivedAt <= 500) this.advance(this.input, elapsed);
    this.sampledAt = now;
    const decay = Math.exp(-elapsed / 80);
    for (const k of ['x', 'y', 'z', 'heading'] as const) this.correction[k] *= decay;
  }
  sample(now: number, input: Input): MotionPose | undefined {
    if (!this.player) return;
    this.advanceTo(now, input);
    const p = this.player;
    return {
      x: p.x + this.correction.x,
      y: p.y + this.correction.y,
      z: p.z + this.correction.z,
      heading: p.heading + this.correction.heading,
      speed: p.speed,
      flight: p.flight ? { ...p.flight } : undefined,
    };
  }
}
