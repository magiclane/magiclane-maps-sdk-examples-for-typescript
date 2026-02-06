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
  NavigationService,
  NavigationInstruction,
  HighlightRenderSettings,
  HighlightOptions,
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

// Type for screen position coordinates
interface ScreenPosition {
  x: number;
  y: number;
}

let map: GemMap | null = null;
let routes: Route[] | null = null;
let routingHandler: TaskHandler | null = null;
let navigationHandler: TaskHandler | null = null;
let currentInstruction: NavigationInstruction | null = null;
let areRoutesBuilt = false;
let isSimulationActive = false;

// UI Elements
let buildRouteBtn: HTMLButtonElement;
let startSimBtn: HTMLButtonElement;
let stopSimBtn: HTMLButtonElement;
let instructionPanel: HTMLDivElement | null = null;
let bottomPanel: HTMLDivElement | null = null;
let followBtn: HTMLButtonElement | null = null;

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
    // Register the route selection logic
    registerRouteTapCallback();
  });
  if (wrapper) container.appendChild(wrapper);

  // Build Route button
  buildRouteBtn = document.createElement('button');
  buildRouteBtn.innerHTML = `${ICONS.route} Build Route`;
  styleButton(buildRouteBtn, '#673ab7', '#7e57c2');
  buildRouteBtn.onclick = () => onBuildRouteButtonPressed();
  document.body.appendChild(buildRouteBtn);

  // Start Simulation button
  startSimBtn = document.createElement('button');
  startSimBtn.innerHTML = `${ICONS.play} Start Simulation`;
  styleButton(startSimBtn, '#4caf50', '#66bb6a');
  startSimBtn.onclick = () => startSimulation();
  document.body.appendChild(startSimBtn);

  // Stop Simulation button
  stopSimBtn = document.createElement('button');
  stopSimBtn.innerHTML = `${ICONS.stop} Stop Simulation`;
  styleButton(stopSimBtn, '#f44336', '#ef5350');
  stopSimBtn.onclick = () => stopSimulation();
  document.body.appendChild(stopSimBtn);

  updateUI();
});

function updateUI() {
  buildRouteBtn.style.display = !routingHandler && !areRoutesBuilt ? 'flex' : 'none';

  // Show Start button if routes are built but sim is not active
  startSimBtn.style.display = !isSimulationActive && areRoutesBuilt ? 'flex' : 'none';

  // Show Stop button if sim is active
  stopSimBtn.style.display = isSimulationActive ? 'flex' : 'none';

  if (isSimulationActive && currentInstruction) {
    showInstructionPanel(currentInstruction);
    showBottomPanel(currentInstruction);
    showFollowButton();
  } else {
    hidePanels();
  }
}

function hidePanels() {
  instructionPanel?.remove();
  instructionPanel = null;
  bottomPanel?.remove();
  bottomPanel = null;
  followBtn?.remove();
  followBtn = null;
}

// Register route tap callback for selecting alternative routes
function registerRouteTapCallback() {
  if (!map) return;
  map.registerTouchCallback(async (pos: ScreenPosition) => {
    // If simulation is running, we usually don't want route switching,
    // but for this demo, we allow it or check !isSimulationActive
    if (isSimulationActive) return;

    await map!.setCursorScreenPosition(pos);
    const selectedRoutes = map!.cursorSelectionRoutes();
    if (selectedRoutes.length > 0) {
      map!.preferences.routes.mainRoute = selectedRoutes[0];
      // Optional: Inform user
      showMessage('Route selected');
    }
  });
}

function onBuildRouteButtonPressed() {
  if (!map) return;

  // Paris area
  const departureLandmark = Landmark.withCoordinates(
    Coordinates.fromLatLong(48.802081763044654, 2.12978950646124)
  );
  const destinationLandmark = Landmark.withCoordinates(
    Coordinates.fromLatLong(48.945095985397906, 2.687421307353545)
  );

  const routePreferences = new RoutePreferences({});
  showMessage('Calculating route...');

  routingHandler = RoutingService.calculateRoute(
    [departureLandmark, destinationLandmark],
    routePreferences,
    (err: GemError, calculatedRoutes: Route[]) => {
      routingHandler = null;
      if (err === GemError.success && calculatedRoutes.length > 0) {
        const routesMap = map?.preferences.routes;
        calculatedRoutes.forEach((route, index) => {
          routesMap?.add(route, index === 0, { label: getRouteLabel(route) });
        });
        map?.centerOnRoutes({ routes: calculatedRoutes });
        routes = calculatedRoutes;
        areRoutesBuilt = true;
        showMessage('Routes calculated! Tap to select.');
      } else {
        showMessage('Route calculation failed.');
      }
      updateUI();
    }
  );
  updateUI();
}

function startSimulation() {
  if (!map || !routes || !routes[0]) return;
  map.preferences.routes.clearAllButMainRoute?.();
  const routesMap = map.preferences.routes;
  if (!routesMap.mainRoute) {
    showMessage('No main route available');
    return;
  }
  navigationHandler = NavigationService.startSimulation(routesMap.mainRoute, undefined, {
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
  map.startFollowingPosition?.();
  isSimulationActive = true;
  updateUI();
  showMessage('Simulation started');
}

function stopSimulation() {
  if (navigationHandler) {
    NavigationService.cancelNavigation(navigationHandler);
    navigationHandler = null;
  }
  cancelRoute();
  isSimulationActive = false;
  areRoutesBuilt = false;
  updateUI();
  showMessage('Simulation stopped');
}

function cancelRoute() {
  if (!map) return;
  map.preferences.routes.clear();
  routes = null;
  areRoutesBuilt = false;
  updateUI();
}

// Modern Top Instruction Card
function showInstructionPanel(instruction: NavigationInstruction) {
  if (!instructionPanel) {
    instructionPanel = document.createElement('div');
    instructionPanel.style.cssText = `
        position: fixed; 
        top: 90px; /* Below the Stop button */
        left: 20px; right: 20px; 
        max-width: 400px;
        margin: 0 auto;
        background: #212121; 
        color: #fff; 
        border-radius: 16px; 
        z-index: 2100; 
        padding: 16px; 
        display: flex; 
        align-items: center;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;
    document.body.appendChild(instructionPanel);
  }

  instructionPanel.innerHTML = '';

  // Turn icon
  const iconDiv = document.createElement('div');
  iconDiv.style.cssText =
    'width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.1); border-radius: 12px; margin-right: 16px; flex-shrink: 0;';

  const turnImageData = instruction.getNextTurnImage({
    size: { width: 56, height: 56 },
    format: 0,
  });
  if (turnImageData && turnImageData.length > 0) {
    const uint8Array = new Uint8Array(turnImageData.buffer as ArrayBuffer);
    const blob = new Blob([uint8Array], { type: 'image/png' });
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = document.createElement('img');
      img.src = e.target?.result as string;
      img.style.cssText = 'width: 40px; height: 40px; filter: invert(1);'; // Invert for white icon on dark bg
      iconDiv.appendChild(img);
    };
    reader.readAsDataURL(blob);
  }
  instructionPanel.appendChild(iconDiv);

  // Info
  const infoDiv = document.createElement('div');
  infoDiv.innerHTML = `
    <div style="font-size:24px; font-weight:700; margin-bottom: 4px;">${getFormattedDistanceToNextTurn(instruction)}</div>
    <div style="font-size:16px; font-weight:400; opacity: 0.9; line-height: 1.3;">${instruction.nextStreetName || 'Follow route'}</div>
  `;
  instructionPanel.appendChild(infoDiv);
}

// Modern Bottom Status Bar
function showBottomPanel(instruction: NavigationInstruction) {
  if (!bottomPanel) {
    bottomPanel = document.createElement('div');
    bottomPanel.style.cssText = `
        position: fixed; 
        bottom: 30px; 
        left: 20px; right: 20px;
        max-width: 500px;
        margin: 0 auto;
        height: 60px;
        background: #fff; 
        color: #222; 
        border-radius: 30px; 
        z-index: 2100; 
        box-shadow: 0 5px 20px rgba(0,0,0,0.15); 
        padding: 0 30px; 
        display: flex; 
        align-items: center; 
        justify-content: space-between;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;
    document.body.appendChild(bottomPanel);
  }

  bottomPanel.innerHTML = `
    <div style="text-align:center;">
        <div style="font-size:12px; color:#888; text-transform:uppercase; font-weight:600;">Time</div>
        <div style="font-size:18px; font-weight:700; color:#4caf50;">${getFormattedRemainingDuration(instruction)}</div>
    </div>
    <div style="width:1px; height:30px; background:#eee;"></div>
    <div style="text-align:center;">
        <div style="font-size:12px; color:#888; text-transform:uppercase; font-weight:600;">Arrival</div>
        <div style="font-size:18px; font-weight:700;">${getFormattedETA(instruction)}</div>
    </div>
    <div style="width:1px; height:30px; background:#eee;"></div>
    <div style="text-align:center;">
        <div style="font-size:12px; color:#888; text-transform:uppercase; font-weight:600;">Distance</div>
        <div style="font-size:18px; font-weight:700;">${getFormattedRemainingDistance(instruction)}</div>
    </div>
  `;
}

// Modern Floating Recenter Button
function showFollowButton() {
  if (followBtn) return;

  followBtn = document.createElement('button');
  followBtn.innerHTML = `${ICONS.navigation} <span style="margin-left:8px;">Recenter</span>`;
  followBtn.style.cssText = `
    position: fixed; 
    bottom: 110px; 
    right: 20px; 
    padding: 12px 20px; 
    background: #fff; 
    color: #333; 
    border: none; 
    border-radius: 50px; 
    font-size: 14px; 
    font-weight: 600; 
    box-shadow: 0 4px 15px rgba(0,0,0,0.15); 
    z-index: 2100; 
    display: flex; 
    align-items: center; 
    cursor: pointer;
    transition: transform 0.2s;
  `;

  followBtn.onclick = () => map?.startFollowingPosition?.();
  followBtn.onmouseenter = () => (followBtn!.style.transform = 'scale(1.05)');
  followBtn.onmouseleave = () => (followBtn!.style.transform = 'scale(1)');

  document.body.appendChild(followBtn);
}

// --- Formatters ---

function getRouteLabel(route: Route): string {
  const timeDistance = route.getTimeDistance();
  const totalDistance = timeDistance.unrestrictedDistanceM + timeDistance.restrictedDistanceM;
  const totalDuration = timeDistance.unrestrictedTimeS + timeDistance.restrictedTimeS;
  return `${convertDistance(totalDistance)}\n${convertDuration(totalDuration)}`;
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
