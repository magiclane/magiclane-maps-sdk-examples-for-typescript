// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

import {
  GemKit,
  GemMap,
  Coordinates,
  PositionService,
  Landmark,
  RoutePreferences,
  RoutingService,
  GemError,
  Route,
  TaskHandler,
} from '@magiclane/maps-sdk';
import {
  GEMKIT_TOKEN,
  ICONS,
  showMessage,
  styleButton,
  convertDistance,
  convertDuration,
  ScreenPosition,
  initializeSDK,
  createMapView,
  EventListenerManager,
} from '../../shared';

let map: GemMap | null = null;
let routingHandler: TaskHandler | null = null;
let routes: Route[] | null = null;

// Event listener manager for proper cleanup
const events = new EventListenerManager();

// UI Elements
let buildRouteBtn: HTMLButtonElement;
let cancelRouteBtn: HTMLButtonElement;
let clearRoutesBtn: HTMLButtonElement;

function updateUI() {
  // Logic to ensure buttons occupy the same center spot
  buildRouteBtn.style.display = 'none';
  cancelRouteBtn.style.display = 'none';
  clearRoutesBtn.style.display = 'none';

  if (!routingHandler && !routes) {
    buildRouteBtn.style.display = 'flex';
  } else if (routingHandler && !routes) {
    cancelRouteBtn.style.display = 'flex';
  } else if (routes && !routingHandler) {
    clearRoutesBtn.style.display = 'flex';
  }
}

// Route calculation functionality
function onBuildRouteButtonPressed() {
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
  showMessage('The route is calculating.');

  // Calculate route
  routingHandler = RoutingService.calculateRoute(
    [departureLandmark, destinationLandmark],
    routePreferences,
    (err: GemError, calculatedRoutes: Route[]) => {
      routingHandler = null;

      if (err === GemError.success) {
        const routesMap = map?.preferences.routes;

        // Display the routes on map
        calculatedRoutes.forEach((route, index) => {
          // Add route with label
          const label = getRouteLabel(route);
          routesMap?.add(route, index === 0, { label });
        });

        // Center the camera on routes
        map?.centerOnRoutes({ routes: calculatedRoutes });
        showMessage('Route calculated successfully!');

        routes = calculatedRoutes;
      } else {
        showMessage('Route calculation failed.');
      }

      updateUI();
    }
  );

  updateUI();
}

// Clear routes functionality
function onClearRoutesButtonPressed() {
  // Remove the routes from map
  map?.preferences.routes.clear();
  routes = null;
  updateUI();
}

// Cancel route calculation
function onCancelRouteButtonPressed() {
  if (routingHandler) {
    RoutingService.cancelRoute(routingHandler);
    routingHandler = null;
    showMessage('Route calculation cancelled.');
  }
  updateUI();
}

// Register route tap callback for selecting alternative routes
function registerRouteTapCallback() {
  if (!map) return;

  map.registerTouchCallback(async (pos: ScreenPosition) => {
    // Select the map objects at given position
    await map!.setCursorScreenPosition(pos);

    // Get the selected routes
    const selectedRoutes = map!.cursorSelectionRoutes();

    // If there is a route at position, select it as the main one
    if (selectedRoutes.length > 0) {
      const routesMap = map!.preferences.routes;
      if (routesMap) {
        routesMap.mainRoute = selectedRoutes[0];
      }
    }
  });

  // Register callback for cleanup
  events.addSDKCallback('touch', () => map?.unregisterTouchCallback());
}

// Utility function to get route label (distance and duration)
function getRouteLabel(route: Route): string {
  const timeDistance = route.getTimeDistance();
  const totalDistance = timeDistance.unrestrictedDistanceM + timeDistance.restrictedDistanceM;
  const totalDuration = timeDistance.unrestrictedTimeS + timeDistance.restrictedTimeS;

  return `${convertDistance(totalDistance)}\n${convertDuration(totalDuration)}`;
}

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
  await PositionService.instance;

  // Create map view with error handling
  const viewId = 2;
  const wrapper = createMapView(gemKit, container, viewId, (gemMap: GemMap) => {
    map = gemMap;
    // Register route tap callback for alternative route selection
    registerRouteTapCallback();
  });

  if (!wrapper) {
    console.error('Failed to create map view');
    return;
  }

  // Build Route button
  buildRouteBtn = document.createElement('button');
  buildRouteBtn.innerHTML = `${ICONS.directions} Build Route`;
  styleButton(buildRouteBtn, '#673ab7', '#7e57c2'); // Purple
  buildRouteBtn.onclick = () => onBuildRouteButtonPressed();
  document.body.appendChild(buildRouteBtn);

  // Cancel Route button
  cancelRouteBtn = document.createElement('button');
  cancelRouteBtn.innerHTML = `${ICONS.close} Cancel`;
  styleButton(cancelRouteBtn, '#f44336', '#ef5350'); // Red
  cancelRouteBtn.onclick = () => onCancelRouteButtonPressed();
  document.body.appendChild(cancelRouteBtn);

  // Clear Routes button
  clearRoutesBtn = document.createElement('button');
  clearRoutesBtn.innerHTML = `${ICONS.trash} Clear Routes`;
  styleButton(clearRoutesBtn, '#4caf50', '#66bb6a'); // Green
  clearRoutesBtn.onclick = () => onClearRoutesButtonPressed();
  document.body.appendChild(clearRoutesBtn);

  updateUI();

  // Register cleanup on page unload
  events.add(window, 'beforeunload', () => {
    events.cleanup();
  });
});
