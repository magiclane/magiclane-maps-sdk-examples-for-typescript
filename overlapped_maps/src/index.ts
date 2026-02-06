// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

import { GemKit, GemMap, PositionService } from '@magiclane/maps-sdk';
import { GEMKIT_TOKEN, showMessage } from '../../shared';
let gemKit: GemKit | null = null;

// UI setup
function setupUI() {
  // App bar
  const appBar = document.createElement('div');
  appBar.style.cssText = `
    width: 100vw; height: 56px; background: #4527a0; color: #fff;
    display: flex; align-items: center; justify-content: flex-start;
    padding: 0 16px; font-size: 1.2em; font-weight: 500; position: fixed; top: 0; left: 0; z-index: 2000;
    box-shadow: 0 2px 8px rgba(0,0,0,0.10);
  `;
  appBar.innerHTML = `<span>Overlapped Maps</span>`;
  document.body.appendChild(appBar);

  // Main container for maps
  const main = document.createElement('div');
  main.id = 'overlap-map-container';
  main.style.cssText = `
    position: absolute; top: 56px; left: 0; width: 100vw; height: calc(100vh - 56px);
    background: #f5f5f5;
    overflow: hidden;
  `;
  document.body.appendChild(main);
}

// Main entry
window.addEventListener('DOMContentLoaded', async () => {
  setupUI();

  try {
    gemKit = await GemKit.initialize(GEMKIT_TOKEN);
    await PositionService.instance;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    showMessage(`SDK initialization failed: ${message}`, 5000);
    console.error('SDK initialization failed:', error);
    return;
  }

  const main = document.getElementById('overlap-map-container');
  if (!main) throw new Error('Main container not found');

  // Large background map
  const mapBgContainer = document.createElement('div');
  mapBgContainer.style.cssText = `
    position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1;
    border-radius: 0; overflow: hidden;
  `;
  const wrapperBg = gemKit.createView(0, (gemMap: GemMap) => {});
  if (wrapperBg) mapBgContainer.appendChild(wrapperBg);
  main.appendChild(mapBgContainer);

  // Smaller overlapped map
  const mapSmallContainer = document.createElement('div');
  mapSmallContainer.style.cssText = `
    position: absolute; top: 20px; left: 20px; width: 40vw; height: 40vh; z-index: 2;
    border: 2px solid #222; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.18);
    background: #fff;
  `;
  const wrapperSmall = gemKit.createView(1, (gemMap: GemMap) => {});
  if (wrapperSmall) mapSmallContainer.appendChild(wrapperSmall);
  main.appendChild(mapSmallContainer);
});
