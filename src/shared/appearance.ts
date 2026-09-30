// SPDX-License-Identifier: GPL-3.0-or-later
import data from '../../data/appearance.json';
export const appearance = data;
export const cottageStyle = (id: string) => data.cottages.find((s) => s.id === id);
export const tractorPaint = (id?: string) => data.paints.find((p) => p.id === id);
