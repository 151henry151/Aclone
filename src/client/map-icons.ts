// SPDX-License-Identifier: GPL-3.0-or-later
/** Purpose-specific, font-free line symbols drawn on a shared 24×24 grid. */
export const buildingMapIcons: Readonly<Record<string, string>> = {
  market: 'M3 9h18l-2-6H5zM5 9v12h14V9M8 21v-7h5v7M16 13h1',
  workhouse: 'M3 7h18v14H3zM8 7V3h8v4M3 12h18M10 11v4h4v-4',
  school: 'M2 8 12 3l10 5-10 5zM6 11v6q6 5 12 0v-6M22 8v10',
  home: 'M2 10 12 2 22 10M5 9v13h14V9M10 22v-8h4v8',
  pub: 'M4 5h12v14q-6 4-12 0zM16 7h3q5 5-3 8M8 8v8M12 8v8',
  garage: 'M14 3a6 6 0 0 0-7 8L2 18l4 4 7-7a6 6 0 0 0 8-7l-5 4-4-4z',
  starport: 'M12 2Q5 7 8 16h8q3-9-4-14zM8 11l-5 7h5M16 11l5 7h-5M10 19l2 4 2-4M10 8h4',
  bank: 'M2 7 12 2 22 7zM4 10v8M8 10v8M16 10v8M20 10v8M2 22h20M2 19h20',
  town: 'M4 22V10h16v12M2 10h20L12 3zM12 3V1h6v3M9 22v-6h6v6M6 13h2M16 13h2',
  farm: 'M12 22V3M12 9C5 9 5 3 5 3s7 0 7 6M12 15c7 0 7-6 7-6s-7 0-7 6M3 22l3-4M18 18l3 4',
  mill: 'M7 22l2-12h6l2 12zM12 10 4 2H2v2zM12 10l8-8h2v2zM12 10l8 8v2h-2zM12 10l-8 8H2v-2z',
  bakery: 'M3 15C1 5 7 2 12 6c5-4 11-1 9 9v6H3zM8 8v5M16 8v5M4 17h16',
  sawmill: 'M3 5h18v5H3zM6 10v11M18 10v11M9 14l3-3 3 3-3 4zM2 18h20',
  quarry: 'M2 21h20M3 18l3-9h7l3 9zM13 9l3-6h4l2 15h-6M6 9l4 9',
  mason: 'M2 12h20v10H2zM2 17h20M8 12v5M16 17v5M6 8l3-6 9 5zM12 7l3 4',
  mine: 'M2 21V11L12 2l10 9v10M6 21V12l6-6 6 6v9M8 22l3-9M16 22l-3-9M9 18h6',
  forge: 'M2 8h20l-6 6H9l-5-2zM10 14v5H7v3h12v-3h-5v-5M10 5l2-3 2 3',
  brewery: 'M7 8q5-4 10 0v10q-5 4-10 0zM7 11h10M7 16h10M10 5V2M14 5V2M4 21h16',
  workshop: 'M2 7l5-5 5 5-3 3-3-3-2 2zM9 10l10 12 3-3-12-10M3 22l5-6M16 6l4-4 2 2-4 4',
  refinery: 'M3 22V8h5v14M4 8V3h3v5M12 22V11q4-5 8 0v11M12 15h8M1 22h22M8 18h4',
  rareMine: 'M3 9l5-7h8l5 7-9 13zM3 9h18M8 2l4 20 4-20',
  factory: 'M2 22V10l7 4V8l7 5V3h5v19zM5 18h2M11 18h2M17 18h2',
  shipyard: 'M3 15h18l-4 5H7zM5 15V3h16M5 3l10 5M17 3v7l-2 2M2 23h20',
  warehouse: 'M2 9 12 2 22 9v13H2zM6 22V11h12v11M6 15h12M6 19h12',
  turret: 'M6 22v-6h12v6M4 16l4-7h8l4 7zM15 9l6-6 2 2-6 6M9 20h6',
  portal: 'M12 2a9 10 0 1 0 0 20 9 10 0 1 0 0-20M12 6a5 6 0 1 0 0 12M12 9l4 3-4 3',
  notice: 'M3 3h18v15H3zM6 18v4M18 18v4M7 7h10M7 11h10M7 15h5',
  scripted: 'M10 22V15C0 17 0 8 6 7c0-7 12-7 12 0 7 1 5 11-4 8v7M10 19l-3-3M14 18l3-3',
  pickup: 'M2 5h20v16H2zM6 8v10M10 8v10M14 8v10M18 8v10M2 3v2M22 3v2',
  composter:
    'M4 12l4-8h7M4 12l-2-4M4 12l5-1M17 5l5 8-3 5M17 5l4 1M17 5l-1 5M17 21H7l-3-5M17 21l-2-4M17 21l-3 2',
  brickworks: 'M2 22V10l10-8 10 8v12zM7 22v-7q5-7 10 0v7M2 10h20M5 6h14M12 16q-4 4 0 5 4-1 0-5',
  concreteWorks: 'M6 5h10l5 6-5 6H6L2 11zM8 5v12M6 17l-3 5M16 17l3 5M8 21h7M21 11h2V5',
  carpenter: 'M3 10h18v5H3zM5 15v7M19 15v7M6 10V3h12v7M6 6h12',
  winery: 'M8 3h8v6q0 5-4 5t-4-5zM12 14v7M7 22h10M8 7h8',
  kitchen: 'M4 20a8 8 0 0 1 16 0zM2 22h20M10 10h4M12 10v2M6 7V3M12 6V1M18 7V3',
  teaHouse: 'M3 10h15v6q0 5-7 5t-8-5zM18 11h2q5 3-2 6M6 7Q3 5 6 2M12 7q-3-2 0-5M2 23h19',
  roastery: 'M18 3C8-3-2 13 6 20c8 7 19-10 12-17zM18 3C8 5 15 15 6 20',
  bnb: 'M2 12 12 3l10 9M4 11v11M20 11v11M4 17h16v4H4M6 17v-4h5v4M13 16h5',
  hotel: 'M5 22V2h14v20M2 22h20M9 5h1M14 5h1M9 9h1M14 9h1M9 13h1M14 13h1M10 22v-5h4v5',
  waterworks: 'M12 2C9 7 4 11 4 15a8 7 0 0 0 16 0C20 11 15 7 12 2zM8 15q0 4 4 4',
  feedmill: 'M6 3h12l-2 5 4 13H4L8 8zM8 8h8M12 18v-7M12 14l-3-2M12 17l3-2',
  dairy:
    'M5 3l2 5M19 3l-2 5M7 8q5-3 10 0l2 7-4 7H9l-4-7zM5 10H2v4h4M19 10h3v4h-4M8 17h8M10 20h0M14 20h0',
  creamery: 'M2 12 14 3l8 9v9H2zM2 12h20M7 16h0M15 18h0M16 9h0',
  dairyKitchen: 'M2 21h20M4 12h12v5q-6 6-12 0zM16 12h3q4 3-3 5M6 8h9M7 8V4l6-2 2 6',
  sheepfold: 'M5 15C0 13 2 7 6 7c-1-6 8-6 9-2 6-2 9 5 5 8v5h-5v-5M5 15h10M6 15v7M12 15v7M19 8h0',
  piggery: 'M5 9q5-5 12-2l4-3v7q4 3 0 6h-3v4h-3v-4H8v4H5v-5C1 15 1 9 5 9zM2 11Q0 6 3 6M17 11h0',
  henhouse: 'M4 10q0 8 9 8t7-10l3 2-3 2M17 6l-1-3 3 1 2-1v4M4 10 1 6v9l5 2M10 18v4M15 18v4M18 8h0',
  haybarn: 'M2 10 12 2 22 10M4 9v13h16V9M7 14h10v8H7zM10 14v8M14 14v8',
  boathouse: 'M2 10 12 2 22 10M4 9v10M20 9v10M7 14h10l-2 5H9zM2 23l5-2 5 2 5-2 5 2',
  lighthouse: 'M8 22l2-13h4l2 13M8 9h8V4H8zM5 6H1M19 6h4M5 22h14',
};
export const aircraftHangarIcon = 'M12 2v20M2 12l10-5 10 5M7 21l5-4 5 4M6 5h12';
const otherIcons: Readonly<Record<string, string>> = {
  'Wood / logs': 'M12 2 3 15h6v7h6v-7h6z',
  stone: 'M2 20 7 7l8-3 7 16zM7 7l5 13 3-16',
  gravel: 'M2 21l3-6 5 6zM12 21l5-8 5 8zM6 11l4-7 4 7z',
  Dirt: 'M14 2l5 4-3 4-5-4zM13 8 7 17M3 15l7 4-6 4-3-3z',
  'Playing field': 'M2 4h20v16H2zM12 4v16M9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
  'Race checkpoints': 'M4 22V2M4 3h16v11H4M4 8h16M9 3v11M15 3v11',
};
const genericSite = 'M3 22V9l9-7 9 7v13zM8 22v-8h8v8';
/** Match catalogue IDs, never names; hangars are garages with an explicit role. */
export function mapIcon(kind: string, site?: { aircraftHangar?: boolean }) {
  return site?.aircraftHangar
    ? aircraftHangarIcon
    : (buildingMapIcons[kind] ?? otherIcons[kind] ?? genericSite);
}
