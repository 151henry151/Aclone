// SPDX-License-Identifier: GPL-3.0-or-later
type FrameContext = Pick<
  WebGL2RenderingContext,
  | 'SYNC_GPU_COMMANDS_COMPLETE'
  | 'TIMEOUT_EXPIRED'
  | 'fenceSync'
  | 'clientWaitSync'
  | 'deleteSync'
  | 'flush'
  | 'isContextLost'
>;

/** Keep the CPU from submitting seconds of stale views to a slower GPU.
 * Poll fences without blocking input; two frames allow CPU/GPU overlap. */
export class GpuFrameQueue {
  private pending: WebGLSync[] = [];
  constructor(private readonly gl: FrameContext) {}

  canSubmit() {
    const gl = this.gl;
    if (gl.isContextLost()) {
      this.reset();
      return false;
    }
    while (this.pending.length) {
      const sync = this.pending[0];
      if (gl.clientWaitSync(sync, 0, 0) === gl.TIMEOUT_EXPIRED) break;
      // A failed wait can also indicate a sync invalidated by context restoration.
      gl.deleteSync(sync);
      this.pending.shift();
    }
    return this.pending.length < 2;
  }

  submitted() {
    const gl = this.gl;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (!sync) return;
    this.pending.push(sync);
    // Submission must reach the driver even while subsequent renders are held.
    gl.flush();
  }

  reset() {
    for (const sync of this.pending) this.gl.deleteSync(sync);
    this.pending.length = 0;
  }
}
