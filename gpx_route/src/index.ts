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
  NavigationService,
  RouteTransportMode,
  TaskHandler,
  NavigationEventType,
  NavigationInstruction,
} from '@magiclane/maps-sdk';
import { GEMKIT_TOKEN, showMessage, ICONS, convertDistance, convertDuration } from '../../shared';

let map: GemMap | null = null;
let navigationHandler: TaskHandler | null = null;
let isSimulationActive = false;
let isGpxDataLoaded = false;
let areRoutesBuilt = false;

// UI Elements
let importBtn: HTMLButtonElement;
let startBtn: HTMLButtonElement;
let stopBtn: HTMLButtonElement;

// Helper function to create map label for routes (replaces Dart extension)
function getRouteMapLabel(route: Route): string {
  const timeDistance = route.getTimeDistance();
  const totalDistance = timeDistance.unrestrictedDistanceM + timeDistance.restrictedDistanceM;
  const totalDuration = timeDistance.unrestrictedTimeS + timeDistance.restrictedTimeS;
  return `${convertDistance(totalDistance)} \n${convertDuration(totalDuration)}`;
}

function updateUI() {
  // Show/hide buttons based on state
  importBtn.style.display = 'none';
  startBtn.style.display = 'none';
  stopBtn.style.display = 'none';

  if (!areRoutesBuilt) {
    importBtn.style.display = 'flex';
  } else if (!isSimulationActive && areRoutesBuilt) {
    startBtn.style.display = 'flex';
  } else if (isSimulationActive) {
    stopBtn.style.display = 'flex';
  }
}

async function onMapCreated(gemMap: GemMap) {
  map = gemMap;
}

async function importGPX() {
  showMessage('The route is calculating.');

  let landmarkList: Landmark[] = [];

  // Load GPX file from public/recorded_route.gpx
  const response = await fetch('./recorded_route.gpx');
  if (!response.ok) {
    showMessage('GPX file does not exist.');
    return;
  }
  const pathData = new Uint8Array(await response.arrayBuffer());

  // Process GPX data using SDK
  const gemPath = Path.create({ data: pathData, format: PathFileFormat.gpx });
  landmarkList = gemPath.toLandmarkList();

  // Define the route preferences
  const routePreferences = new RoutePreferences({
    transportMode: RouteTransportMode.bicycle,
  });

  RoutingService.calculateRoute(
    landmarkList,
    routePreferences,
    (err: GemError, routes: Route[]) => {
      if (err === GemError.success && routes.length > 0) {
        const routesMap = map!.preferences.routes;
        routes.forEach((route, idx) => {
          routesMap.add(route, idx === 0, { label: getRouteMapLabel(route) });
        });
        map!.centerOnRoutes({ routes });
        areRoutesBuilt = true;
        isGpxDataLoaded = true;
        updateUI();
        showMessage('Route loaded successfully.');
      } else {
        showMessage('Route calculation failed.');
      }
    }
  );
}

function startSimulation() {
  if (isSimulationActive || !isGpxDataLoaded) return;
  const routes = map!.preferences.routes;
  if (!routes.mainRoute) {
    showMessage('No route available');
    return;
  }

  navigationHandler = NavigationService.startSimulation(
    routes.mainRoute,
    (eventType: NavigationEventType, instruction: NavigationInstruction) => {
      // Navigation instruction callback.
    },
    { speedMultiplier: 2 }
  );

  map!.startFollowingPosition();
  isSimulationActive = true;
  updateUI();
  showMessage('Simulation started.');
}

function stopSimulation() {
  map!.preferences.routes.clear();
  areRoutesBuilt = false;

  if (isSimulationActive) {
    NavigationService.cancelNavigation(navigationHandler);
    navigationHandler = null;
    isSimulationActive = false;
    updateUI();
    showMessage('Simulation stopped.');
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

  // Start Simulation button
  startBtn = document.createElement('button');
  startBtn.innerHTML = `${ICONS.play} Start Simulation`;
  startBtn.className = 'gem-button gem-button-success gem-button-center';
  startBtn.onclick = startSimulation;
  document.body.appendChild(startBtn);

  // Stop Simulation button
  stopBtn = document.createElement('button');
  stopBtn.innerHTML = `${ICONS.stop} Stop Simulation`;
  stopBtn.className = 'gem-button gem-button-danger gem-button-center';
  stopBtn.onclick = stopSimulation;
  document.body.appendChild(stopBtn);

  updateUI();
});
