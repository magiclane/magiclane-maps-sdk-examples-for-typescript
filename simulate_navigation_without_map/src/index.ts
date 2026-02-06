// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

import {
  GemKit,
  Landmark,
  RoutePreferences,
  RoutingService,
  GemError,
  Route,
  NavigationService,
  NavigationInstruction,
  TaskHandler,
} from '@magiclane/maps-sdk';
import { GEMKIT_TOKEN, showMessage, convertDistance, convertDuration } from '../../shared';

let route: Route | null = null;
let currentInstruction: NavigationInstruction | null = null;
let areRoutesBuilt = false;
let isSimulationActive = false;
let routingHandler: TaskHandler | null = null;
let navigationHandler: TaskHandler | null = null;

window.addEventListener('DOMContentLoaded', async () => {
  let gemKit: GemKit;
  try {
    gemKit = await GemKit.initialize(GEMKIT_TOKEN);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    showMessage(`SDK initialization failed: ${message}`, 5000);
    console.error('SDK initialization failed:', error);
    return;
  }
  setupUI();
});

function getCurrentTime({
  additionalHours = 0,
  additionalMinutes = 0,
  additionalSeconds = 0,
} = {}): string {
  const now = new Date();
  const updatedTime = new Date(
    now.getTime() + additionalHours * 3600000 + additionalMinutes * 60000 + additionalSeconds * 1000
  );
  return updatedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getFormattedDistanceToNextTurn(instruction: NavigationInstruction): string {
  const td = instruction.timeDistanceToNextTurn;
  const totalDistance = td.unrestrictedDistanceM + td.restrictedDistanceM;
  return convertDistance(totalDistance);
}
function getFormattedRemainingDistance(instruction: NavigationInstruction): string {
  const td = instruction.remainingTravelTimeDistance;
  const totalDistance = td.unrestrictedDistanceM + td.restrictedDistanceM;
  return convertDistance(totalDistance);
}
function getFormattedRemainingDuration(instruction: NavigationInstruction): string {
  const td = instruction.remainingTravelTimeDistance;
  const totalDuration = td.unrestrictedTimeS + td.restrictedTimeS;
  return convertDuration(totalDuration);
}
function getFormattedETA(instruction: NavigationInstruction): string {
  const td = instruction.remainingTravelTimeDistance;
  const totalDuration = td.unrestrictedTimeS + td.restrictedTimeS;
  return getCurrentTime({ additionalSeconds: totalDuration });
}
function startSimulation() {
  if (!route) return;
  navigationHandler = NavigationService.startSimulation(route, undefined, {
    onNavigationInstruction: (instruction: NavigationInstruction) => {
      isSimulationActive = true;
      currentInstruction = instruction;
      updateUI();
    },
    onError: (error: GemError) => {
      isSimulationActive = false;
      cancelRoute();
      if (error !== GemError.cancel) {
        stopSimulation();
      }
    },
  });
  isSimulationActive = true;
  updateUI();
}

function stopSimulation() {
  if (navigationHandler) {
    NavigationService.cancelNavigation(navigationHandler);
    navigationHandler = null;
  }
  cancelRoute();
  isSimulationActive = false;
  updateUI();
}

function cancelRoute() {
  route = null;
  areRoutesBuilt = false;
  updateUI();
}

function createInstructionPanel(instruction: NavigationInstruction): HTMLDivElement {
  const panel = document.createElement('div');
  panel.style.cssText =
    'margin-top: 20px; background: #222; color: #fff; border-radius: 15px; padding: 10px; display: flex; align-items: center;';
  // Turn icon
  const iconDiv = document.createElement('div');
  iconDiv.style.cssText =
    'width: 100px; height: 100px; display: flex; align-items: center; justify-content: center;';
  const turnImageData = instruction.getNextTurnImage?.();
  if (turnImageData && turnImageData.length > 0) {
    const blob = new Blob([turnImageData], { type: 'image/png' });
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = document.createElement('img');
      img.src = e.target?.result as string;
      img.alt = 'Turn';
      img.style.cssText = 'max-width: 80px; max-height: 80px;';
      iconDiv.appendChild(img);
    };
    reader.readAsDataURL(blob);
  }
  panel.appendChild(iconDiv);
  // Info
  const infoDiv = document.createElement('div');
  infoDiv.style.cssText = 'margin-left: 20px;';
  infoDiv.innerHTML = `<div style="font-size:25px;font-weight:600;">${getFormattedDistanceToNextTurn(instruction)}</div><div style="font-size:20px;font-weight:600;">${instruction.nextStreetName || ''}</div>`;
  panel.appendChild(infoDiv);
  return panel;
}

function createBottomPanel(instruction: NavigationInstruction): HTMLDivElement {
  const panel = document.createElement('div');
  panel.style.cssText =
    'margin-top: 10px; background: #fff; color: #222; border-radius: 20px; box-shadow: 0 4px 24px rgba(0,0,0,0.1); padding: 0 15px; display: flex; align-items: center; justify-content: space-between; font-size: 24px; font-weight: 500;';
  panel.innerHTML = `<span>${getFormattedRemainingDuration(instruction)}</span><span>${getFormattedETA(instruction)}</span><span>${getFormattedRemainingDistance(instruction)}</span>`;
  return panel;
}
function updateUI() {
  const { buildRouteBtn, startSimBtn, stopSimBtn, statusMsg, panelsContainer } =
    (window as any)._uiRefs || {};
  if (!buildRouteBtn || !startSimBtn || !stopSimBtn || !statusMsg) return;
  buildRouteBtn.style.display = !routingHandler && !areRoutesBuilt ? 'inline-block' : 'none';
  startSimBtn.style.display = !isSimulationActive && areRoutesBuilt ? 'inline-block' : 'none';
  stopSimBtn.style.display = isSimulationActive ? 'inline-block' : 'none';
  statusMsg.textContent = isSimulationActive
    ? 'Simulation running...'
    : areRoutesBuilt
      ? 'Route ready.'
      : '';
  panelsContainer.innerHTML = '';
  if (isSimulationActive && currentInstruction) {
    panelsContainer.appendChild(createInstructionPanel(currentInstruction));
    panelsContainer.appendChild(createBottomPanel(currentInstruction));
  }
}

function onBuildRouteButtonPressed() {
  const { statusMsg } = (window as any)._uiRefs || {};
  // Departure: Düsseldorf
  const departureLandmark = Landmark.withLatLng({
    latitude: 51.20830988558932,
    longitude: 6.6794155000229045,
  });
  // Destination: Cologne
  const destinationLandmark = Landmark.withLatLng({
    latitude: 50.93416933110433,
    longitude: 6.94370301382495,
  });
  const routePreferences = new RoutePreferences({});
  statusMsg.textContent = 'The route is calculating.';
  routingHandler = RoutingService.calculateRoute(
    [departureLandmark, destinationLandmark],
    routePreferences,
    (err: GemError, routes: Route[]) => {
      routingHandler = null;
      if (err === GemError.success && routes.length > 0) {
        route = routes[0];
        areRoutesBuilt = true;
        statusMsg.textContent = 'Successfully calculated the route.';
      } else {
        statusMsg.textContent = 'Route calculation failed.';
      }
      updateUI();
    }
  );
  updateUI();
}

function setupUI() {
  // Main container
  const container = document.createElement('div');
  container.style.cssText =
    'padding: 30px; max-width: 600px; margin: 0 auto; font-family: sans-serif;';
  document.body.appendChild(container);

  // Title
  const title = document.createElement('h2');
  title.textContent = 'Simulate Navigation Without Map';
  title.style.cssText = 'color: #fff; background: #673ab7; padding: 10px 20px; border-radius: 8px;';
  container.appendChild(title);

  // Status message
  const statusMsg = document.createElement('div');
  statusMsg.id = 'status-msg';
  statusMsg.style.cssText = 'margin: 20px 0; color: #333; font-size: 1em;';
  container.appendChild(statusMsg);

  // Build Route button
  const buildRouteBtn = document.createElement('button');
  buildRouteBtn.textContent = 'Build Route';
  buildRouteBtn.className = 'gem-button gem-button-primary';
  buildRouteBtn.onclick = () => onBuildRouteButtonPressed();
  container.appendChild(buildRouteBtn);

  // Start Simulation button
  const startSimBtn = document.createElement('button');
  startSimBtn.textContent = 'Start Simulation';
  startSimBtn.className = 'gem-button gem-button-warning';
  startSimBtn.style.display = 'none';
  startSimBtn.onclick = () => startSimulation();
  container.appendChild(startSimBtn);

  // Stop Simulation button
  const stopSimBtn = document.createElement('button');
  stopSimBtn.textContent = 'Stop Simulation';
  stopSimBtn.className = 'gem-button gem-button-danger';
  stopSimBtn.style.display = 'none';
  stopSimBtn.onclick = () => stopSimulation();
  container.appendChild(stopSimBtn);

  // Panels container
  const panelsContainer = document.createElement('div');
  panelsContainer.id = 'panels-container';
  container.appendChild(panelsContainer);

  // Store references for later UI updates
  (window as any)._uiRefs = {
    buildRouteBtn,
    startSimBtn,
    stopSimBtn,
    statusMsg,
    panelsContainer,
  };

  updateUI();
}
