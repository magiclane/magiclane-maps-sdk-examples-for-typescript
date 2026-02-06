// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

import { GemKit, GemMap } from '@magiclane/maps-sdk';
import { GEMKIT_TOKEN, initializeSDK, createMapView } from '../../shared';

let map: GemMap | null = null;

// Wait for DOM to load
window.addEventListener('DOMContentLoaded', async () => {
  // Initialize SDK with proper error handling
  const result = await initializeSDK(GemKit, GEMKIT_TOKEN, {
    containerId: 'map-container',
    showErrorMessages: true,
    timeout: 30000,
  });

  if (!result.success || !result.gemKit || !result.container) {
    console.error('Failed to initialize SDK:', result.error);
    return;
  }

  const { gemKit, container } = result;

  // Create map view with error handling
  const viewId = 1;
  const wrapper = createMapView(gemKit, container, viewId, (gemMap: GemMap) => {
    map = gemMap;
  });

  if (!wrapper) {
    console.error('Failed to create map view');
    return;
  }
});
