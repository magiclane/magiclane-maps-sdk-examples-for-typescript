// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

import { GemKit, GemMap, PositionService } from '@magiclane/maps-sdk';
import { GEMKIT_TOKEN, showMessage } from '../../shared';
const MAX_VIEWS = 4;
let mapViewsCount = 0;
type MapViewEntry = { container: HTMLElement; gemMap: GemMap | null };
const mapViews: MapViewEntry[] = [];
let gemKit: GemKit | null = null;

// UI setup
function setupUI() {
  // App bar
  const appBar = document.createElement('div');
  appBar.style.cssText = `
    width: 100% !important; height: 56px !important; background: #4527a0; color: #fff;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 16px; font-size: 1.2em; font-weight: 500; position: fixed; top: 0; left: 0; z-index: 2000;
    box-shadow: 0 2px 8px rgba(0,0,0,0.10);
  `;
  appBar.innerHTML = `
    <span>Multiview Map</span>
    <span>
      <button id="addViewBtn" style="background:none;border:none;color:#fff;font-size:1.5em;cursor:pointer;margin-right:8px;">➕</button>
      <button id="removeViewBtn" style="background:none;border:none;color:#fff;font-size:1.5em;cursor:pointer;">➖</button>
    </span>
  `;
  document.body.appendChild(appBar);

  // Button handlers
  (document.getElementById('addViewBtn') as HTMLButtonElement).onclick = addViewButtonPressed;
  (document.getElementById('removeViewBtn') as HTMLButtonElement).onclick = removeViewButtonPressed;

  // Grid container
  const grid = document.createElement('div');
  grid.id = 'map-grid';
  grid.style.cssText = `
    position: absolute; top: 56px; left: 0; width: 100vw; height: calc(100vh - 56px);
    display: grid; grid-template-columns: 1fr 1fr; grid-auto-rows: 1fr; gap: 10px; padding: 10px;
    background: #f5f5f5;
  `;
  document.body.appendChild(grid);
}

// Add a new map view
function addViewButtonPressed() {
  if (mapViewsCount >= MAX_VIEWS) return;
  mapViewsCount += 1;
  renderMapViews();
}

// Remove the last map view
function removeViewButtonPressed() {
  if (mapViewsCount <= 0) return;
  mapViewsCount -= 1;
  renderMapViews();
}

// Render the map views in the grid
function renderMapViews() {
  const grid = document.getElementById('map-grid');
  if (!grid) return;

  // Add new map views if needed
  while (mapViews.length < mapViewsCount) {
    const i = mapViews.length;
    const mapContainer = document.createElement('div');
    mapContainer.style.cssText = `
      border: 1px solid #222; border-radius: 10px; background: #fff; min-width: 0; min-height: 0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      overflow: hidden; display: flex; align-items: stretch; justify-content: stretch;
    `;
    mapContainer.id = `map-view-${i}`;
    let entry: MapViewEntry = { container: mapContainer, gemMap: null };
    // Create a new map view only once
    const wrapper = gemKit.createView(i, (gemMap: GemMap) => {
      entry.gemMap = gemMap;
    });
    if (wrapper) mapContainer.appendChild(wrapper);
    grid.appendChild(mapContainer);
    mapViews.push(entry);
  }

  // Remove extra map views if needed
  while (mapViews.length > mapViewsCount) {
    const entry = mapViews.pop();
    if (entry) {
      // Some GemKit SDKs do not declare release() in GemMap typings, but it exists at runtime
      if (entry.gemMap && typeof (entry.gemMap as any).release === 'function') {
        (entry.gemMap as any).release();
      }
      if (entry.container && entry.container.parentNode) {
        entry.container.parentNode.removeChild(entry.container);
      }
    }
  }
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

  // Start with 0 views (or set to 1 if you want a default)
  mapViewsCount = 0;
  renderMapViews();
});
