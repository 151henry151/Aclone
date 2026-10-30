// SPDX-License-Identifier: GPL-3.0-or-later
export const hudPanels = {
  map: 'Minimap',
  chat: 'Chat',
  status: 'Health, needs & employment',
  players: 'Players in the parish',
  inventory: 'Inventory preview',
  journal: 'Getting started guide',
  vehicle: 'Speed & vehicle controls',
  location: 'Location, time & weather',
  shortcuts: 'Action shortcuts',
} as const;
export type HudPanel = keyof typeof hudPanels;
export type HudSettings = Record<HudPanel, boolean>;
export const defaultHud: HudSettings = {
  map: true,
  chat: true,
  status: true,
  players: false,
  inventory: true,
  journal: false,
  vehicle: true,
  location: true,
  shortcuts: true,
};
export function readHud(value: string | null): HudSettings {
  const settings = { ...defaultHud };
  try {
    const saved = JSON.parse(value ?? 'null');
    for (const key of Object.keys(settings) as HudPanel[])
      if (typeof saved?.[key] === 'boolean') settings[key] = saved[key];
  } catch {
    /* Use usable defaults if storage is corrupt. */
  }
  return settings;
}
export class HudPanels {
  readonly settings: HudSettings;
  constructor(
    private root: HTMLElement,
    private storage: Pick<Storage, 'getItem' | 'setItem'>,
  ) {
    let saved = null;
    try {
      saved = storage.getItem('aclone.hud');
    } catch {
      /* Private browsing. */
    }
    this.settings = readHud(saved);
    this.apply();
  }
  set(panel: HudPanel, visible: boolean) {
    this.settings[panel] = visible;
    this.apply();
  }
  preset(all = false) {
    Object.assign(
      this.settings,
      all ? Object.fromEntries(Object.keys(hudPanels).map((k) => [k, true])) : defaultHud,
    );
    this.apply();
  }
  private apply() {
    for (const key of Object.keys(hudPanels) as HudPanel[])
      this.root.classList.toggle('hud-hide-' + key, !this.settings[key]);
    try {
      this.storage.setItem('aclone.hud', JSON.stringify(this.settings));
    } catch {
      /* Still works for this visit. */
    }
  }
}
