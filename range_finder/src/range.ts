// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

import { Route, RouteTransportMode } from '@magiclane/maps-sdk';

export interface Range {
  route: Route;
  color: string; // Use CSS color string (e.g., rgba or hex)
  transportMode: RouteTransportMode;
  value: string;
  isEnabled: boolean;
}
