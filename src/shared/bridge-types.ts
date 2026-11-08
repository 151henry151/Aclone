// SPDX-License-Identifier: GPL-3.0-or-later
import type { Point } from './town';
export type BridgeMaterial = 'steel' | 'wood' | 'gravel' | 'stone';
export interface BridgeBill {
  cash: number;
  materials: Record<BridgeMaterial, number>;
}
export interface BridgeRamp {
  rows: { distance: number; heights: number[] }[];
}
/** Persist surveyed dimensions: later design-rule edits must not reshape a funded bridge. */
export interface BridgePlan {
  a: Point;
  b: Point;
  approachA: Point;
  approachB: Point;
  width: number;
  deckY: number;
  thickness: number;
  grade: number;
  ramps: [BridgeRamp, BridgeRamp];
  foundationLength: number;
  /** Lowest surveyed ground under each full-width concrete bank seat. */
  foundations: [number, number];
  river: string;
  highWater: number;
  bill: BridgeBill;
}
export interface Bridge extends BridgePlan {
  id: string;
  owner: string;
  foundedAt: number;
  completedAt?: number;
  condition: number;
  wearAt: number;
  revision: number;
  /** Safety closure keeps the deck intact and lets existing occupants leave. */
  closure?: string;
  paid: BridgeBill;
  contributors: Record<string, BridgeBill>;
}
export type BridgeSurvey =
  | { id: string; status: 'pending' }
  | { id: string; status: 'failed'; reason: string }
  | { id: string; status: 'ready'; plan: BridgePlan };
