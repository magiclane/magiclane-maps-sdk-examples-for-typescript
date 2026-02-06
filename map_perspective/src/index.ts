// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

import { GemKit, GemMap, PositionService, BuildingsVisibility } from '@magiclane/maps-sdk';
import { GEMKIT_TOKEN, showMessage, ICONS } from '../../shared';

let map: GemMap | null = null;
let mapPreferences: ReturnType<GemMap['preferences']> | null = null;
let isInPerspectiveView = false;
let perspectiveBtn: HTMLButtonElement;

const VIEW_3D_ANGLE = 30;
const VIEW_2D_ANGLE = 90;

// Create the perspective toggle button
function createPerspectiveButton() {
  perspectiveBtn = document.createElement('button');
  perspectiveBtn.id = 'perspective-btn';
  perspectiveBtn.className = 'gem-button gem-button-primary gem-button-center';
  updatePerspectiveButton();
  perspectiveBtn.onclick = onChangePerspectiveButtonPressed;
  document.body.appendChild(perspectiveBtn);
}

function updatePerspectiveButton() {
  if (!perspectiveBtn) return;
  const icon = isInPerspectiveView ? ICONS.view2D : ICONS.view3D;
  const text = isInPerspectiveView ? '2D View' : '3D View';
  perspectiveBtn.innerHTML = `${icon} ${text}`;
}

// Toggle perspective view
function onChangePerspectiveButtonPressed() {
  isInPerspectiveView = !isInPerspectiveView;
  updatePerspectiveButton();

  if (!mapPreferences) return;

  if (isInPerspectiveView) {
    mapPreferences.buildingsVisibility = BuildingsVisibility.threeDimensional;
    mapPreferences.tiltAngle = VIEW_3D_ANGLE;
    showMessage('Switched to 3D perspective view');
  } else {
    mapPreferences.buildingsVisibility = BuildingsVisibility.twoDimensional;
    mapPreferences.tiltAngle = VIEW_2D_ANGLE;
    showMessage('Switched to 2D map view');
  }
}

// Map created callback
function onMapCreated(gemMap: GemMap) {
  map = gemMap;
  mapPreferences = map.preferences;
  createPerspectiveButton();
}

// Main entry
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

  const viewId = 5;
  const wrapper = gemKit.createView(viewId, (gemMap: GemMap) => {
    onMapCreated(gemMap);
  });
  if (wrapper) container.appendChild(wrapper);
});
