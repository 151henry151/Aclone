// SPDX-License-Identifier: GPL-3.0-or-later
/** Downsample and frame mono audio off the rendering/UI thread. */
class RadioCapture extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const { rate, samples } = options.processorOptions;
    this.ratio = sampleRate / rate;
    this.phase = 0;
    this.sum = 0;
    this.count = 0;
    this.frame = new Int16Array(samples);
    this.index = 0;
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    for (const value of input) {
      this.sum += value;
      this.count++;
      this.phase++;
      if (this.phase < this.ratio) continue;
      this.phase -= this.ratio;
      const average = Math.max(-1, Math.min(1, this.sum / this.count));
      this.frame[this.index++] = Math.round(average * 32767);
      this.sum = 0;
      this.count = 0;
      if (this.index === this.frame.length) {
        const next = new Int16Array(this.frame.length);
        this.port.postMessage(this.frame.buffer, [this.frame.buffer]);
        this.frame = next;
        this.index = 0;
      }
    }
    return true;
  }
}
registerProcessor('radio-capture', RadioCapture);
