// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

import { GemKit, GemMap, SdkSettings, PositionService, EngineMisc } from '@magiclane/maps-sdk';
import { GEMKIT_TOKEN, initializeSDK, createMapView } from '../../shared';
let map: GemMap | null = null;
let compassAngle = 0;
let compassImg: HTMLImageElement | null = null;

// Helper to get compass image from SDK
function getCompassImage(): string | null {
  // SdkSettings.getImageById returns a base64 string or URL
  const imgData = SdkSettings.getImageById({
    id: EngineMisc.compassEnableSensorON,
    size: { width: 100, height: 100 },
  });
  if (!imgData) return null;
  // If imgData is a Buffer or Uint8Array, convert to base64 data URL
  if (typeof imgData === 'string') {
    // If already a string, assume it's a valid src
    return imgData;
  }
  // If it's a buffer, convert to base64
  let binary = '';
  const bytes = new Uint8Array(imgData);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return `data:image/png;base64,${base64}`;
}

// Create compass UI
function createCompass() {
  if (compassImg) compassImg.remove();

  compassImg = document.createElement('img');
  compassImg.style.cssText = `
    position: fixed; right: 12px; top: 12px; width: 40px; height: 40px;
    background: #fff; border-radius: 50%; padding: 3px; z-index: 2000; cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    transition: transform 0.2s;
  `;
  const imgSrc = getCompassImage();
  if (imgSrc) compassImg.src = imgSrc;
  compassImg.onclick = () => {
    if (map) map.alignNorthUp();
  };
  document.body.appendChild(compassImg);
  updateCompassRotation();
}

// Update compass rotation
function updateCompassRotation() {
  if (compassImg) {
    compassImg.style.transform = `rotate(${-compassAngle}deg)`;
  }
}

// Map angle update callback
function onMapAngleUpdate(angle: number) {
  compassAngle = angle;
  updateCompassRotation();
}

// Map created callback
async function onMapCreated(gemMap: GemMap) {
  map = gemMap;

  map.registerMapAngleUpdateCallback(onMapAngleUpdate);
  createCompass();
}

// Main entry
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
  const viewId = 0;
  createMapView(gemKit, container, viewId, (gemMap: GemMap) => {
    onMapCreated(gemMap);
  });
});
