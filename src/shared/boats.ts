// SPDX-License-Identifier: GPL-3.0-or-later
import { vehicleDef } from './vehicle-config';
import type { World } from './types';
/** Appended slots preserve existing vehicles and creator slots 8–23. */
export const FISHING_BOAT = 30;
export const CHARTER_BOAT = 31;
export const TUGBOAT = 32;
export const MOTORBOAT = 33;
export const throttleBoat = (slot: number, w?: Pick<World, 'vehicleTuning'>) =>
  vehicleDef(w, slot).persistentThrottle ??
  (slot === FISHING_BOAT || slot === CHARTER_BOAT || slot === TUGBOAT);
export const poweredBoat = (slot: number, w?: Pick<World, 'vehicleTuning'>) =>
  slot !== 29 && vehicleDef(w, slot).mode === 3;
export const boatSlot = (slot: number, w?: Pick<World, 'vehicleTuning'>) =>
  vehicleDef(w, slot).mode === 3;
export const mooringKey = (owner: string, slot: number) => `${owner}:${slot}`;
