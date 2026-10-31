// SPDX-License-Identifier: GPL-3.0-or-later
import { sampleMapTerrain, type MapTerrainJob } from './map-terrain-job';
self.onmessage = (event: MessageEvent<MapTerrainJob>) => {
  try {
    self.postMessage({ id: event.data.id, terrain: sampleMapTerrain(event.data) });
  } catch {
    self.postMessage({ id: event.data.id, error: true });
  }
};
