// SPDX-License-Identifier: GPL-3.0-or-later
import { createWorld, addPlayer } from '../../src/shared/simulation';
import { creatorSchema } from '../../src/shared/creator';

export function hovercraftWorld(id = 'hovercraft', owner = 'pilot') {
  const w = createWorld(id, 'Hovercraft handling', owner);
  w.script = '';
  w.buildings = [];
  w.towns = [];
  w.terrain = [];
  w.zones = [];
  w.roads = [];
  w.creator = creatorSchema.parse({ scenery: false, roads: false, weather: 'clear' });
  w.landscape = {
    paths: [],
    surfaces: [],
    barriers: [],
    scatter: [],
    heightmap: Array(1089).fill(20),
  };
  Object.assign(w.settings, {
    mapSize: 2000,
    seaLevel: -50,
    hungerRate: 0,
    thirstRate: 0,
    vehicleMaintenance: false,
    dayLength: 0,
    time: 43200,
  });
  const p = addPlayer(w, owner, 'Hovercraft pilot');
  Object.assign(p, {
    x: 0,
    z: 0,
    y: 20.5,
    heading: 0,
    speed: 20,
    vehicle: 4,
    fleet: [0, 4, 5],
    fuel: 50,
    fuelVehicle: 4,
    engine: true,
    inventory: {},
    skills: ['driver', 'captain'],
    authority: 20,
  });
  return { w, p };
}
