// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

import {
  GemKit,
  GemMap,
  PositionService,
  Landmark,
  RoutePreferences,
  RoutingService,
  GemError,
  Route,
  TaskHandler,
} from '@magiclane/maps-sdk';
import { GEMKIT_TOKEN, showMessage, ICONS } from '../../shared';

let map: GemMap | null = null;
let routingHandler: TaskHandler | null = null;
let currentRoute: Route | null = null;

// UI Elements
let buildRouteBtn: HTMLButtonElement;
let cancelRouteBtn: HTMLButtonElement;
let centerTrafficBtn: HTMLButtonElement;
let clearRoutesBtn: HTMLButtonElement;

function updateUI() {
  buildRouteBtn.style.display = 'none';
  cancelRouteBtn.style.display = 'none';
  centerTrafficBtn.style.display = 'none';
  clearRoutesBtn.style.display = 'none';

  if (!routingHandler && !currentRoute) {
    // Initial state
    buildRouteBtn.style.display = 'flex';
  } else if (routingHandler && !currentRoute) {
    // Calculating state
    cancelRouteBtn.style.display = 'flex';
  } else if (currentRoute && !routingHandler) {
    // Route built state - show both buttons offset
    centerTrafficBtn.style.display = 'flex';
    centerTrafficBtn.style.left = '40%';

    clearRoutesBtn.style.display = 'flex';
    clearRoutesBtn.style.left = '60%';
  }
}

function onBuildRouteButtonPressed() {
  if (!map) return;

  // Define the departure (Paris)
  const departureLandmark = Landmark.withLatLng({
    latitude: 48.85682,
    longitude: 2.34375,
  });

  // Define the destination (Brussels)
  const destinationLandmark = Landmark.withLatLng({
    latitude: 50.84644,
    longitude: 4.34587,
  });

  // Define the route preferences
  const routePreferences = new RoutePreferences({});

  showMessage('The route is being calculated.');

  // Calculate route
  routingHandler = RoutingService.calculateRoute(
    [departureLandmark, destinationLandmark],
    routePreferences,
    (err: GemError, routes: Route[]) => {
      routingHandler = null;
      if (err === GemError.success && routes.length > 0) {
        const routesMap = map!.preferences.routes;
        routesMap.add(routes[0], true);
        map!.centerOnRoute(routes[0]);
        currentRoute = routes[0];
        showMessage('Route calculated successfully!');
      } else {
        showMessage('Route calculation failed.');
      }
      updateUI();
    }
  );
  updateUI();
}

function onCancelRouteButtonPressed() {
  if (routingHandler) {
    RoutingService.cancelRoute(routingHandler);
    routingHandler = null;
    showMessage('Route calculation cancelled.');
    updateUI();
  }
}

function onClearRoutesButtonPressed() {
  if (!map) return;
  map.preferences.routes.clear();
  map.deactivateAllHighlights();
  currentRoute = null;
  updateUI();
}

function centerOnTraffic(route: Route) {
  // Get the traffic events from the route.
  const trafficEvents = route.trafficEvents;
  if (!trafficEvents || trafficEvents.length === 0) {
    showMessage('No traffic events found.');
    return;
  }
  const trafficEvent = trafficEvents[0];
  map!.centerOnRouteTrafficEvent(trafficEvent, { zoomLevel: 70 });
  showMessage('Centered on first traffic event.');
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

  // Build Route button
  buildRouteBtn = document.createElement('button');
  buildRouteBtn.innerHTML = `${ICONS.directions} Build Route`;
  buildRouteBtn.className = 'gem-button gem-button-primary gem-button-center';
  buildRouteBtn.onclick = () => onBuildRouteButtonPressed();
  document.body.appendChild(buildRouteBtn);

  // Cancel Route button
  cancelRouteBtn = document.createElement('button');
  cancelRouteBtn.innerHTML = `${ICONS.close} Cancel`;
  cancelRouteBtn.className = 'gem-button gem-button-danger gem-button-center';
  cancelRouteBtn.onclick = () => onCancelRouteButtonPressed();
  document.body.appendChild(cancelRouteBtn);

  // Center Traffic button
  centerTrafficBtn = document.createElement('button');
  centerTrafficBtn.innerHTML = `${ICONS.traffic} Center on Traffic`;
  centerTrafficBtn.className = 'gem-button gem-button-warning gem-button-center';
  centerTrafficBtn.onclick = () => {
    if (currentRoute) centerOnTraffic(currentRoute);
  };
  document.body.appendChild(centerTrafficBtn);

  // Clear Routes button
  clearRoutesBtn = document.createElement('button');
  clearRoutesBtn.innerHTML = `${ICONS.trash} Clear Routes`;
  clearRoutesBtn.className = 'gem-button gem-button-success gem-button-center';
  clearRoutesBtn.onclick = () => onClearRoutesButtonPressed();
  document.body.appendChild(clearRoutesBtn);

  updateUI();
});
