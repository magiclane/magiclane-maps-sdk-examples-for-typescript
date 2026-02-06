// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

import {
  GemKit,
  GemMap,
  Landmark,
  RoutePreferences,
  RoutingService,
  NavigationService,
  SearchService,
  AlarmService,
  AlarmListener,
  GemError,
  Route,
  Coordinates,
  RectangleGeographicArea,
  SearchPreferences,
  RouteRenderOptions,
  TaskHandler,
  RouteRenderSettings,
  NavigationInstruction,
  NavigationEventType,
} from '@magiclane/maps-sdk';
import { GEMKIT_TOKEN, showMessage, ICONS, styleButton } from '../../shared';

// Custom warning icon with red fill for hazard indication
const WARNING_ICON_RED = `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="#f44336"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`;

// Type definitions
type OverlayItemAlarmsList = {
  items: OverlayItemPosition[];
};
type OverlayItemPosition = {
  distance: number;
  overlayItem: {
    img: {
      isValid: boolean;
      getRenderableImageBytes(): Uint8Array | null;
    };
  };
};

let map: GemMap | null = null;
let areRoutesBuilt = false;
let isSimulationActive = false;

// Route calculation and navigation handlers
let routingHandler: TaskHandler | null = null;
let navigationHandler: TaskHandler | null = null;
let alarmService: AlarmService | null = null;
let alarmListener: AlarmListener | null = null;

// The closest alarm
let closestOverlayItem: OverlayItemPosition | null = null;

// UI Elements
let controlsDiv: HTMLDivElement;
let playBtn: HTMLButtonElement;
let stopBtn: HTMLButtonElement;
let buildRouteBtn: HTMLButtonElement;
let alarmPanel: HTMLDivElement;
let followBtn: HTMLButtonElement | null = null;

// Update the bottom alarm panel with current overlay item
function updateBottomAlarmPanel() {
  if (!closestOverlayItem) {
    alarmPanel.style.display = 'none';
    return;
  }

  alarmPanel.innerHTML = '';
  alarmPanel.style.display = 'flex';

  // Icon/Image Section
  const iconDiv = document.createElement('div');
  iconDiv.style.cssText = `
    width: 48px; height: 48px; border-radius: 8px; background: #fce4ec;
    display: flex; align-items: center; justify-content: center; margin-right: 16px;
    overflow: hidden; flex-shrink: 0;
  `;

  if (closestOverlayItem.overlayItem.img.isValid) {
    const imageBytes = closestOverlayItem.overlayItem.img.getRenderableImageBytes();
    if (imageBytes) {
      const img = document.createElement('img');
      const blob = new Blob([imageBytes]);
      img.src = URL.createObjectURL(blob);
      img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
      iconDiv.appendChild(img);
    } else {
      iconDiv.innerHTML = WARNING_ICON_RED;
    }
  } else {
    iconDiv.innerHTML = WARNING_ICON_RED;
  }

  // Text Section
  const textDiv = document.createElement('div');
  textDiv.innerHTML = `
    <div style="font-size: 12px; text-transform: uppercase; color: #888; font-weight: 700;">Hazard Ahead</div>
    <div style="font-size: 20px; font-weight: 700; color: #333;">${closestOverlayItem.distance} m</div>
  `;

  alarmPanel.appendChild(iconDiv);
  alarmPanel.appendChild(textDiv);
}

function updateUI() {
  buildRouteBtn.style.display = !routingHandler && !areRoutesBuilt ? 'flex' : 'none';
  playBtn.style.display = !isSimulationActive && areRoutesBuilt ? 'flex' : 'none';
  stopBtn.style.display = isSimulationActive ? 'flex' : 'none';

  if (closestOverlayItem) {
    updateBottomAlarmPanel();
  } else {
    alarmPanel.style.display = 'none';
  }

  if (isSimulationActive) showFollowButton();
  else if (followBtn) (followBtn.remove(), (followBtn = null));
}

// Initialization
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

  const container = document.getElementById('map-container');
  if (!container) throw new Error('Map container not found');

  const viewId = 3;
  const wrapper = gemKit.createView(viewId, (gemMap: GemMap) => {
    map = gemMap;
  });
  if (wrapper) container.appendChild(wrapper);

  // --- Controls Container (Fixed Header) ---
  controlsDiv = document.createElement('div');
  controlsDiv.style.cssText = `
    position: fixed; top: 30px; left: 50%; transform: translateX(-50%);
    display: flex; gap: 12px; z-index: 2000; align-items: center; justify-content: center;
  `;
  document.body.appendChild(controlsDiv);

  // Build Route
  buildRouteBtn = document.createElement('button');
  buildRouteBtn.innerHTML = `${ICONS.route} Build Route`;
  styleButton(buildRouteBtn, '#673ab7', '#7e57c2', {
    position: 'relative',
    top: 'auto',
    left: 'auto',
    transform: 'none',
  });
  buildRouteBtn.onclick = onBuildRouteButtonPressed;
  controlsDiv.appendChild(buildRouteBtn);

  // Play
  playBtn = document.createElement('button');
  playBtn.innerHTML = `${ICONS.play} Start Simulation`;
  styleButton(playBtn, '#4caf50', '#66bb6a', {
    position: 'relative',
    top: 'auto',
    left: 'auto',
    transform: 'none',
  });
  playBtn.onclick = startSimulation;
  controlsDiv.appendChild(playBtn);

  // Stop
  stopBtn = document.createElement('button');
  stopBtn.innerHTML = `${ICONS.stop} Stop`;
  styleButton(stopBtn, '#f44336', '#ef5350', {
    position: 'relative',
    top: 'auto',
    left: 'auto',
    transform: 'none',
  });
  stopBtn.onclick = stopSimulation;
  controlsDiv.appendChild(stopBtn);

  // Alarm Panel (Floating Card)
  alarmPanel = document.createElement('div');
  alarmPanel.style.cssText = `
    position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%);
    z-index: 2000; display: none; background: white;
    padding: 16px 24px; border-radius: 16px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    align-items: center; min-width: 200px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    animation: popUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  `;

  const style = document.createElement('style');
  style.innerHTML = `@keyframes popUp { from { transform: translateX(-50%) scale(0.8); opacity: 0; } to { transform: translateX(-50%) scale(1); opacity: 1; } }`;
  document.head.appendChild(style);

  document.body.appendChild(alarmPanel);

  updateUI();
});

// Logic functions (Preserved)

async function onBuildRouteButtonPressed() {
  showMessage('Calculating route with reports...');

  try {
    const route = await getRouteWithReport();

    if (route) {
      showMessage('Route calculated!');
      const routesMap = map?.preferences.routes;
      const routeRenderSettings = new RouteRenderSettings({
        options: new Set([RouteRenderOptions.showTraffic, RouteRenderOptions.showHighlights]),
      });

      routesMap?.add(route, true, {
        routeRenderSettings: routeRenderSettings,
      });
      map?.centerOnRoute(route);
    } else {
      showMessage('Route calculation failed.');
    }
  } catch (error) {
    console.error('Error in onBuildRouteButtonPressed:', error);
    showMessage('Error computing route.');
  }

  areRoutesBuilt = true;
  updateUI();
}

function startSimulation() {
  const routes = map?.preferences.routes;
  map?.preferences.routes.clearAllButMainRoute();

  if (!routes?.mainRoute) {
    showMessage('No main route available');
    return;
  }

  alarmListener = new AlarmListener({
    onOverlayItemAlarmsUpdated: (alarmsList: OverlayItemAlarmsList) => {
      if (alarmsList.items && alarmsList.items.length > 0) {
        closestOverlayItem = alarmsList.items.reduce((closest, current) =>
          current.distance < closest.distance ? current : closest
        );
        updateUI();
      } else {
        closestOverlayItem = null;
        updateUI();
      }
    },
    onOverlayItemAlarmsPassedOver: () => {
      closestOverlayItem = null;
      updateUI();
    },
  });

  try {
    alarmService = new AlarmService(alarmListener);
    alarmService.alarmDistance = 500;

    navigationHandler = NavigationService.startSimulation(routes.mainRoute, undefined, {
      onNavigationInstruction: (
        instruction: NavigationInstruction,
        events: NavigationEventType[]
      ) => {
        isSimulationActive = true;
        updateUI();
      },
      onDestinationReached: (landmark: Landmark) => {
        stopSimulation();
        cancelRoute();
        showMessage('Destination reached');
      },
      onError: (error: GemError) => {
        isSimulationActive = false;
        closestOverlayItem = null;
        cancelRoute();
        updateUI();
        if (error !== GemError.cancel) stopSimulation();
      },
    });

    map?.startFollowingPosition();
    showMessage('Simulation started');
  } catch (error) {
    showMessage('Failed to start simulation');
  }
}

function cancelRoute() {
  map?.preferences.routes.clear();
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
  closestOverlayItem = null;
  updateUI();
  showMessage('Simulation stopped');
}

// Logic to get report from map (Mock/Search logic)
async function getReportFromMap(): Promise<Landmark | null> {
  return new Promise((resolve) => {
    const area = new RectangleGeographicArea({
      topLeft: Coordinates.fromLatLong(52.59310690528571, 7.524257524882292),
      bottomRight: Coordinates.fromLatLong(48.544623829072655, 12.815748995947535),
    });

    const searchPreferences = SearchPreferences.create({
      searchAddresses: false,
      searchMapPOIs: false,
    });

    try {
      SearchService.searchInArea({
        area: area,
        referenceCoordinates: Coordinates.fromLatLong(51.02858483954893, 10.29982567727901),
        onCompleteCallback: (err: GemError, results: Landmark[]) => {
          if (err === GemError.success && results && results.length > 0) {
            resolve(results[0]);
          } else {
            resolve(null);
          }
        },
        preferences: searchPreferences,
      });
    } catch (error) {
      resolve(null);
    }
  });
}

// Route Calculation Logic
async function getRouteWithReport(): Promise<Route | null> {
  const initialStart = Landmark.withCoordinates(
    Coordinates.fromLatLong(51.48345483353617, 6.851883736746337)
  );
  const initialEnd = Landmark.withCoordinates(
    Coordinates.fromLatLong(49.01867442442069, 12.061988113314802)
  );

  const report = await getReportFromMap();

  if (!report) {
    // Fallback simple route
    const start = Landmark.withCoordinates(
      Coordinates.fromLatLong(51.48345483353617, 6.851883736746337)
    );
    const end = Landmark.withCoordinates(Coordinates.fromLatLong(50.1109221, 8.6821267));
    return await calculateRoute([start, end]);
  }

  const initialRoute = await calculateRoute([initialStart, report, initialEnd]);
  if (!initialRoute) return null;

  const reportDistanceInInitialRoute = initialRoute.getDistanceOnRoute(report.coordinates, true);
  const newStartCoords = initialRoute.getCoordinateOnRoute(reportDistanceInInitialRoute - 600);
  const newEndCoords = initialRoute.getCoordinateOnRoute(reportDistanceInInitialRoute + 200);

  const newStart = Landmark.withCoordinates(newStartCoords);
  const newEnd = Landmark.withCoordinates(newEndCoords);

  return await calculateRoute([newStart, report, newEnd, report, newStart]);
}

async function calculateRoute(waypoints: Landmark[]): Promise<Route | null> {
  return new Promise((resolve) => {
    try {
      RoutingService.calculateRoute(
        waypoints,
        new RoutePreferences({}),
        (err: GemError, routes: Route[]) => {
          if (err === GemError.success && routes && routes.length > 0) {
            resolve(routes[0]);
          } else {
            resolve(null);
          }
        }
      );
    } catch (error) {
      resolve(null);
    }
  });
}

// Modern Floating Recenter Button
function showFollowButton() {
  if (followBtn) return;

  followBtn = document.createElement('button');
  followBtn.innerHTML = `${ICONS.navigation} <span style="margin-left:8px;">Recenter</span>`;
  followBtn.style.cssText = `
    position: fixed; 
    bottom: 30px; 
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
