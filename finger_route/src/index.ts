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
  Coordinates,
  RouteTransportMode,
  TaskHandler,
} from '@magiclane/maps-sdk';
import {
  GEMKIT_TOKEN,
  showMessage,
  ICONS,
  styleButton,
  convertDistance,
  convertDuration,
} from '../../shared';

let map: GemMap | null = null;
let routingHandler: TaskHandler | null = null;
let areRoutesBuilt = false;
let isInDrawingMode = false;

// UI Elements
let drawBtn: HTMLButtonElement;
let buildBtn: HTMLButtonElement;
let cancelBtn: HTMLButtonElement;
let clearBtn: HTMLButtonElement;

// Helper function to create map label for routes (replaces Dart extension)
function getRouteMapLabel(route: Route): string {
  const timeDistance = route.getTimeDistance();
  const totalDistance = timeDistance.unrestrictedDistanceM + timeDistance.restrictedDistanceM;
  const totalDuration = timeDistance.unrestrictedTimeS + timeDistance.restrictedTimeS;

  return `${convertDistance(totalDistance)} \n${convertDuration(totalDuration)}`;
}

function updateUI() {
  drawBtn.style.display = 'none';
  buildBtn.style.display = 'none';
  cancelBtn.style.display = 'none';
  clearBtn.style.display = 'none';

  if (!routingHandler && !areRoutesBuilt && !isInDrawingMode) {
    // Initial state
    drawBtn.style.display = 'flex';
  } else if (!routingHandler && !areRoutesBuilt && isInDrawingMode) {
    // Drawing state
    buildBtn.style.display = 'flex';
  } else if (routingHandler) {
    // Calculating state
    cancelBtn.style.display = 'flex';
  } else if (areRoutesBuilt) {
    // Result state
    clearBtn.style.display = 'flex';
  }
}

function onDrawPressed() {
  if (!map) return;
  map.enableDrawMarkersMode();
  isInDrawingMode = true;
  updateUI();
  showMessage('Tap on the map to place waypoints.');
}

function onBuildRouteButtonPressed() {
  if (!map) return;
  const waypoints = map.disableDrawMarkersMode();

  const routePreferences = new RoutePreferences({
    accurateTrackMatch: false,
    transportMode: RouteTransportMode.pedestrian,
    ignoreRestrictionsOverTrack: true,
  });

  showMessage('The route is being calculated.');

  routingHandler = RoutingService.calculateRoute(
    waypoints,
    routePreferences,
    (err: GemError, routes: Route[]) => {
      routingHandler = null;
      isInDrawingMode = false;
      updateUI();

      if (err === GemError.success && routes.length > 0) {
        const routesMap = map!.preferences.routes;

        routes.forEach((route, idx) => {
          routesMap.add(route, idx === 0, { label: getRouteMapLabel(route) });
        });

        map!.centerOnRoutes({ routes });
        areRoutesBuilt = true;
        updateUI();
        showMessage('Route built successfully!');
      } else {
        showMessage('Route calculation failed.');
      }
    }
  );
  updateUI();
}

function onClearRoutesButtonPressed() {
  if (!map) return;
  map.preferences.routes.clear();
  areRoutesBuilt = false;
  updateUI();
}

function onCancelRouteButtonPressed() {
  if (routingHandler) {
    RoutingService.cancelRoute(routingHandler);
    routingHandler = null;
    isInDrawingMode = false;
    updateUI();
    showMessage('Route calculation cancelled.');
  }
}

async function onMapCreated(gemMap: GemMap) {
  map = gemMap;
  updateUI();
  map.centerOnCoordinates(Coordinates.fromLatLong(44.4268, 26.1025), { zoomLevel: 70 });
  //map.centerOnCoordinates(Coordinates.fromLatLong(45.5200, 25.4050), { zoomLevel: 80 });
}

window.addEventListener('DOMContentLoaded', async () => {
  let gemKit;
  try {
    gemKit = await GemKit.initialize(GEMKIT_TOKEN);
  } catch (error) {
    showMessage('Failed to initialize GemKit SDK');
    console.error('GemKit initialization failed:', error);
    return;
  }
  await PositionService.instance;

  const container = document.getElementById('map-container');
  if (!container) throw new Error('Map container not found');

  const viewId = 2;
  const wrapper = gemKit.createView(viewId, onMapCreated);
  if (wrapper) container.appendChild(wrapper);

  // Draw button
  drawBtn = document.createElement('button');
  drawBtn.innerHTML = `${ICONS.draw} Draw Route`;
  drawBtn.className = 'gem-button gem-button-primary gem-button-center';
  styleButton(drawBtn, '#673ab7', '#7e57c2');
  drawBtn.onclick = onDrawPressed;
  document.body.appendChild(drawBtn);

  // Build route button
  buildBtn = document.createElement('button');
  buildBtn.innerHTML = `${ICONS.check} Build Route`;
  buildBtn.className = 'gem-button gem-button-success gem-button-center';
  styleButton(buildBtn, '#4caf50', '#66bb6a');
  buildBtn.onclick = onBuildRouteButtonPressed;
  document.body.appendChild(buildBtn);

  // Cancel button
  cancelBtn = document.createElement('button');
  cancelBtn.innerHTML = `${ICONS.close} Cancel`;
  cancelBtn.className = 'gem-button gem-button-danger gem-button-center';
  styleButton(cancelBtn, '#f44336', '#ef5350');
  cancelBtn.onclick = onCancelRouteButtonPressed;
  document.body.appendChild(cancelBtn);

  // Clear button
  clearBtn = document.createElement('button');
  clearBtn.innerHTML = `${ICONS.trash} Clear Routes`;
  clearBtn.className = 'gem-button gem-button-warning gem-button-center';
  styleButton(clearBtn, '#ff9800', '#ffb74d');
  clearBtn.onclick = onClearRoutesButtonPressed;
  document.body.appendChild(clearBtn);

  updateUI();
});
