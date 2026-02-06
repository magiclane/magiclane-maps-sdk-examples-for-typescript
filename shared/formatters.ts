// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

/**
 * Common formatting utilities for distance, duration, and other values
 */

/**
 * Convert meters to a human-readable distance string
 * @param meters - Distance in meters
 * @returns Formatted string (e.g., "1.5 km" or "500 m")
 */
export function convertDistance(meters: number): string {
  if (meters >= 1000) {
    const kilometers = meters / 1000;
    return `${kilometers.toFixed(1)} km`;
  } else {
    return `${Math.round(meters)} m`;
  }
}

/**
 * Convert seconds to a human-readable duration string
 * @param seconds - Duration in seconds
 * @returns Formatted string (e.g., "2 h 30 min" or "45 min")
 */
export function convertDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const hoursText = hours > 0 ? `${hours} h ` : '';
  const minutesText = `${minutes} min`;
  return hoursText + minutesText;
}

/**
 * Convert watt-hours to a formatted string
 * @param value - Energy value in watt-hours
 * @returns Formatted string (e.g., "150 wh")
 */
export function convertWh(value: number): string {
  return `${value} wh`;
}

/**
 * Convert meters per second to kilometers per hour
 * @param metersPerSecond - Speed in m/s
 * @returns Speed in km/h (rounded)
 */
export function mpsToKmph(metersPerSecond: number): number {
  return Math.round(metersPerSecond * 3.6);
}

/**
 * Format a coordinate for display
 * @param latitude - Latitude value
 * @param longitude - Longitude value
 * @param precision - Decimal places (default: 6)
 * @returns Formatted coordinate string
 */
export function formatCoordinates(latitude: number, longitude: number, precision = 6): string {
  return `${latitude.toFixed(precision)}, ${longitude.toFixed(precision)}`;
}
