// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

import { GemKit, GemMap, PositionService, Landmark, Coordinates } from '@magiclane/maps-sdk';
import { GEMKIT_TOKEN, showMessage, ICONS } from '../../shared';

// Type for screen position coordinates
interface ScreenPosition {
  x: number;
  y: number;
}

let map: GemMap | null = null;
let focusedLandmark: Landmark | null = null;
let landmarkPanel: HTMLDivElement | null = null;

// Helper: show landmark panel
function showLandmarkPanel(landmark: Landmark) {
  if (landmarkPanel) landmarkPanel.remove();

  landmarkPanel = document.createElement('div');
  landmarkPanel.style.cssText = `
    position: fixed;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%) translateY(150px);
    max-width: 500px;
    width: 90vw;
    background: rgba(255, 255, 255, 0.98);
    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    border-radius: 20px;
    z-index: 2000;
    display: flex;
    align-items: center;
    padding: 20px;
    backdrop-filter: blur(10px);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
    opacity: 0;
  `;

  // Image container with modern styling
  const imgDiv = document.createElement('div');
  imgDiv.style.cssText = `
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 16px;
    flex-shrink: 0;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  `;

  let imgSrc = '';
  if (landmark.getImage) {
    const imgData = landmark.getImage({ width: 64, height: 64 });
    if (imgData) {
      if (typeof imgData === 'string') {
        imgSrc = imgData;
      } else if (imgData instanceof Uint8Array) {
        let binary = '';
        for (let i = 0; i < imgData.byteLength; i++) {
          binary += String.fromCharCode(imgData[i]);
        }
        const base64 = btoa(binary);
        imgSrc = `data:image/png;base64,${base64}`;
      } else if (Object.prototype.toString.call(imgData) === '[object ArrayBuffer]') {
        const bytes = new Uint8Array(imgData as ArrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        imgSrc = `data:image/png;base64,${base64}`;
      }
    }
  }

  if (imgSrc) {
    const img = document.createElement('img');
    img.src = imgSrc;
    img.style.cssText = 'width: 64px; height: 64px; border-radius: 12px; object-fit: cover;';
    imgDiv.appendChild(img);
  } else {
    // Default icon if no image
    imgDiv.innerHTML = `<div style="color: white; font-size: 32px;">${ICONS.location}</div>`;
  }
  landmarkPanel.appendChild(imgDiv);

  // Info container
  const infoDiv = document.createElement('div');
  infoDiv.style.cssText = 'flex: 1; margin-left: 16px; min-width: 0;';

  const categoryText =
    landmark.categories && landmark.categories.length > 0
      ? landmark.categories[0].name
      : 'Location';

  infoDiv.innerHTML = `
    <div style="font-size: 18px; font-weight: 700; color: #222; line-height: 1.3; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
      ${landmark.name}
    </div>
    <div style="font-size: 14px; font-weight: 500; color: #673ab7; line-height: 1.2;">
      ${categoryText}
    </div>
  `;
  landmarkPanel.appendChild(infoDiv);

  // Close button with modern icon
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = ICONS.closeLarge;
  closeBtn.title = 'Close';
  closeBtn.style.cssText = `
    background: transparent;
    border: none;
    color: #666;
    cursor: pointer;
    margin-left: 12px;
    padding: 8px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
    flex-shrink: 0;
  `;
  closeBtn.onmouseenter = () => (closeBtn.style.background = '#f0f0f0');
  closeBtn.onmouseleave = () => (closeBtn.style.background = 'transparent');
  closeBtn.onclick = onCancelLandmarkPanelTap;
  landmarkPanel.appendChild(closeBtn);

  document.body.appendChild(landmarkPanel);

  // Animate in
  requestAnimationFrame(() => {
    if (landmarkPanel) {
      landmarkPanel.style.transform = 'translateX(-50%) translateY(0)';
      landmarkPanel.style.opacity = '1';
    }
  });
}

// Remove landmark panel with animation
function removeLandmarkPanel() {
  if (landmarkPanel) {
    landmarkPanel.style.transform = 'translateX(-50%) translateY(150px)';
    landmarkPanel.style.opacity = '0';
    setTimeout(() => {
      if (landmarkPanel) {
        landmarkPanel.remove();
        landmarkPanel = null;
      }
    }, 300);
  }
}

// Cancel panel tap
function onCancelLandmarkPanelTap() {
  if (map) map.deactivateAllHighlights();
  focusedLandmark = null;
  removeLandmarkPanel();
}

// Register landmark tap callback
function registerLandmarkTapCallback() {
  if (!map) return;
  map.registerTouchCallback(async (pos: ScreenPosition) => {
    if (!map) return;
    await map.setCursorScreenPosition(pos);
    const landmarks = map.cursorSelectionLandmarks();
    await map.resetMapSelection();

    if (landmarks && landmarks.length > 0) {
      map.activateHighlight(landmarks);
      focusedLandmark = landmarks[0];
      showLandmarkPanel(focusedLandmark);
      map.centerOnCoordinates(focusedLandmark.coordinates, { zoomLevel: 70 });
      showMessage(`Selected: ${focusedLandmark.name}`);
    }
  });
}

// Map created callback
function onMapCreated(gemMap: GemMap) {
  map = gemMap;
  map.centerOnCoordinates(new Coordinates({ latitude: 52.3676, longitude: 4.9041 }), {
    zoomLevel: 70,
  });
  registerLandmarkTapCallback();
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

  const viewId = 6;
  const wrapper = gemKit.createView(viewId, (gemMap: GemMap) => {
    onMapCreated(gemMap);
  });
  if (wrapper) container.appendChild(wrapper);
});
