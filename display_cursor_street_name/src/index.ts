// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

import { GemKit, GemMap, Coordinates, PositionService } from '@magiclane/maps-sdk';
import { GEMKIT_TOKEN, showMessage, ICONS, applyStyles, styles } from '../../shared';

// Type for screen position coordinates
interface ScreenPosition {
  x: number;
  y: number;
}

let map: GemMap | null = null;
let currentStreetName = '';

// UI Elements
let streetNameDiv: HTMLDivElement;

function updateStreetNameUI(name: string) {
  if (!streetNameDiv) return;

  if (name) {
    streetNameDiv.innerHTML = `${ICONS.directions} <span>${name}</span>`;
    streetNameDiv.style.display = 'flex';
    // Animation
    requestAnimationFrame(() => {
      streetNameDiv.style.opacity = '1';
      streetNameDiv.style.transform = 'translateX(-50%) translateY(0)';
    });
  } else {
    streetNameDiv.style.opacity = '0';
    streetNameDiv.style.transform = 'translateX(-50%) translateY(10px)';
    setTimeout(() => {
      streetNameDiv.style.display = 'none';
    }, 300);
  }
}

async function onMapCreated(gemMap: GemMap) {
  map = gemMap;

  // Center on Milan, Italy
  map.centerOnCoordinates(
    new Coordinates({
      latitude: 45.472358,
      longitude: 9.184945,
    }),
    { zoomLevel: 80 }
  );

  // Enable cursor rendering
  map.preferences.enableCursor = true;
  map.preferences.enableCursorRender = true;

  // Register touch callback to set cursor and display street name
  map.registerTouchCallback(async (point: ScreenPosition) => {
    await map!.setCursorScreenPosition(point);
    const streets = map!.cursorSelectionStreets();
    currentStreetName =
      streets && streets.length > 0 ? streets[0].name || 'Unnamed street' : 'Unnamed street';
    updateStreetNameUI(currentStreetName);
  });
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
  const wrapper = gemKit.createView(viewId, onMapCreated);
  if (wrapper) container.appendChild(wrapper);

  // Create the street name display
  streetNameDiv = document.createElement('div');
  applyStyles(streetNameDiv, {
    position: 'fixed',
    bottom: '40px',
    left: '50%',
    transform: 'translateX(-50%) translateY(10px)',
    background: 'rgba(255, 255, 255, 0.95)',
    color: '#333',
    borderRadius: '50px',
    padding: '14px 28px',
    fontSize: '1.1em',
    fontWeight: '600',
    fontFamily: styles.toast.fontFamily,
    boxShadow: '0 6px 25px rgba(0,0,0,0.15)',
    zIndex: '2000',
    minWidth: '150px',
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    backdropFilter: 'blur(10px)',
    opacity: '0',
    transition: 'opacity 0.3s ease, transform 0.3s ease',
    whiteSpace: 'nowrap',
  });
  document.body.appendChild(streetNameDiv);

  // Initial call (hidden)
  updateStreetNameUI('');

  // Prompt user
  showMessage('Tap anywhere on the map to see the street name.');
});
