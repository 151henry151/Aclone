import assert from 'node:assert/strict';
import test from 'node:test';
import { GraphicsBudget, pacedRenderTime } from '../src/client/graphics-budget';

test('forced warmup frames recover finite pacing and retain the 30 FPS cap on a 60 Hz display', () => {
  let previous = -Infinity;
  let rendered = 0;
  for (let frame = 0; frame < 600; frame++) {
    const next = pacedRenderTime(frame * (1000 / 60), previous, 1000 / 30);
    if (next === undefined) continue;
    assert.ok(Number.isFinite(next));
    previous = next;
    rendered++;
  }
  assert.ok(rendered >= 299 && rendered <= 301, `Expected 30 FPS, got ${rendered / 10}`);
  assert.equal(pacedRenderTime(500, NaN, 1000 / 30), 500);
  assert.equal(pacedRenderTime(500, 700, 1000 / 30), 500);
});

const frames = (budget: GraphicsBudget, interval: number, count: number) =>
  Array.from({ length: count }, () => budget.observe(interval)).some(Boolean);
test('reduces sustained 10–20 FPS while preserving 30 and 60 FPS', () => {
  for (const interval of [50, 67, 100, 250])
    assert.equal(frames(new GraphicsBudget(), interval, 60), true);
  for (const interval of [16.7, 33.4])
    assert.equal(frames(new GraphicsBudget(), interval, 180), false);
});
test('a single compile hitch does not lower graphics and hidden tabs reset the sample', () => {
  const steady30 = new GraphicsBudget();
  steady30.observe(1000);
  assert.equal(frames(steady30, 33.4, 180), false);
  const budget = new GraphicsBudget();
  budget.observe(1000);
  assert.equal(frames(budget, 16.7, 180), false);
  frames(budget, 100, 15);
  budget.observe(100, false);
  assert.equal(frames(budget, 16.7, 180), false);
  assert.equal(budget.observe(30000), false);
  assert.equal(frames(budget, 16.7, 180), false);
});

test('small display timestamp jitter does not skip frames at the target refresh rate', () => {
  for (const fps of [30, 60]) {
    let previous = -Infinity;
    let rendered = 0;
    for (let frame = 0; frame < 600; frame++) {
      const now = frame * (1000 / fps) + Math.sin(frame * 1.7) * 0.25;
      const next = pacedRenderTime(now, previous, 1000 / fps);
      if (next === undefined) continue;
      previous = next;
      rendered++;
    }
    assert.equal(rendered, 600, `${fps} Hz: skipped ${600 - rendered} frames`);
  }
});

test('pacing retains its long-term cap on faster and jittery displays', () => {
  for (const refresh of [60, 120, 144])
    for (const fps of [30, 60]) {
      let previous = -Infinity;
      let rendered = 0;
      for (let frame = 0; frame < refresh * 10; frame++) {
        const now = frame * (1000 / refresh) + Math.sin(frame * 1.7) * 0.25;
        const next = pacedRenderTime(now, previous, 1000 / fps);
        if (next === undefined) continue;
        previous = next;
        rendered++;
      }
      assert.ok(
        Math.abs(rendered - fps * 10) <= 1,
        `${refresh} Hz / ${fps} FPS: ${rendered} frames`,
      );
    }
});
