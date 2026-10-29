// SPDX-License-Identifier: GPL-3.0-or-later
/** Appended slots preserve existing vehicles and creator slots 8–23. */
export const FISHING_BOAT = 30;
export const CHARTER_BOAT = 31;
export const throttleBoat = (slot: number) => slot === FISHING_BOAT || slot === CHARTER_BOAT;
export const poweredBoat = (slot: number) => slot === 3 || throttleBoat(slot);
export const boatSlot = (slot: number) => poweredBoat(slot) || slot === 29;
export const mooringKey = (owner: string, slot: number) => `${owner}:${slot}`;
