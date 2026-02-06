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
  NavigationService,
  NavigationInstruction,
  TaskHandler,
  NavigationEventType,
} from '@magiclane/maps-sdk';
import { GEMKIT_TOKEN, showMessage, ICONS, convertDistance, convertDuration } from '../../shared';

let map: GemMap | null = null;
let currentInstruction: NavigationInstruction | null = null;
let areRoutesBuilt = false;
let isSimulationActive = false;
let routingHandler: TaskHandler | null = null;
let navigationHandler: TaskHandler | null = null;

function getCurrentTime(additionalSeconds = 0): string {
  const now = new Date();
  const updatedTime = new Date(now.getTime() + additionalSeconds * 1000);
  return updatedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getRouteMapLabel(route: Route): string {
  const timeDistance = route.getTimeDistance();
  const totalDistance = timeDistance.unrestrictedDistanceM + timeDistance.restrictedDistanceM;
  const totalDuration = timeDistance.unrestrictedTimeS + timeDistance.restrictedTimeS;
  return `${convertDistance(totalDistance)} \n${convertDuration(totalDuration)}`;
}

// NavigationInstruction formatting helpers
function getFormattedDistanceToNextTurn(instr: NavigationInstruction): string {
  const td = instr.timeDistanceToNextTurn;
  return convertDistance(td.unrestrictedDistanceM + td.restrictedDistanceM);
}
function getFormattedDurationToNextTurn(instr: NavigationInstruction): string {
  const td = instr.timeDistanceToNextTurn;
  return convertDuration(td.unrestrictedTimeS + td.restrictedTimeS);
}
function getFormattedRemainingDistance(instr: NavigationInstruction): string {
  const td = instr.remainingTravelTimeDistance;
  return convertDistance(td.unrestrictedDistanceM + td.restrictedDistanceM);
}
function getFormattedRemainingDuration(instr: NavigationInstruction): string {
  const td = instr.remainingTravelTimeDistance;
  return convertDuration(td.unrestrictedTimeS + td.restrictedTimeS);
}
function getFormattedETA(instr: NavigationInstruction): string {
  const td = instr.remainingTravelTimeDistance;
  return getCurrentTime(td.unrestrictedTimeS + td.restrictedTimeS);
}

// Lane image panel
let laneImagePanel: HTMLDivElement;

function updateLaneImagePanel() {
  if (!isSimulationActive || !currentInstruction) {
    if (laneImagePanel) laneImagePanel.style.display = 'none';
    return;
  }
  const laneImg = currentInstruction.getLaneImage({ size: { width: 100, height: 50 } });
  if (!laneImg) {
    if (laneImagePanel) laneImagePanel.style.display = 'none';
    return;
  }
  if (!laneImagePanel) {
    laneImagePanel = document.createElement('div');
    laneImagePanel.style.cssText = `
      position: fixed; left: 50%; bottom: 40px; transform: translateX(-50%);
      background: #4B0082; border-radius: 12px; padding: 12px; z-index: 2000;
      box-shadow: 0 2px 10px rgba(0,0,0,0.15);
    `;
    document.body.appendChild(laneImagePanel);
  }
  const blob = new Blob([laneImg], { type: 'image/png' });
  const url = URL.createObjectURL(blob);
  laneImagePanel.innerHTML = `<img src="${url}" style="width:100px;height:50px;object-fit:contain;" />`;
  laneImagePanel.style.display = 'block';
}

function updateUI() {
  buildRouteBtn.style.display = !isSimulationActive && !areRoutesBuilt ? 'flex' : 'none';
  startSimBtn.style.display = !isSimulationActive && areRoutesBuilt ? 'flex' : 'none';
  stopSimBtn.style.display = isSimulationActive ? 'flex' : 'none';
}

function onMapCreated(gemMap: GemMap) {
  map = gemMap;
  updateUI();
}

function onBuildRouteButtonPressed() {
  if (!map) return;
  const departureLandmark = Landmark.withLatLng({
    latitude: 48.15021176018896,
    longitude: 11.558610476998183,
  });
  const destinationLandmark = Landmark.withLatLng({
    latitude: 48.13993582693814,
    longitude: 11.604079110086362,
  });
  const routePreferences = new RoutePreferences({});
  showMessage('The route is calculating.');

  routingHandler = RoutingService.calculateRoute(
    [departureLandmark, destinationLandmark],
    routePreferences,
    (err: GemError, routes: Route[]) => {
      routingHandler = null;
      if (err === GemError.success && routes.length > 0) {
        const routesMap = map!.preferences.routes;
        routes.forEach((route, idx) => {
          routesMap.add(route, idx === 0, { label: getRouteMapLabel(route) });
        });
        map!.centerOnRoutes({ routes });
        areRoutesBuilt = true;
        updateUI();
      } else {
        showMessage('Route calculation failed.');
      }
    }
  );
}

function startSimulation() {
  if (!map) return;
  const routes = map.preferences.routes;
  map.preferences.routes.clearAllButMainRoute();
  if (!routes.mainRoute) {
    showMessage('No main route available');
    return;
  }
  navigationHandler = NavigationService.startSimulation(routes.mainRoute, undefined, {
    onNavigationInstruction: (
      instruction: NavigationInstruction,
      events: NavigationEventType[]
    ) => {
      isSimulationActive = true;
      currentInstruction = instruction;
      updateLaneImagePanel();
      updateUI();
    },
    onError: (error: GemError) => {
      isSimulationActive = false;
      cancelRoute();
      if (error !== GemError.cancel) stopSimulation();
      updateUI();
    },
  });
  map.startFollowingPosition();
}

function cancelRoute() {
  if (!map) return;
  map.preferences.routes.clear();
  if (routingHandler) {
    RoutingService.cancelRoute(routingHandler);
    routingHandler = null;
  }
  areRoutesBuilt = false;
  updateUI();
}

function stopSimulation() {
  if (navigationHandler) {
    NavigationService.cancelNavigation(navigationHandler);
    navigationHandler = null;
  }
  cancelRoute();
  isSimulationActive = false;
  updateLaneImagePanel();
  updateUI();
}

// UI Elements
let buildRouteBtn: HTMLButtonElement;
let startSimBtn: HTMLButtonElement;
let stopSimBtn: HTMLButtonElement;

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

  // Build Route button
  buildRouteBtn = document.createElement('button');
  buildRouteBtn.innerHTML = `${ICONS.route} Build Route`;
  buildRouteBtn.className = 'gem-button gem-button-primary gem-button-center';
  buildRouteBtn.onclick = onBuildRouteButtonPressed;
  document.body.appendChild(buildRouteBtn);

  // Start Simulation button
  startSimBtn = document.createElement('button');
  startSimBtn.innerHTML = `${ICONS.play} Start Simulation`;
  startSimBtn.className = 'gem-button gem-button-success gem-button-center';
  startSimBtn.onclick = startSimulation;
  document.body.appendChild(startSimBtn);

  // Stop Simulation button
  stopSimBtn = document.createElement('button');
  stopSimBtn.innerHTML = `${ICONS.stop} Stop Simulation`;
  stopSimBtn.className = 'gem-button gem-button-danger gem-button-center';
  stopSimBtn.onclick = stopSimulation;
  document.body.appendChild(stopSimBtn);

  updateUI();
});
