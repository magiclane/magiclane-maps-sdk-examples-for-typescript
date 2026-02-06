// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

import {
  GemKit,
  GemMap,
  Coordinates,
  PositionService,
  DataSource,
  DataType,
  SenseDataFactory,
  Provider,
  PositionQuality,
  GemAnimation,
  AnimationType,
  Landmark,
  RoutePreferences,
  RoutingService,
  GemError,
  Route,
  NavigationService,
  NavigationInstruction,
  TaskHandler,
  NavigationEventType,
} from '@magiclane/maps-sdk';
import {
  GEMKIT_TOKEN,
  showMessage,
  ICONS,
  styleButton,
  convertDistance,
  convertDuration,
} from '../../shared';

// Turn icon (not in shared ICONS - specific to navigation)
const TURN_ICON = `<svg xmlns="http://www.w3.org/2000/svg" height="30" viewBox="0 0 24 24" width="30" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v3.17l2.59-2.58L15 10l-4 4z"/></svg>`;

let map: GemMap | null = null;
let dataSource: DataSource | null = null;
let currentInstruction: NavigationInstruction | null = null;
let areRoutesBuilt = false;
let isNavigationActive = false;
let hasDataSource = false;
let routingHandler: TaskHandler | null = null;
let navigationHandler: TaskHandler | null = null;

// UI Elements
let buildRouteBtn: HTMLButtonElement;
let startNavBtn: HTMLButtonElement;
let stopNavBtn: HTMLButtonElement;
let followBtn: HTMLButtonElement;

// Navigation panels
let instructionPanel: HTMLDivElement;
let bottomPanel: HTMLDivElement;

function updateNavigationPanels() {
  if (!currentInstruction) return;

  // Instruction panel (Top Left Glass Card)
  if (!instructionPanel) {
    instructionPanel = document.createElement('div');
    instructionPanel.style.cssText = `
      position: fixed; 
      top: 90px; 
      left: 20px; 
      z-index: 2000;
      background: rgba(34, 34, 34, 0.95); 
      color: #fff; 
      border-radius: 20px; 
      padding: 20px; 
      width: 320px; 
      display: flex; 
      align-items: center;
      box-shadow: 0 8px 30px rgba(0,0,0,0.3);
      backdrop-filter: blur(10px);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;
    document.body.appendChild(instructionPanel);
  }

  instructionPanel.innerHTML = `
    <div style="margin-right: 20px; display: flex; align-items: center; justify-content: center; width: 50px; height: 50px; background: rgba(255,255,255,0.1); border-radius: 50%;">
      ${TURN_ICON}
    </div>
    <div style="flex: 1;">
      <div style="font-size: 28px; font-weight: 700; margin-bottom: 4px;">
        ${currentInstruction.timeDistanceToNextTurn ? convertDistance(currentInstruction.timeDistanceToNextTurn.unrestrictedDistanceM + currentInstruction.timeDistanceToNextTurn.restrictedDistanceM) : ''}
      </div>
      <div style="font-size: 16px; font-weight: 500; opacity: 0.9; line-height: 1.3;">
        ${currentInstruction.nextStreetName || 'Continue'}
      </div>
    </div>
  `;

  // Bottom panel (Floating Pill)
  if (!bottomPanel) {
    bottomPanel = document.createElement('div');
    bottomPanel.style.cssText = `
      position: fixed; 
      bottom: 40px; 
      left: 50%; 
      transform: translateX(-50%);
      z-index: 2000;
      background: rgba(255, 255, 255, 0.95); 
      color: #333;
      border-radius: 50px; 
      box-shadow: 0 6px 25px rgba(0,0,0,0.2);
      padding: 12px 30px; 
      display: flex; 
      align-items: center; 
      justify-content: space-between;
      gap: 30px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      backdrop-filter: blur(10px);
    `;
    document.body.appendChild(bottomPanel);
  }

  const timeDistance = currentInstruction.remainingTravelTimeDistance;
  const duration = timeDistance
    ? convertDuration(timeDistance.unrestrictedTimeS + timeDistance.restrictedTimeS)
    : '--';
  const distance = timeDistance
    ? convertDistance(timeDistance.unrestrictedDistanceM + timeDistance.restrictedDistanceM)
    : '--';
  const eta = timeDistance
    ? getETA(timeDistance.unrestrictedTimeS + timeDistance.restrictedTimeS)
    : '--';

  bottomPanel.innerHTML = `
    <div style="text-align: center;">
      <div style="font-size: 18px; font-weight: 700;">${duration}</div>
      <div style="font-size: 11px; text-transform: uppercase; color: #666; font-weight: 600;">Time</div>
    </div>
    <div style="width: 1px; height: 24px; background: #ddd;"></div>
    <div style="text-align: center;">
      <div style="font-size: 18px; font-weight: 700;">${eta}</div>
      <div style="font-size: 11px; text-transform: uppercase; color: #666; font-weight: 600;">ETA</div>
    </div>
    <div style="width: 1px; height: 24px; background: #ddd;"></div>
    <div style="text-align: center;">
      <div style="font-size: 18px; font-weight: 700;">${distance}</div>
      <div style="font-size: 11px; text-transform: uppercase; color: #666; font-weight: 600;">Dist</div>
    </div>
  `;

  instructionPanel.style.display = isNavigationActive ? 'flex' : 'none';
  bottomPanel.style.display = isNavigationActive ? 'flex' : 'none';
}

function getETA(seconds: number): string {
  const now = new Date();
  const etaTime = new Date(now.getTime() + seconds * 1000);
  return etaTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function updateUI() {
  // Hide all main buttons first
  buildRouteBtn.style.display = 'none';
  startNavBtn.style.display = 'none';
  stopNavBtn.style.display = 'none';

  if (!areRoutesBuilt) {
    buildRouteBtn.style.display = 'flex';
  } else if (areRoutesBuilt && !isNavigationActive) {
    startNavBtn.style.display = 'flex';
  } else if (isNavigationActive) {
    stopNavBtn.style.display = 'flex';
  }
}

function onMapCreated(gemMap: GemMap) {
  map = gemMap;
  dataSource = DataSource.createExternalDataSource([DataType.position]);
}

// Helper function to create map label for routes (replaces Dart extension)
function getRouteMapLabel(route: Route): string {
  const timeDistance = route.getTimeDistance();
  const totalDistance = timeDistance.unrestrictedDistanceM + timeDistance.restrictedDistanceM;
  const totalDuration = timeDistance.unrestrictedTimeS + timeDistance.restrictedTimeS;

  return `${convertDistance(totalDistance)} \n${convertDuration(totalDuration)}`;
}

function onBuildRouteButtonPressed() {
  if (!map) return;

  // Define the departure and destination
  const departureLandmark = Landmark.withLatLng({
    latitude: 34.915646,
    longitude: -110.147933,
  });
  const destinationLandmark = Landmark.withLatLng({
    latitude: 34.933105,
    longitude: -110.131363,
  });

  const routePreferences = new RoutePreferences({});
  showMessage('The route is calculating.');

  routingHandler = RoutingService.calculateRoute(
    [departureLandmark, destinationLandmark],
    routePreferences,
    (err: GemError, routes: Route[]) => {
      routingHandler = null;
      if (err === GemError.routeTooLong) {
        showMessage('Destination is too far.');
        return;
      }
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
  updateUI();
}

async function startNavigation() {
  if (!map) return;
  const routes = map.preferences.routes;
  if (!routes.mainRoute) {
    showMessage('Route is not available');
    return;
  }

  navigationHandler = NavigationService.startNavigation(routes.mainRoute, undefined, {
    onNavigationInstruction: (
      instruction: NavigationInstruction,
      events: NavigationEventType[]
    ) => {
      isNavigationActive = true;
      currentInstruction = instruction;
      updateNavigationPanels();
    },
    onError: (error: GemError) => {
      PositionService.instance.removeDataSource();
      dataSource!.stop();
      isNavigationActive = false;
      cancelRoute();
      if (error !== GemError.cancel) stopNavigation();
    },
    onDestinationReached: (landmark: Landmark) => {
      PositionService.instance.removeDataSource();
      dataSource!.stop();
      isNavigationActive = false;
      cancelRoute();
      stopNavigation();
    },
  });
  map.startFollowingPosition();
  await pushExternalPosition();
}

async function pushExternalPosition() {
  const route = map!.preferences.routes.mainRoute;
  if (!route) return;
  const timeDistance = route.getTimeDistance();
  const distance = timeDistance.totalDistanceM;
  let prevCoordinates = route.getCoordinateOnRoute(0);

  for (let currentDistance = 1; currentDistance <= distance; currentDistance += 1) {
    if (!hasDataSource) return;
    if (currentDistance === distance) {
      stopNavigation();
      return;
    }
    const currentCoordinates = route.getCoordinateOnRoute(currentDistance);
    await new Promise((res) => setTimeout(res, 25));
    dataSource!.pushData(
      SenseDataFactory.producePosition({
        acquisitionTime: new Date(),
        satelliteTime: new Date(),
        latitude: currentCoordinates.latitude,
        longitude: currentCoordinates.longitude,
        altitude: 0,
        course: getHeading(prevCoordinates, currentCoordinates),
        speed: 0,
        provider: Provider.gps,
        fixQuality: PositionQuality.high,
      })
    );
    prevCoordinates = currentCoordinates;
  }
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

function stopNavigation() {
  if (navigationHandler) {
    NavigationService.cancelNavigation(navigationHandler);
    navigationHandler = null;
  }
  PositionService.instance.removeDataSource();
  dataSource!.stop();
  cancelRoute();
  isNavigationActive = false;
  hasDataSource = false;
  updateUI();
  updateNavigationPanels();
}

function onFollowPositionButtonPressed() {
  if (!hasDataSource) {
    PositionService.instance.setExternalDataSource(dataSource!);
    dataSource!.start();
    dataSource!.pushData(
      SenseDataFactory.producePosition({
        acquisitionTime: new Date(),
        satelliteTime: new Date(),
        latitude: 38.029467,
        longitude: -117.884985,
        altitude: 0,
        course: 0,
        speed: 0,
        provider: Provider.gps,
        fixQuality: PositionQuality.high,
      })
    );
    hasDataSource = true;
    showMessage('Simulating GPS Position...');
  }
  const animation = new GemAnimation({ type: AnimationType.linear });
  map!.startFollowingPosition({ animation });
  updateUI();
}

function getHeading(from: Coordinates, to: Coordinates): number {
  const dx = to.longitude - from.longitude;
  const dy = to.latitude - from.latitude;
  const val = Math.atan2(dx, dy) * 57.2957795;
  return val < 0 ? val + 360 : val;
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

  // Build Route button
  buildRouteBtn = document.createElement('button');
  buildRouteBtn.innerHTML = `${ICONS.directions} Build Route`;
  buildRouteBtn.className = 'gem-button gem-button-primary gem-button-center';
  styleButton(buildRouteBtn, '#673ab7', '#7e57c2');
  buildRouteBtn.onclick = onBuildRouteButtonPressed;
  document.body.appendChild(buildRouteBtn);

  // Start Navigation button
  startNavBtn = document.createElement('button');
  startNavBtn.innerHTML = `${ICONS.navigation} Start Navigation`;
  startNavBtn.className = 'gem-button gem-button-success gem-button-center';
  styleButton(startNavBtn, '#4caf50', '#66bb6a');
  startNavBtn.onclick = startNavigation;
  document.body.appendChild(startNavBtn);

  // Stop Navigation button
  stopNavBtn = document.createElement('button');
  stopNavBtn.innerHTML = `${ICONS.stop} Stop Navigation`;
  stopNavBtn.className = 'gem-button gem-button-danger gem-button-center';
  styleButton(stopNavBtn, '#f44336', '#ef5350');
  stopNavBtn.onclick = stopNavigation;
  document.body.appendChild(stopNavBtn);

  // Follow Position button (Top Right Configuration)
  followBtn = document.createElement('button');
  followBtn.innerHTML = `${ICONS.myLocation} Follow Position`;
  followBtn.className = 'gem-button gem-button-secondary';
  styleButton(followBtn, '#fff', '#f5f5f5', {
    top: '30px',
    left: 'auto',
    transform: 'none',
    additionalStyles: { right: '20px', color: '#333' },
  });
  followBtn.onclick = onFollowPositionButtonPressed;
  document.body.appendChild(followBtn);

  updateUI();
});
