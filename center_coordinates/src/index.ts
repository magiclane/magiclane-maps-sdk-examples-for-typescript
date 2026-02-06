// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

import { GemKit, GemMap, Coordinates, PositionService } from '@magiclane/maps-sdk';
import { GEMKIT_TOKEN, showMessage, ICONS } from '../../shared';

let map: GemMap | null = null;

// UI Elements
let centerCoordinatesBtn: HTMLButtonElement;

function onCenterCoordinatesButtonPressed() {
  if (!map) {
    showMessage('Map not ready yet');
    return;
  }

  // Predefined coordinates for Rome, Italy
  const targetCoordinates = new Coordinates({
    latitude: 41.902782,
    longitude: 12.496366,
  });

  // Use the map to center on coordinates with zoomLevel option
  map.centerOnCoordinates(targetCoordinates, { zoomLevel: 60 });
  showMessage('Centering on Rome, Italy');
}

window.addEventListener('DOMContentLoaded', async () => {
  let gemKit: GemKit;
  try {
    gemKit = await GemKit.initialize(GEMKIT_TOKEN);
    await PositionService.instance;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    showMessage(`SDK initialization failed: ${message}`, 5000);
    console.error('SDK initialization failed:', error);
    return;
  }

  const container = document.getElementById('map-container');
  if (!container) throw new Error('Map container not found');

  const viewId = 2;
  const wrapper = gemKit.createView(viewId, (gemMap: GemMap) => {
    map = gemMap;
  });
  if (wrapper) container.appendChild(wrapper);

  // Center Coordinates button
  centerCoordinatesBtn = document.createElement('button');
  centerCoordinatesBtn.innerHTML = `${ICONS.place} Center Coordinates`;
  centerCoordinatesBtn.className = 'gem-button gem-button-primary gem-button-center';
  centerCoordinatesBtn.onclick = () => onCenterCoordinatesButtonPressed();
  document.body.appendChild(centerCoordinatesBtn);
});
