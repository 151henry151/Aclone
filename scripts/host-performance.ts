// SPDX-License-Identifier: GPL-3.0-or-later
/** Boundary diagnostics only: never poll these files during a measured window. */
import { readFileSync, readdirSync } from 'node:fs';
import type { CDPSession } from '@playwright/test';

export interface HostReader {
  read(path: string): string | null;
  list(path: string): string[];
}
const files: HostReader = {
  read(path) {
    try {
      return readFileSync(path, 'utf8').trim();
    } catch {
      return null;
    }
  },
  list(path) {
    try {
      return readdirSync(path);
    } catch {
      return [];
    }
  },
};

export function unsignedCounter(value: string | null): string | null {
  // Keep nanosecond counters exact, including values beyond JS safe integers.
  return value !== null && /^\d+$/.test(value) ? value : null;
}

export function threadStat(value: string | null) {
  // comm can contain spaces and parentheses. Field 3 starts after the final ')'.
  if (!value || !/^\d+ \(/.test(value)) return null;
  const end = value.lastIndexOf(')');
  const fields = value
    .slice(end + 1)
    .trim()
    .split(/\s+/);
  const startTicks = unsignedCounter(fields[19] ?? null);
  const lastCpu = unsignedCounter(fields[36] ?? null);
  return end >= 0 && startTicks !== null && lastCpu !== null
    ? { startTicks, lastCpu: Number(lastCpu) }
    : null;
}

type BrowserProcess = { id: number; type: string };
export function linuxHostSnapshot(processes: BrowserProcess[], reader: HostReader = files) {
  const cpuRoot = '/sys/devices/system/cpu';
  const uptimeBefore = reader.read('/proc/uptime')?.split(' ')[0] ?? null;
  const cpus = reader.list(cpuRoot).filter((name) => /^cpu\d+$/.test(name));
  const cpu = cpus
    .sort((a, b) => Number(a.slice(3)) - Number(b.slice(3)))
    .map((name) => {
      const root = `${cpuRoot}/${name}`;
      return {
        id: Number(name.slice(3)),
        siblings: reader.read(`${root}/topology/thread_siblings_list`),
        frequencyKHz: unsignedCounter(reader.read(`${root}/cpufreq/scaling_cur_freq`)),
        governor: reader.read(`${root}/cpufreq/scaling_governor`),
        energyPreference: reader.read(`${root}/cpufreq/energy_performance_preference`),
        thermal: Object.fromEntries(
          [
            'core_throttle_count',
            'core_throttle_total_time_ms',
            'package_throttle_count',
            'package_throttle_total_time_ms',
          ].map((key) => [key, unsignedCounter(reader.read(`${root}/thermal_throttle/${key}`))]),
        ),
      };
    });
  // CDP lists only this owned browser's processes. Do not enumerate host processes
  // or save command lines, environment, usernames or process names.
  const threads = processes
    .filter(
      ({ id, type }) => Number.isSafeInteger(id) && id > 0 && ['renderer', 'GPU'].includes(type),
    )
    .map(({ id, type }) => {
      const root = `/proc/${id}`;
      const before = threadStat(reader.read(`${root}/stat`));
      const status = reader.read(`${root}/status`);
      const sched = reader.read(`${root}/schedstat`)?.split(/\s+/) ?? [];
      const after = threadStat(reader.read(`${root}/stat`));
      const sameThread = before !== null && after?.startTicks === before.startTicks;
      return {
        pid: id,
        type,
        available: sameThread,
        startTicks: sameThread ? before.startTicks : null,
        lastCpu: sameThread ? after!.lastCpu : null,
        allowedCpus: sameThread
          ? (status?.match(/^Cpus_allowed_list:\s*(.+)$/m)?.[1] ?? null)
          : null,
        runtimeNs: sameThread ? unsignedCounter(sched[0] ?? null) : null,
        runqueueWaitNs: sameThread ? unsignedCounter(sched[1] ?? null) : null,
        timeslices: sameThread ? unsignedCounter(sched[2] ?? null) : null,
      };
    });
  return {
    uptimeBefore,
    uptimeAfter: reader.read('/proc/uptime')?.split(' ')[0] ?? null,
    cpu,
    threads,
  };
}

export async function captureHostPerformance(cdp: Pick<CDPSession, 'send'>) {
  const began = performance.now();
  let processes: BrowserProcess[] = [];
  let processInfoAvailable = false;
  try {
    processes = (await cdp.send('SystemInfo.getProcessInfo')).processInfo;
    processInfoAvailable = true;
  } catch {
    // Unsupported CDP/platform or an exited browser is missing evidence, not zero work.
  }
  return {
    platform: process.platform,
    processInfoAvailable,
    linux: process.platform === 'linux' ? linuxHostSnapshot(processes) : null,
    collectionMs: performance.now() - began,
  };
}
