// SPDX-License-Identifier: GPL-3.0-or-later
import type { Player } from '../shared/types';
export type MotionPose = Pick<Player, 'x' | 'y' | 'z' | 'heading' | 'speed'>;
const BUFFER_SECONDS = 0.3;

/** Map monotonic browser time to server simulation time without following packet jitter. */
export class MotionClock {
  private offsets: number[] = [];
  private offset = 0;
  private lastServer = 0;
  private lastReceive?: number;
  private lastSample = 0;
  receive(serverTime: number, receivedAt: number): boolean {
    const reset =
      this.lastReceive === undefined ||
      serverTime < this.lastServer ||
      receivedAt - this.lastReceive > 1500 ||
      Math.abs(serverTime - this.lastServer - (receivedAt - this.lastReceive) / 1000) > 0.5;
    const offset = serverTime - receivedAt / 1000;
    if (reset) {
      this.offsets = [];
      this.offset = offset;
      this.lastSample = receivedAt;
    }
    if (reset || serverTime > this.lastServer) {
      this.offsets.push(offset);
      if (this.offsets.length > 20) this.offsets.shift();
    }
    this.lastServer = serverTime;
    this.lastReceive = receivedAt;
    return reset;
  }
  sample(now: number): number {
    if (!this.offsets.length) return 0;
    // The least delayed recent packet anchors the clock; drift correction is limited to 5%.
    const target = Math.max(...this.offsets),
      step = (Math.max(0, now - this.lastSample) / 1000) * 0.05;
    this.offset += Math.max(-step, Math.min(step, target - this.offset));
    this.lastSample = now;
    return now / 1000 + this.offset - BUFFER_SECONDS;
  }
}

/** Visual-only history. Never predict beyond the server or mutate authoritative player state. */
export class MotionTrack {
  private snapshots: { time: number; pose: MotionPose }[] = [];
  receive(time: number, value: MotionPose): boolean {
    const pose: MotionPose = {
      x: value.x,
      y: value.y,
      z: value.z,
      heading: value.heading,
      speed: value.speed,
    };
    const previous = this.snapshots.at(-1);
    if (previous && time < previous.time) return false;
    const elapsed = previous ? time - previous.time : 0;
    const discontinuity =
      !previous ||
      elapsed > 1.5 ||
      Math.hypot(pose.x - previous.pose.x, pose.y - previous.pose.y, pose.z - previous.pose.z) >
        Math.max(
          12,
          Math.max(Math.abs(pose.speed), Math.abs(previous.pose.speed)) * elapsed * 2 + 2,
        );
    if (discontinuity) this.snapshots = [];
    else if (previous.time === time) this.snapshots.pop();
    this.snapshots.push({ time, pose });
    if (this.snapshots.length > 8) this.snapshots.shift();
    return discontinuity;
  }
  sample(time: number): MotionPose | undefined {
    const first = this.snapshots[0];
    if (!first) return;
    if (time <= first.time) return { ...first.pose };
    for (let i = 1; i < this.snapshots.length; i++) {
      const a = this.snapshots[i - 1],
        b = this.snapshots[i];
      if (time > b.time) continue;
      const fraction = (time - a.time) / (b.time - a.time);
      const lerp = (key: 'x' | 'y' | 'z' | 'speed') =>
        a.pose[key] + (b.pose[key] - a.pose[key]) * fraction;
      const turn = Math.atan2(
        Math.sin(b.pose.heading - a.pose.heading),
        Math.cos(b.pose.heading - a.pose.heading),
      );
      return {
        x: lerp('x'),
        y: lerp('y'),
        z: lerp('z'),
        speed: lerp('speed'),
        heading: a.pose.heading + turn * fraction,
      };
    }
    return { ...this.snapshots.at(-1)!.pose };
  }
}
