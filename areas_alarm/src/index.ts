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
  NavigationService,
  GemError,
  Marker,
  MarkerCollection,
  MarkerType,
  MarkerCollectionRenderSettings,
  AlarmService,
  AlarmListener,
  CircleGeographicArea,
  TaskHandler,
  Route,
  ColorExtension,
  Color,
  GemAnimation,
  AnimationType,
} from '@magiclane/maps-sdk';
import { GEMKIT_TOKEN, showMessage } from '../../shared';

let map: GemMap | null = null;

// Application state
let areRoutesBuilt = false;
let isSimulationActive = false;
let routingHandler: TaskHandler | null = null;
let navigationHandler: TaskHandler | null = null;
let alarmService: AlarmService | null = null;
let alarmListener: AlarmListener | null = null;
let areaNotification: string | null = null;

// UI Elements
let buildRouteBtn: HTMLButtonElement;
let startSimBtn: HTMLButtonElement;
let stopSimBtn: HTMLButtonElement;
let alarmPanel: HTMLDivElement;

// Method for generating coordinates in a circle shape
function generateCircleCoordinates(
  center: Coordinates,
  radiusMeters: number,
  numberOfPoints = 36
): Coordinates[] {
  const earthRadius = 6371000; // in meters
  const centerLatRad = (center.latitude * Math.PI) / 180;
  const centerLonRad = (center.longitude * Math.PI) / 180;

  const coordinates: Coordinates[] = [];

  for (let i = 0; i < numberOfPoints; i++) {
    const angle = (2 * Math.PI * i) / numberOfPoints;
    const deltaLat = (radiusMeters / earthRadius) * Math.cos(angle);
    const deltaLon = (radiusMeters / (earthRadius * Math.cos(centerLatRad))) * Math.sin(angle);

    const pointLat = ((centerLatRad + deltaLat) * 180) / Math.PI;
    const pointLon = ((centerLonRad + deltaLon) * 180) / Math.PI;

    coordinates.push(new Coordinates({ latitude: pointLat, longitude: pointLon }));
  }

  return coordinates;
}

// Update UI state
function updateUI() {
  buildRouteBtn.style.display = areRoutesBuilt ? 'none' : 'block';
  startSimBtn.style.display = areRoutesBuilt && !isSimulationActive ? 'block' : 'none';
  stopSimBtn.style.display = isSimulationActive ? 'block' : 'none';

  if (areaNotification) {
    alarmPanel.textContent = areaNotification;
    alarmPanel.style.display = 'block';
    // Add simple entrance animation
    alarmPanel.style.opacity = '0';
    alarmPanel.style.transform = 'translateX(-50%) translateY(-10px)';
    requestAnimationFrame(() => {
      alarmPanel.style.opacity = '1';
      alarmPanel.style.transform = 'translateX(-50%) translateY(0)';
    });
  } else {
    alarmPanel.style.display = 'none';
  }
}

// Create alarm panel UI
function createAlarmPanel(): HTMLDivElement {
  const panel = document.createElement('div');
  // IMPROVEMENT: Centered below the buttons, styled with glassmorphism
  panel.style.cssText = `
    position: fixed; 
    top: 90px; 
    left: 50%; 
    transform: translateX(-50%);
    background: rgba(210, 104, 102, 0.95); 
    color: white; 
    padding: 12px 24px; 
    border-radius: 50px; 
    font-weight: 600; 
    z-index: 2000;
    display: none;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    box-shadow: 0 4px 15px rgba(210, 104, 102, 0.4);
    backdrop-filter: blur(4px);
    transition: all 0.3s ease;
  `;
  return panel;
}

// Map creation callback
function onMapCreated(gemMap: GemMap) {
  map = gemMap;

  // Draw area on map
  const marker = new Marker();
  const circleAreaCoords = generateCircleCoordinates(
    new Coordinates({ latitude: 50.92396, longitude: 9.54976 }),
    200
  );

  circleAreaCoords.forEach((coord) => marker.add(coord));

  const markerCollection = MarkerCollection.create(MarkerType.Polygon, 'Circle');
  markerCollection.add(marker);

  map.preferences.markers.add(markerCollection, {
    settings: new MarkerCollectionRenderSettings({
      polygonFillColor: new Color(210, 104, 102, 111),
    }),
  });
}

// Build route functionality
function onBuildRouteButtonPressed() {
  // Define the departure
  const departureLandmark = Landmark.withLatLng({
    latitude: 50.92899490001731,
    longitude: 9.544136681645025,
  });

  // Define the destination
  const destinationLandmark = Landmark.withLatLng({
    latitude: 50.919902402432946,
    longitude: 9.55855522546262,
  });

  // Define the route preferences
  const routePreferences = new RoutePreferences({});
  showMessage('The route is calculating.');

  // Calculate route
  routingHandler = RoutingService.calculateRoute(
    [departureLandmark, destinationLandmark],
    routePreferences,
    (err: GemError, routes: Route[]) => {
      routingHandler = null;

      if (err === GemError.success) {
        const routesMap = map?.preferences.routes;

        // Display the routes on map
        routes.forEach((route, index) => {
          routesMap?.add(route, index === 0); // First route is main
        });

        // Center the camera on routes
        map?.centerOnRoutes({ routes });
        showMessage('Route calculated successfully!');
      } else {
        showMessage('Route calculation failed.');
      }

      areRoutesBuilt = true;
      updateUI();
    }
  );
}

// Start simulation
function startSimulation() {
  const routes = map?.preferences.routes;
  map?.preferences.routes.clearAllButMainRoute();

  if (!routes?.mainRoute) {
    showMessage('No main route available');
    return;
  }

  // Register callback for area crossing
  alarmListener = AlarmListener.create({
    onBoundaryCrossed: (enteredAreas: string[], exitedAreas: string[]) => {
      if (enteredAreas.length > 0) {
        areaNotification = `Entered area: ${enteredAreas[0]}`;
      } else {
        areaNotification = `Exited area: ${exitedAreas[0]}`;
      }
      updateUI();
    },
  });

  // Set the alarms service with the listener
  alarmService = AlarmService.create(alarmListener);

  alarmService.monitorArea(
    new CircleGeographicArea({
      radius: 200,
      centerCoordinates: new Coordinates({ latitude: 50.92396, longitude: 9.54976 }),
    }),
    'Test area'
  );

  navigationHandler = NavigationService.startSimulation(routes.mainRoute, undefined, {
    onNavigationInstruction: (instruction, events) => {
      isSimulationActive = true;
      updateUI();
    },
    onDestinationReached: (landmark) => {
      stopSimulation();
      cancelRoute();
    },
    onError: (error) => {
      isSimulationActive = false;
      areaNotification = null;
      updateUI();
      cancelRoute();

      if (error !== GemError.cancel) {
        stopSimulation();
      }
    },
  });

  // Set the camera to follow position
  map?.startFollowingPosition({ zoomLevel: 70, viewAngle: 0 });
}

// Cancel route
function cancelRoute() {
  map?.preferences.routes.clear();

  if (routingHandler) {
    RoutingService.cancelRoute(routingHandler);
    routingHandler = null;
  }

  areRoutesBuilt = false;
  updateUI();
}

// Stop simulation
function stopSimulation() {
  if (navigationHandler) {
    NavigationService.cancelNavigation(navigationHandler);
    navigationHandler = null;
  }
  areaNotification = null;
  cancelRoute();
  isSimulationActive = false;
  updateUI();
}

// Initialize the application
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

  const viewId = 1;
  const wrapper = gemKit.createView(viewId, onMapCreated);
  if (wrapper) container.appendChild(wrapper);

  // Create UI elements
  alarmPanel = createAlarmPanel();
  document.body.appendChild(alarmPanel);

  // Build Route button
  buildRouteBtn = document.createElement('button');
  buildRouteBtn.textContent = 'Build Route';
  buildRouteBtn.className = 'gem-button gem-button-primary gem-button-center';
  buildRouteBtn.onclick = onBuildRouteButtonPressed;
  document.body.appendChild(buildRouteBtn);

  // Start Simulation button
  startSimBtn = document.createElement('button');
  startSimBtn.textContent = 'Start Simulation';
  startSimBtn.className = 'gem-button gem-button-success gem-button-center';
  startSimBtn.onclick = startSimulation;
  document.body.appendChild(startSimBtn);

  // Stop Simulation button
  stopSimBtn = document.createElement('button');
  stopSimBtn.textContent = 'Stop Simulation';
  stopSimBtn.className = 'gem-button gem-button-danger gem-button-center';
  stopSimBtn.onclick = stopSimulation;
  document.body.appendChild(stopSimBtn);

  updateUI();
});
