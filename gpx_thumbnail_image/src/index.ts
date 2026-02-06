// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

import {
  GemKit,
  GemMap,
  PositionService,
  RoutingService,
  RoutePreferences,
  GemError,
  Route,
  Landmark,
  Path,
  PathFileFormat,
  RouteRenderSettings,
  RouteRenderOptions,
  RouteTransportMode,
} from '@magiclane/maps-sdk';
import { GEMKIT_TOKEN, showMessage, ICONS } from '../../shared';

let map: GemMap | null = null;
let screenshotImage: Uint8Array | null = null;

// UI Elements
let importBtn: HTMLButtonElement;
let imageDiv: HTMLDivElement;

async function onMapCreated(gemMap: GemMap) {
  map = gemMap;
  updateUI();
}

async function importGPX() {
  showMessage('Importing GPX...', 3000);

  // Load GPX file from public/assets/recorded_route.gpx
  try {
    const response = await fetch('./recorded_route.gpx');
    if (!response.ok) {
      showMessage('GPX file does not exist.');
      return;
    }
    const pathData = new Uint8Array(await response.arrayBuffer());

    // Process GPX data using SDK
    const gemPath = Path.create({ data: pathData, format: PathFileFormat.gpx });

    // Calculate route from path
    const route = await calculateRouteFromPath(gemPath);

    presentRouteOnMap(route);

    // Center on path's area with margins
    if (map && route.geographicArea) {
      map.centerOnArea(route.geographicArea, { zoomLevel: 70 });
    }

    // Wait for the map actions to complete
    await new Promise((res) => setTimeout(res, 500));

    // Capture the thumbnail image
    if (map) {
      screenshotImage = await map.captureImage();
      if (!screenshotImage) {
        showMessage('Error while taking screenshot.');
        return;
      }
      updateUI();
      showMessage('Snapshot captured!');
    }
  } catch (e) {
    console.error(e);
    showMessage('Error processing GPX.');
  }
}

function presentRouteOnMap(route: Route) {
  map?.preferences.routes.add(route, true, {
    routeRenderSettings: new RouteRenderSettings({
      options: new Set([RouteRenderOptions.main, RouteRenderOptions.showWaypoints]),
    }),
  });
}

function calculateRouteFromPath(path: Path): Promise<Route> {
  return new Promise((resolve, reject) => {
    const waypoints = path.toLandmarkList();
    RoutingService.calculateRoute(
      waypoints,
      new RoutePreferences({ transportMode: RouteTransportMode.pedestrian }),
      (err: GemError, routes: Route[]) => {
        if (err !== GemError.success || !routes.length) {
          showMessage('Error while computing route.');
          reject(err);
          return;
        }
        resolve(routes[0]);
      }
    );
  });
}

function updateUI() {
  importBtn.style.display = screenshotImage ? 'none' : 'flex';

  if (screenshotImage) {
    if (!imageDiv) {
      imageDiv = document.createElement('div');
      // IMPROVEMENT: Modern Modal/Card UI
      imageDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(255, 255, 255, 0.95);
        border-radius: 20px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        padding: 20px;
        z-index: 2000;
        display: flex;
        flex-direction: column;
        align-items: center;
        backdrop-filter: blur(10px);
        max-width: 90vw;
        max-height: 90vh;
      `;
      document.body.appendChild(imageDiv);
    }

    const blob = new Blob([screenshotImage], { type: 'image/png' });
    const url = URL.createObjectURL(blob);

    // Add content with Close button
    imageDiv.innerHTML = `
        <div style="display:flex; justify-content:space-between; width:100%; align-items:center; margin-bottom:15px;">
            <span style="font-weight:700; font-size:18px; color:#333; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">Route Snapshot</span>
            <button id="closeSnapBtn" style="background:transparent; border:none; cursor:pointer; color:#666; display:flex; padding:4px; border-radius:50%; transition:background 0.2s;">
                ${ICONS.closeLarge}
            </button>
        </div>
        <div style="border-radius:12px; overflow:hidden; border:1px solid #eee;">
            <img src="${url}" style="display:block; max-width:100%; max-height:60vh; object-fit:contain;" />
        </div>
    `;

    imageDiv.style.display = 'flex';

    // Add close logic
    const closeBtn = document.getElementById('closeSnapBtn');
    if (closeBtn) {
      closeBtn.onmouseenter = () => (closeBtn.style.background = '#f0f0f0');
      closeBtn.onmouseleave = () => (closeBtn.style.background = 'transparent');
      closeBtn.onclick = () => {
        screenshotImage = null;
        updateUI();
      };
    }
  } else if (imageDiv) {
    imageDiv.style.display = 'none';
    imageDiv.innerHTML = '';
  }
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

  // Import GPX button
  importBtn = document.createElement('button');
  importBtn.innerHTML = `${ICONS.upload} Import GPX`;
  importBtn.className = 'gem-button gem-button-primary gem-button-center';
  importBtn.onclick = importGPX;
  document.body.appendChild(importBtn);

  updateUI();
});
