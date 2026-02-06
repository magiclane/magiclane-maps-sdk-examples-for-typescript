// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

/**
 * Common TypeScript interfaces used across examples
 */

/** Screen position coordinates (normalized or pixel-based) */
export interface ScreenPosition {
  x: number;
  y: number;
}

/** Pin data for external marker management */
export interface PinData {
  screenCoordinates: ScreenPosition;
  title?: string;
}

/** Button color configuration */
export interface ButtonColors {
  primary: string;
  hover: string;
}

/** Common button color presets */
export const BUTTON_COLORS = {
  purple: { primary: '#673ab7', hover: '#7e57c2' },
  red: { primary: '#f44336', hover: '#ef5350' },
  green: { primary: '#4caf50', hover: '#66bb6a' },
  blue: { primary: '#2196f3', hover: '#42a5f5' },
  orange: { primary: '#ff9800', hover: '#ffa726' },
  teal: { primary: '#009688', hover: '#26a69a' },
} as const;
