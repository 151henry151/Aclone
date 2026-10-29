// SPDX-License-Identifier: GPL-3.0-or-later
/** Small monochrome symbols remain readable without fonts or downloaded logos. */
export function mapIcon(kind: string) {
  if (/Wood|logs/.test(kind)) return 'M12 2 3 15h6v7h6v-7h6z';
  if (/stone|gravel|Dirt/.test(kind)) return 'M2 19 7 8l8-3 7 14zM7 8l5 11 3-14';
  if (/home|cottage|bed/.test(kind)) return 'M2 10 12 2 22 10M5 9v13h14V9M10 22v-8h4v8';
  if (/farm|dairy|sheep|pig|hen/.test(kind))
    return 'M12 22V4M12 12C2 12 2 3 2 3s10 0 10 9M12 17c10 0 10-9 10-9s-10 0-10 9';
  if (/boat|fish|harbour|dock/.test(kind))
    return 'M3 13h18l-4 7H7zM12 13V3l7 7h-7M2 23l5-2 5 2 5-2 5 2';
  if (/market|shop|store/.test(kind)) return 'M3 8h18l-2-5H5zM5 8v13h14V8M9 21v-7h6';
  if (/bank|council|town/.test(kind)) return 'M2 8 12 2 22 8zM5 10v9M12 10v9M19 10v9M2 22h20';
  if (/lighthouse/.test(kind)) return 'M8 22l2-13h4l2 13M8 9h8V4H8zM5 6H1M19 6h4M5 22h14';
  if (/pub|restaurant|kitchen|bakery|brewery/.test(kind))
    return 'M5 2v7m4-7v7M3 2v7h8V2M7 9v13M18 22V2c-5 2-5 11 0 11';
  if (/hangar|spaceport/.test(kind)) return 'M12 2v20M3 12l9-4 9 4M7 21l5-3 5 3';
  if (/school|library/.test(kind))
    return 'M12 5C8 2 3 2 2 3v17c4-2 7-1 10 1 3-2 6-3 10-1V3c-4-1-7 0-10 2v16';
  if (/mine|quarry/.test(kind)) return 'M3 5c6-4 12-3 18 3M13 5 4 22M4 21l3 1L16 6';
  return 'M3 22V10l7 4V8l7 5V3h4v19zM6 18h2m4 0h2m4 0h2';
}
