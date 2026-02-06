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
  Landmark,
  Route,
  GemError,
  NavigationService,
  NavigationInstruction,
  Coordinates,
  GemAnimation,
  AnimationType,
  TaskHandler,
  Position,
  NavigationEventType,
} from '@magiclane/maps-sdk';
import {
  GEMKIT_TOKEN,
  ICONS,
  showMessage,
  convertDistance,
  convertDuration,
  initializeSDK,
  createMapView,
  EventListenerManager,
} from '../../shared';

// Event listener manager for proper cleanup
const events = new EventListenerManager();
function getCurrentTime(additionalSeconds = 0): string {
  const now = new Date();
  const updated = new Date(now.getTime() + additionalSeconds * 1000);
  return updated.toTimeString().slice(0, 5);
}

// --- NavigationInstruction helpers ---
function getFormattedDistanceToNextTurn(instr: NavigationInstruction): string {
  const td = instr.timeDistanceToNextTurn;
  const total = td.unrestrictedDistanceM + td.restrictedDistanceM;
  return convertDistance(total);
}
function getFormattedRemainingDistance(instr: NavigationInstruction): string {
  const td = instr.remainingTravelTimeDistance;
  const total = td.unrestrictedDistanceM + td.restrictedDistanceM;
  return convertDistance(total);
}
function getFormattedRemainingDuration(instr: NavigationInstruction): string {
  const td = instr.remainingTravelTimeDistance;
  const total = td.unrestrictedTimeS + td.restrictedTimeS;
  return convertDuration(total);
}
function getFormattedETA(instr: NavigationInstruction): string {
  const td = instr.remainingTravelTimeDistance;
  const total = td.unrestrictedTimeS + td.restrictedTimeS;
  return getCurrentTime(total);
}

// --- Route label helper (from calculate_route.ts) ---
function getRouteLabel(route: Route): string {
  const td = route.getTimeDistance();
  const totalDistance = td.unrestrictedDistanceM + td.restrictedDistanceM;
  const totalDuration = td.unrestrictedTimeS + td.restrictedTimeS;
  return `${convertDistance(totalDistance)}\n${convertDuration(totalDuration)}`;
}

// --- UI State ---
let map: GemMap | null = null;
let routingHandler: TaskHandler | null = null;
let navigationHandler: TaskHandler | null = null;
let routes: Route[] | null = null;
let isNavigationActive = false;
let areRoutesBuilt = false;
let currentInstruction: NavigationInstruction | null = null;
let currentLocation: Coordinates | null = null;
let hasLiveDataSource = false;

// --- UI Elements ---
let buildRouteBtn: HTMLButtonElement;
let startNavBtn: HTMLButtonElement;
let stopNavBtn: HTMLButtonElement;
let followBtn: HTMLButtonElement;
let clearRoutesBtn: HTMLButtonElement;

// --- UI: Navigation Top Panel ---
function showNavigationTopPanel(instr: NavigationInstruction) {
  let panel = document.getElementById('nav-top-panel') as HTMLDivElement;
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'nav-top-panel';
    panel.style.cssText = `
      position: fixed; 
      top: 80px; 
      left: 50%; 
      transform: translateX(-50%);
      max-width: 400px;
      background: rgba(17, 17, 17, 0.95); 
      color: #fff; 
      border-radius: 20px; 
      padding: 16px 24px; 
      z-index: 2100;
      display: flex; 
      flex-direction: row; 
      align-items: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      backdrop-filter: blur(10px);
    `;
    document.body.appendChild(panel);
  }
  panel.innerHTML = `
    <div style="flex:1;">
      <div style="font-size:28px;font-weight:700;margin-bottom:4px;">${getFormattedDistanceToNextTurn(instr)}</div>
      <div style="font-size:18px;font-weight:500;opacity:0.9;">${instr.nextStreetName || 'Continue'}</div>
    </div>
  `;
}

// --- UI: Navigation Bottom Panel ---
function showNavigationBottomPanel(instr: NavigationInstruction) {
  let panel = document.getElementById('nav-bottom-panel') as HTMLDivElement;
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'nav-bottom-panel';
    panel.style.cssText = `
      position: fixed; 
      bottom: 30px; 
      left: 50%; 
      transform: translateX(-50%);
      max-width: 500px;
      background: rgba(255, 255, 255, 0.98); 
      color: #111; 
      border-radius: 20px; 
      padding: 16px 24px; 
      z-index: 2100;
      display: flex; 
      flex-direction: row; 
      align-items: center; 
      justify-content: space-between;
      gap: 24px;
      font-size: 20px; 
      font-weight: 600; 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      backdrop-filter: blur(10px);
    `;
    document.body.appendChild(panel);
  }
  panel.innerHTML = `
    <span style="color:#673ab7;">${getFormattedRemainingDuration(instr)}</span>
    <span style="color:#4caf50;">${getFormattedETA(instr)}</span>
    <span style="color:#2196f3;">${getFormattedRemainingDistance(instr)}</span>
  `;
}

// --- UI: Follow Position Button ---
function showFollowPositionButton(onClick: () => void) {
  let btn = document.getElementById('follow-pos-btn') as HTMLButtonElement;
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'follow-pos-btn';
    btn.style.cssText = `
      position: fixed; 
      bottom: 120px; 
      left: 50%; 
      transform: translateX(-50%);
      padding: 10px 20px;
      background: rgba(255, 255, 255, 0.95); 
      color: #2196f3;
      border-radius: 50px; 
      box-shadow: 0 4px 15px rgba(33, 150, 243, 0.3);
      display: flex; 
      align-items: center; 
      gap: 8px; 
      font-size: 14px; 
      font-weight: 600; 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      z-index: 2100;
      border: none; 
      cursor: pointer;
      backdrop-filter: blur(10px);
      transition: all 0.2s;
    `;
    btn.innerHTML = `${ICONS.location} Recenter`;
    btn.onmouseenter = () => {
      btn.style.transform = 'translateX(-50%) translateY(-2px)';
      btn.style.boxShadow = '0 6px 20px rgba(33, 150, 243, 0.5)';
    };
    btn.onmouseleave = () => {
      btn.style.transform = 'translateX(-50%) translateY(0)';
      btn.style.boxShadow = '0 4px 15px rgba(33, 150, 243, 0.3)';
    };
    btn.onclick = onClick;
    document.body.appendChild(btn);
  }
  btn.style.display = 'flex';
}

// --- UI: Hide/Show Panels ---
function hideNavigationPanels() {
  const top = document.getElementById('nav-top-panel');
  if (top) top.remove();
  const bottom = document.getElementById('nav-bottom-panel');
  if (bottom) bottom.remove();
  const follow = document.getElementById('follow-pos-btn');
  if (follow) follow.style.display = 'none';
}

// --- UI: Update Buttons ---
function updateUI() {
  buildRouteBtn.style.display = !routingHandler && !routes && !areRoutesBuilt ? 'block' : 'none';
  startNavBtn.style.display = !isNavigationActive && areRoutesBuilt ? 'block' : 'none';
  stopNavBtn.style.display = isNavigationActive ? 'block' : 'none';
  followBtn.style.display = !isNavigationActive ? 'block' : 'none';
  clearRoutesBtn.style.display =
    routes && !routingHandler && !isNavigationActive ? 'block' : 'none';

  if (isNavigationActive && currentInstruction) {
    showNavigationTopPanel(currentInstruction);
    showNavigationBottomPanel(currentInstruction);
    showFollowPositionButton(() => map?.startFollowingPosition());
  } else {
    hideNavigationPanels();
  }
}

// --- Route calculation functionality ---
function onBuildRouteButtonPressed() {
  if (!currentLocation) {
    showMessage('Current location is needed to compute the route.');
    return;
  }
  const departureLandmark = Landmark.withCoordinates(currentLocation);
  const destinationLandmark = Landmark.withLatLng({ latitude: 52.51614, longitude: 13.37748 });
  const routePreferences = new RoutePreferences({});
  showMessage('The route is calculating.');

  routingHandler = RoutingService.calculateRoute(
    [departureLandmark, destinationLandmark],
    routePreferences,
    (err: GemError, calculatedRoutes: Route[]) => {
      routingHandler = null;
      if (err === GemError.routeTooLong) {
        showMessage(
          'The destination is too far from your current location. Change the coordinates of the destination.'
        );
        return;
      }
      if (err === GemError.success) {
        const routesMap = map?.preferences.routes;
        calculatedRoutes.forEach((route, index) => {
          const label = getRouteLabel(route);
          routesMap?.add(route, index === 0, { label });
        });
        map?.centerOnRoutes({ routes: calculatedRoutes });
        showMessage('Route calculated successfully!');
        routes = calculatedRoutes;
        areRoutesBuilt = true;
      } else {
        showMessage('Route calculation failed.');
      }
      updateUI();
    }
  );
  updateUI();
}

// --- Start navigation ---
function onStartNavigation() {
  if (!map) return;
  const routesMap = map.preferences.routes;
  if (!routesMap.mainRoute) {
    showMessage('No main route available');
    return;
  }
  navigationHandler = NavigationService.startSimulation(routesMap.mainRoute, undefined, {
    onNavigationInstruction: (
      instruction: NavigationInstruction,
      events: NavigationEventType[]
    ) => {
      isNavigationActive = true;
      currentInstruction = instruction;
      updateUI();
    },
    onError: (error: GemError) => {
      isNavigationActive = false;
      cancelRoute();
      if (error !== GemError.cancel) stopNavigation();
      updateUI();
    },
  });
  map.startFollowingPosition();
  updateUI();
}

// --- Stop navigation ---
function stopNavigation() {
  if (navigationHandler) {
    NavigationService.cancelNavigation(navigationHandler);
    navigationHandler = null;
  }
  cancelRoute();
  isNavigationActive = false;
  updateUI();
}

// --- Cancel route and clear ---
function cancelRoute() {
  if (map) map.preferences.routes.clear();
  if (routingHandler) {
    RoutingService.cancelRoute(routingHandler);
    routingHandler = null;
  }
  routes = null;
  areRoutesBuilt = false;
  updateUI();
}

// --- Follow position ---
function onFollowPositionButtonPressed() {
  if (!hasLiveDataSource) {
    PositionService.instance.setLiveDataSource();
    const sourceType = PositionService.instance.sourceType;
    if (sourceType !== 'live') {
      showMessage(`Position source is not live: ${sourceType}`);
      return;
    }
    hasLiveDataSource = true;
    getCurrentLocation();
  } else {
    currentLocation = PositionService.instance.position?.coordinates || null;
  }
  const animation = new GemAnimation({ type: AnimationType.linear });
  map?.startFollowingPosition({ animation });
  updateUI();
}

// --- Get current location ---
function getCurrentLocation() {
  PositionService.instance.addPositionListener((pos: Position) => {
    currentLocation = pos.coordinates;
  });
  const pos = PositionService.instance.position;
  if (pos && pos.coordinates) {
    currentLocation = pos.coordinates;
  }
}

// --- Helper to apply modern button styles ---
function styleButton(
  btn: HTMLButtonElement,
  color: string,
  hoverColor: string,
  icon: string,
  label: string
) {
  btn.innerHTML = `${icon} ${label}`;
  btn.style.cssText = `
    background: ${color};
    border: none;
    color: #fff;
    padding: 10px 20px;
    border-radius: 50px;
    cursor: pointer;
    font-size: 0.9em;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    box-shadow: 0 4px 15px ${color}66;
    letter-spacing: 0.5px;
  `;
  btn.onmouseenter = () => {
    btn.style.transform = 'translateY(-2px)';
    btn.style.boxShadow = `0 6px 20px ${color}99`;
    btn.style.background = hoverColor;
  };
  btn.onmouseleave = () => {
    btn.style.transform = 'translateY(0)';
    btn.style.boxShadow = `0 4px 15px ${color}66`;
    btn.style.background = color;
  };
  btn.onmousedown = () => {
    btn.style.transform = 'translateY(1px)';
  };
}

// --- Main entry ---
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
  const viewId = 9;
  const wrapper = createMapView(gemKit, container, viewId, (gemMap: GemMap) => {
    map = gemMap;
    getCurrentLocation();
  });

  if (!wrapper) {
    console.error('Failed to create map view');
    return;
  }

  // Create an app bar for buttons
  const appBar = document.createElement('div');
  appBar.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 64px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 0 24px;
    z-index: 2000;
    box-shadow: 0 4px 20px rgba(102, 126, 234, 0.3);
  `;
  document.body.appendChild(appBar);

  // Build Route button
  buildRouteBtn = document.createElement('button');
  styleButton(buildRouteBtn, '#673ab7', '#7e57c2', ICONS.route, 'Build Route');
  buildRouteBtn.onclick = () => onBuildRouteButtonPressed();
  appBar.appendChild(buildRouteBtn);

  // Start Navigation button
  startNavBtn = document.createElement('button');
  styleButton(startNavBtn, '#4caf50', '#66bb6a', ICONS.navigation, 'Start Navigation');
  startNavBtn.style.display = 'none';
  startNavBtn.onclick = () => onStartNavigation();
  appBar.appendChild(startNavBtn);

  // Stop Navigation button
  stopNavBtn = document.createElement('button');
  styleButton(stopNavBtn, '#f44336', '#ef5350', ICONS.stop, 'Stop Navigation');
  stopNavBtn.style.display = 'none';
  stopNavBtn.onclick = () => stopNavigation();
  appBar.appendChild(stopNavBtn);

  // Follow Position button
  followBtn = document.createElement('button');
  styleButton(followBtn, '#2196f3', '#42a5f5', ICONS.location, 'Follow Position');
  followBtn.onclick = () => onFollowPositionButtonPressed();
  appBar.appendChild(followBtn);

  // Clear Routes button
  clearRoutesBtn = document.createElement('button');
  styleButton(clearRoutesBtn, '#ff9800', '#ffa726', ICONS.clear, 'Clear Routes');
  clearRoutesBtn.style.display = 'none';
  clearRoutesBtn.onclick = () => cancelRoute();
  appBar.appendChild(clearRoutesBtn);

  updateUI();

  // Register cleanup on page unload
  events.add(window, 'beforeunload', () => {
    events.cleanup();
  });
});
