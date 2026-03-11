// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

import { GemKit, GemMap, Coordinates, PositionService } from '@magiclane/maps-sdk';
import { GEMKIT_TOKEN, showMessage, styleButton } from '../../shared';

let map: GemMap | null = null;
let isStyleLoaded = false;
let applyStyleBtn: HTMLButtonElement;

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

  const viewId = 4;
  const wrapper = gemKit.createView(viewId, (gemMap: GemMap) => {
    map = gemMap;
  });
  if (wrapper) container.appendChild(wrapper);

  // Apply Style button
  applyStyleBtn = document.createElement('button');
  applyStyleBtn.textContent = 'Apply Map Style';
  applyStyleBtn.onclick = () => applyStyle();
  styleButton(applyStyleBtn, '#673ab7', '#7e57c2', {
    display: 'flex',
  });
  document.body.appendChild(applyStyleBtn);
});

// Method to apply map style from assets
async function applyStyle() {
  if (!map || isStyleLoaded) return;
  showMessage('The map style is loading...');

  // Simulate async loading delay
  await new Promise((resolve) => setTimeout(resolve, 250));

  // Fetch the style file from assets (as ArrayBuffer)
  try {
    const response = await fetch('./Basic_1_Oldtime-1_21_656.style');
    if (!response.ok) throw new Error('Failed to load style file');
    const styleBuffer = await response.arrayBuffer();
    
    // Register callback to be notified when map style is changed
    map.registerSetMapStyleCallback((id: number, stylePath: string, viaApi: boolean) => {
      showMessage('Map style applied successfully!');
      isStyleLoaded = true;
      applyStyleBtn.style.display = 'none';
      // Center the map after style is applied
      map?.centerOnCoordinates(new Coordinates({ latitude: 45, longitude: 20 }), { zoomLevel: 25 });
    });
    
    // Apply style to map (using setMapStyleByBuffer)
    map.preferences.setMapStyleByBuffer(new Uint8Array(styleBuffer));
    showMessage('Loading map style...');
  } catch (error) {
    showMessage('Error loading map style');
    console.error(error);
  }
}
