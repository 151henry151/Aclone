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
  private intervals: number[] = [];
  private buffer = BUFFER_SECONDS;
  private targetBuffer = BUFFER_SECONDS;
  get bufferMs() {
    return Math.round(this.buffer * 1000);
  }
  receive(serverTime: number, receivedAt: number): boolean {
    const reset =
      this.lastReceive === undefined ||
      serverTime < this.lastServer ||
      receivedAt - this.lastReceive > 1500;
    const offset = serverTime - receivedAt / 1000;
    if (reset) {
      this.offsets = [];
      this.intervals = [];
      this.buffer = this.targetBuffer = BUFFER_SECONDS;
      this.offset = offset;
      this.lastSample = receivedAt;
    }
    if (!reset && serverTime > this.lastServer) {
      this.intervals.push(serverTime - this.lastServer);
      if (this.intervals.length > 20) this.intervals.shift();
    }
    if (reset || serverTime > this.lastServer) {
      this.offsets.push(offset);
      if (this.offsets.length > 20) this.offsets.shift();
    }
    const percentile = (values: number[], fraction: number) =>
      [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * fraction)] ?? 0;
    const jitter = Math.max(...this.offsets) - percentile(this.offsets, 0.1);
    // Healthy links keep the existing 300 ms buffer. Only variable delivery or
    // flow-controlled snapshot intervals call for more history (up to 800 ms).
    this.targetBuffer = Math.min(
      0.8,
      Math.max(BUFFER_SECONDS, percentile(this.intervals, 0.9) + 0.1 + Math.max(0, jitter - 0.1)),
    );
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
    const elapsed = Math.max(0, now - this.lastSample) / 1000;
    // Grow smoothly instead of rewinding; recover slowly so isolated good packets
    // don't make an unstable connection oscillate between buffer sizes.
    this.buffer += Math.max(
      -elapsed * 0.02,
      Math.min(elapsed * 0.5, this.targetBuffer - this.buffer),
    );
    this.lastSample = now;
    return now / 1000 + this.offset - this.buffer;
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
