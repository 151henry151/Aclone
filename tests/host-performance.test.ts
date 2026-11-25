// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  linuxHostSnapshot,
  threadStat,
  unsignedCounter,
  type HostReader,
} from '../scripts/host-performance';

function stat(start = '1234', cpu = '7') {
  const fields = Array(50).fill('0');
  fields[0] = 'R';
  fields[19] = start;
  fields[36] = cpu;
  return `42 (renderer (test)) ${fields.join(' ')}`;
}
function reader(entries: Record<string, string> = {}): HostReader {
  return { read: (path) => entries[path] ?? null, list: () => ['cpu7', 'cpufreq', 'cpu0'] };
}

test('thread identity and last CPU survive spaces and parentheses in comm', () => {
  assert.deepEqual(threadStat(stat()), { startTicks: '1234', lastCpu: 7 });
  for (const invalid of [null, '', '42 (exited)', stat('bad'), stat('1', '-1')])
    assert.equal(threadStat(invalid), null);
});

test('missing and malformed counters stay unavailable, large counters remain exact', () => {
  for (const invalid of [null, '', '-1', '1.5', 'NaN'])
    assert.equal(unsignedCounter(invalid), null);
  assert.equal(unsignedCounter('9007199254740993123'), '9007199254740993123');
  assert.equal(unsignedCounter('0'), '0');
  const snapshot = linuxHostSnapshot([{ id: 42, type: 'renderer' }], reader());
  assert.equal(snapshot.uptimeBefore, null);
  assert.deepEqual(
    snapshot.cpu.map((cpu) => cpu.id),
    [0, 7],
  );
  assert.equal(snapshot.cpu[0].thermal.core_throttle_count, null);
  assert.equal(snapshot.threads[0].available, false);
  assert.equal(snapshot.threads[0].runtimeNs, null);
});

test('only owned renderer and GPU main threads are read; status fields are allowlisted', () => {
  const snapshot = linuxHostSnapshot(
    [
      { id: 42, type: 'renderer' },
      { id: 42, type: 'GPU' },
      { id: 99, type: 'browser' },
      { id: -1, type: 'renderer' },
    ],
    reader({
      '/proc/42/stat': stat(),
      '/proc/42/status': 'Name: private\nCpus_allowed_list:\t0-7\n',
      '/proc/42/schedstat': '9007199254740993123 200 30',
      '/proc/uptime': '12.50 80.00',
    }),
  );
  assert.equal(snapshot.threads.length, 2);
  assert.deepEqual(snapshot.threads[0], {
    pid: 42,
    type: 'renderer',
    available: true,
    startTicks: '1234',
    lastCpu: 7,
    allowedCpus: '0-7',
    runtimeNs: '9007199254740993123',
    runqueueWaitNs: '200',
    timeslices: '30',
  });
  assert.equal(JSON.stringify(snapshot).includes('private'), false);
});

test('a process exiting or PID reused mid-read does not mix two thread identities', () => {
  for (const second of [null, stat('9999')]) {
    let reads = 0;
    const source = reader({ '/proc/42/schedstat': '100 200 3' });
    const read = source.read;
    source.read = (path) =>
      path.endsWith('/stat') ? (++reads === 1 ? stat() : second) : read(path);
    const snapshot = linuxHostSnapshot([{ id: 42, type: 'renderer' }], source);
    assert.equal(snapshot.threads[0].available, false);
    assert.equal(snapshot.threads[0].runtimeNs, null);
  }
});
