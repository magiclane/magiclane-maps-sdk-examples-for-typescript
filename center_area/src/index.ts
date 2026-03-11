// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

import {
  GemKit,
  GemMap,
  Coordinates,
  PositionService,
  RectangleGeographicArea,
  GemAnimation,
  AnimationType,
} from '@magiclane/maps-sdk';
import { GEMKIT_TOKEN, showMessage, ICONS, applyStyles, mergeStyles, styles, StyleManager } from '../../shared';

let map: GemMap | null = null;

// UI Elements
let centerAreaBtn: HTMLButtonElement;

function onCenterAreaButtonPressed() {
  if (!map) {
    showMessage('Map not ready yet');
    return;
  }

  // Predefined area for Queens, New York
  const area = new RectangleGeographicArea({
    topLeft: new Coordinates({
      latitude: 40.73254497605159,
      longitude: -73.82536953324063,
    }),
    bottomRight: new Coordinates({
      latitude: 40.723227048410024,
      longitude: -73.77693793474619,
    }),
  });

  const animation = new GemAnimation({
    type: AnimationType.linear,
    duration: 2000,
    onCompleted: () => {
      showMessage('Centered on Queens area');
    },
  });

  // Use the map to center on the area
  map.centerOnArea(area, { animation: animation });
  showMessage('Centering on Queens, New York area...');
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

  // Center Area button
  centerAreaBtn = document.createElement('button');
  centerAreaBtn.innerHTML = `${ICONS.myLocation} Center on Area`;
  centerAreaBtn.onclick = () => onCenterAreaButtonPressed();
  applyStyles(centerAreaBtn, mergeStyles(styles.buttonBase, styles.buttonPrimary, {
    position: 'fixed',
    top: '30px',
    left: '50%',
    transform: 'translateX(-50%)',
  }));
  StyleManager.addHoverEffect(centerAreaBtn,
    { background: '#7e57c2', boxShadow: '0 6px 20px rgba(103, 58, 183, 0.5)' },
    { background: '#673ab7', boxShadow: '0 4px 15px rgba(103, 58, 183, 0.4)' }
  );
  document.body.appendChild(centerAreaBtn);
});
