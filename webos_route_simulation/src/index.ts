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
  TaskHandler,
  MapSceneObject,
  SceneObjectFileFormat,
} from '@magiclane/maps-sdk';
import { GEMKIT_TOKEN } from './token';

declare global {
  interface Window {
    webOS?: { platformBack(): void };
  }
}

// --- Icons (Material Design SVGs) ---
const ICONS = {
  route: `<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 0 24 24" width="20" fill="currentColor"><path d="M19 15.18V7c0-2.21-1.79-4-4-4s-4 1.79-4 4v10c0 1.1-.9 2-2 2s-2-.9-2-2V8.82C8.16 8.4 9 7.3 9 6c0-1.66-1.34-3-3-3S3 4.34 3 6c0 1.3.84 2.4 2 2.82V17c0 2.21 1.79 4 4 4s4-1.79 4-4V7c0-1.1.9-2 2-2s2 .9 2 2v8.18c-1.16.42-2 1.52-2 2.82 0 1.66 1.34 3 3 3s3-1.34 3-3c0-1.3-.84-2.4-2-2.82z"/></svg>`,
  play: `<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 0 24 24" width="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
  stop: `<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 0 24 24" width="20" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>`,
  navigation: `<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 0 24 24" width="20" fill="currentColor"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>`,
  close: `<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 0 24 24" width="20" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
};

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

// webOS Specifics
const BACK_KEY_CODE = 461;
const ENTER_KEY_CODE = 13;

// Utility: show a temporary message (Modern Toast)
function showMessage(message: string, duration = 3000) {
  let msgDiv = document.getElementById('status-msg');
  if (!msgDiv) {
    msgDiv = document.createElement('div');
    msgDiv.id = 'status-msg';
    msgDiv.style.cssText = `
      position: fixed; 
      bottom: 100px; 
      left: 50%; 
      transform: translateX(-50%); 
      background: rgba(33, 33, 33, 0.95); 
      color: #fff; 
      padding: 12px 24px; 
      border-radius: 50px; 
      z-index: 2000; 
      font-size: 1.2em; /* Larger font for webOS */
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      backdrop-filter: blur(4px);
      transition: opacity 0.3s ease;
      display: none;
    `;
    document.body.appendChild(msgDiv);
  }

  if (message === '') {
    msgDiv.style.opacity = '0';
    setTimeout(() => {
      if (msgDiv) msgDiv.style.display = 'none';
    }, 300);
  } else {
    msgDiv.style.display = 'block';
    requestAnimationFrame(() => {
      if (msgDiv) msgDiv.style.opacity = '1';
    });
    msgDiv.textContent = message;

    setTimeout(() => {
      if (msgDiv) {
        msgDiv.style.opacity = '0';
        setTimeout(() => {
          if (msgDiv) {
            msgDiv.style.display = 'none';
            msgDiv.textContent = '';
          }
        }, 300);
      }
    }, duration);
  }
}

// Helper to style buttons for webOS
function styleButton(btn: HTMLButtonElement, color: string, hoverColor: string) {
  btn.style.cssText = `
        position: fixed; 
        top: 30px; 
        left: 50%; 
        transform: translateX(-50%); 
        padding: 15px 30px; /* Larger hit area for remote cursor */
        background: ${color}; 
        color: #fff; 
        border: 2px solid transparent; 
        border-radius: 50px; 
        font-size: 18px; /* Larger text for webOS */
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-weight: 600; 
        cursor: pointer; 
        z-index: 2000;
        box-shadow: 0 4px 15px ${color}66;
        transition: all 0.2s ease-in-out;
        letter-spacing: 0.5px;
        display: none; 
        align-items: center;
        gap: 8px;
    `;

  // Visual feedback for Mouse/Magic Remote
  btn.onmouseenter = () => {
    btn.style.transform = 'translateX(-50%) scale(1.05)';
    btn.style.boxShadow = `0 6px 20px ${color}99`;
    btn.style.background = hoverColor;
  };
  btn.onmouseleave = () => {
    btn.style.transform = 'translateX(-50%) scale(1)';
    btn.style.boxShadow = `0 4px 15px ${color}66`;
    btn.style.background = color;
  };

  // Visual feedback for D-Pad Focus
  btn.onfocus = () => {
    btn.style.borderColor = '#FFF';
    btn.style.transform = 'translateX(-50%) scale(1.1)';
    btn.style.boxShadow = `0 0 0 4px rgba(255,255,255,0.5)`;
  };
  btn.onblur = () => {
    btn.style.borderColor = 'transparent';
    btn.style.transform = 'translateX(-50%) scale(1)';
    btn.style.boxShadow = `0 4px 15px ${color}66`;
  };
}

// Helper: load an image as ArrayBuffer
async function loadImageAsArrayBuffer(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to load image: ' + url);

  // response.bytes() is not supported on webOS browsers yet.
  // FIX: Use arrayBuffer() and convert to Uint8Array.
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

// Set the custom icon for the position tracker
async function setPositionTrackerImage(imageUrl: string, scale = 1.0) {
  try {
    const imageData = await loadImageAsArrayBuffer(imageUrl);
    MapSceneObject.customizeDefPositionTracker(Array.from(imageData), SceneObjectFileFormat.tex);
    const positionTracker = MapSceneObject.getDefPositionTracker();
    positionTracker.scale = scale;
  } catch (e) {
    showMessage('Failed to set custom position icon: ' + e);
  }
}
window.addEventListener('DOMContentLoaded', async () => {
  let gemKit;
  try {
    gemKit = await GemKit.initialize(GEMKIT_TOKEN);
  } catch (e) {
    showMessage('Failed to initialize GemKit: ' + e, 10000);
    return;
  }
  await PositionService.instance;

  const container = document.getElementById('map-container');
  if (!container) throw new Error('Map container not found');

  const viewId = 2;
  const wrapper = gemKit.createView(viewId, async (gemMap: GemMap) => {
    map = gemMap;
    await setPositionTrackerImage('./navArrow.png', 1.0);
    registerRouteTapCallback();
  });
  if (wrapper) container.appendChild(wrapper);

  // --- UI Creation ---

  // Build Route button
  buildRouteBtn = document.createElement('button');
  buildRouteBtn.innerHTML = `${ICONS.route} Build Route`;
  // IMPORTANT: tabindex="0" makes it focusable by Remote D-Pad
  buildRouteBtn.setAttribute('tabindex', '0');
  styleButton(buildRouteBtn, '#673ab7', '#7e57c2');
  buildRouteBtn.onclick = () => onBuildRouteButtonPressed();
  document.body.appendChild(buildRouteBtn);

  // Start Simulation button
  startSimBtn = document.createElement('button');
  startSimBtn.innerHTML = `${ICONS.play} Start Simulation`;
  startSimBtn.setAttribute('tabindex', '0');
  styleButton(startSimBtn, '#4caf50', '#66bb6a');
  startSimBtn.onclick = () => startSimulation();
  document.body.appendChild(startSimBtn);

  // Stop Simulation button
  stopSimBtn = document.createElement('button');
  stopSimBtn.innerHTML = `${ICONS.stop} Stop Simulation`;
  stopSimBtn.setAttribute('tabindex', '0');
  styleButton(stopSimBtn, '#f44336', '#ef5350');
  stopSimBtn.onclick = () => stopSimulation();
  document.body.appendChild(stopSimBtn);

  updateUI();

  // --- webOS Key Handlers ---
  window.addEventListener('keydown', (event) => {
    // Handle 'Back' button
    if (event.keyCode === BACK_KEY_CODE) {
      if (window.webOS) {
        window.webOS.platformBack();
      }
    }

    // Handle 'OK/Enter' button on focused elements
    if (event.keyCode === ENTER_KEY_CODE) {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && activeElement.tagName === 'BUTTON') {
        activeElement.click();
      }
    }
  });
});

function updateUI() {
  const showBuild = !routingHandler && !areRoutesBuilt;
  const showStart = !isSimulationActive && areRoutesBuilt;
  const showStop = isSimulationActive;

  buildRouteBtn.style.display = showBuild ? 'flex' : 'none';
  startSimBtn.style.display = showStart ? 'flex' : 'none';
  stopSimBtn.style.display = showStop ? 'flex' : 'none';

  // Auto-focus logic for Remote:
  // When a button appears, we should focus it so the user doesn't have to hunt for it
  if (showBuild) setTimeout(() => buildRouteBtn.focus(), 100);
  else if (showStart) setTimeout(() => startSimBtn.focus(), 100);
  else if (showStop) setTimeout(() => stopSimBtn.focus(), 100);

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

function registerRouteTapCallback() {
  if (!map) return;
  map.registerTouchCallback(async (pos: any) => {
    if (isSimulationActive) return;

    await map!.setCursorScreenPosition(pos);
    const selectedRoutes = map!.cursorSelectionRoutes();
    if (selectedRoutes.length > 0) {
      map!.preferences.routes.mainRoute = selectedRoutes[0];
      showMessage('Route selected');
    }
  });
}

function onBuildRouteButtonPressed() {
  if (!map) return;

  // Paris area: Versailles → Disneyland Paris
  const departureLandmark = Landmark.withCoordinates(
    Coordinates.fromLatLong(48.802081763044654, 2.12978950646124) // Versailles
  );
  const destinationLandmark = Landmark.withCoordinates(
    Coordinates.fromLatLong(48.945095985397906, 2.687421307353545) // Disneyland Paris
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
        showMessage('Routes calculated!');
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
        top: 100px; 
        left: 30px; right: 30px; 
        max-width: 500px;
        margin: 0 auto;
        background: #212121; 
        color: #fff; 
        border-radius: 16px; 
        z-index: 2100; 
        padding: 20px; 
        display: flex; 
        align-items: center;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;
    document.body.appendChild(instructionPanel);
  }

  instructionPanel.innerHTML = '';

  const iconDiv = document.createElement('div');
  iconDiv.style.cssText =
    'width: 70px; height: 70px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.1); border-radius: 12px; margin-right: 20px; flex-shrink: 0;';

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
      img.style.cssText = 'width: 50px; height: 50px; filter: invert(1);';
      iconDiv.appendChild(img);
    };
    reader.readAsDataURL(blob);
  }
  instructionPanel.appendChild(iconDiv);

  const infoDiv = document.createElement('div');
  infoDiv.innerHTML = `
    <div style="font-size:32px; font-weight:700; margin-bottom: 6px;">${getFormattedDistanceToNextTurn(instruction)}</div>
    <div style="font-size:20px; font-weight:400; opacity: 0.9; line-height: 1.3;">${instruction.nextStreetName || 'Follow route'}</div>
  `;
  instructionPanel.appendChild(infoDiv);
}

// Modern Bottom Status Bar
function showBottomPanel(instruction: NavigationInstruction) {
  if (!bottomPanel) {
    bottomPanel = document.createElement('div');
    bottomPanel.style.cssText = `
        position: fixed; 
        bottom: 40px; 
        left: 30px; right: 30px;
        max-width: 600px;
        margin: 0 auto;
        height: 80px;
        background: #fff; 
        color: #222; 
        border-radius: 40px; 
        z-index: 2100; 
        box-shadow: 0 5px 20px rgba(0,0,0,0.15); 
        padding: 0 40px; 
        display: flex; 
        align-items: center; 
        justify-content: space-between;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;
    document.body.appendChild(bottomPanel);
  }

  bottomPanel.innerHTML = `
    <div style="text-align:center;">
        <div style="font-size:14px; color:#888; text-transform:uppercase; font-weight:600;">Time</div>
        <div style="font-size:22px; font-weight:700; color:#4caf50;">${getFormattedRemainingDuration(instruction)}</div>
    </div>
    <div style="width:1px; height:40px; background:#eee;"></div>
    <div style="text-align:center;">
        <div style="font-size:14px; color:#888; text-transform:uppercase; font-weight:600;">Arrival</div>
        <div style="font-size:22px; font-weight:700;">${getFormattedETA(instruction)}</div>
    </div>
    <div style="width:1px; height:40px; background:#eee;"></div>
    <div style="text-align:center;">
        <div style="font-size:14px; color:#888; text-transform:uppercase; font-weight:600;">Distance</div>
        <div style="font-size:22px; font-weight:700;">${getFormattedRemainingDistance(instruction)}</div>
    </div>
  `;
}

function showFollowButton() {
  if (followBtn) return;

  followBtn = document.createElement('button');
  followBtn.innerHTML = `${ICONS.navigation} <span style="margin-left:8px;">Recenter</span>`;
  followBtn.setAttribute('tabindex', '0');
  followBtn.style.cssText = `
    position: fixed; 
    bottom: 130px; 
    right: 30px; 
    padding: 15px 25px; 
    background: #fff; 
    color: #333; 
    border: none; 
    border-radius: 50px; 
    font-size: 16px; 
    font-weight: 600; 
    box-shadow: 0 4px 15px rgba(0,0,0,0.15); 
    z-index: 2100; 
    display: flex; 
    align-items: center; 
    cursor: pointer;
    transition: transform 0.2s;
  `;

  followBtn.onclick = () => map?.startFollowingPosition?.();

  // Hover effects (Magic Remote)
  followBtn.onmouseenter = () => (followBtn!.style.transform = 'scale(1.05)');
  followBtn.onmouseleave = () => (followBtn!.style.transform = 'scale(1)');

  // D-Pad Focus effects
  followBtn.onfocus = () =>
    (followBtn!.style.boxShadow = `0 0 0 4px rgba(255,255,255,0.7), 0 4px 15px rgba(0,0,0,0.15)`);
  followBtn.onblur = () => (followBtn!.style.boxShadow = `0 4px 15px rgba(0,0,0,0.15)`);

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
function convertDistance(meters: number): string {
  if (meters >= 1000) {
    const kilometers = meters / 1000;
    return `${kilometers.toFixed(1)} km`;
  } else {
    return `${Math.round(meters)} m`;
  }
}
function convertDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes} min`;
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
