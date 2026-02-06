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
  SearchService,
  HighlightRenderSettings,
  HighlightOptions,
  TaskHandler,
  GemIcon,
  AddressField,
} from '@magiclane/maps-sdk';
import { GEMKIT_TOKEN, showMessage, ICONS, convertDistance, convertDuration } from '../../shared';

let map: GemMap | null = null;
let routingHandler: TaskHandler | null = null;
let navigationHandler: TaskHandler | null = null;
let routes: Route[] | null = null;
let isSimulationActive = false;
let areRoutesBuilt = false;

// UI Elements
let controlsDiv: HTMLDivElement;
let buildRouteBtn: HTMLButtonElement;
let cancelRouteBtn: HTMLButtonElement;
let clearRoutesBtn: HTMLButtonElement;
let searchBtn: HTMLButtonElement;
let startSimBtn: HTMLButtonElement;
let stopSimBtn: HTMLButtonElement;
let searchResultsPanel: HTMLDivElement;

function updateUI() {
  buildRouteBtn.style.display = 'none';
  cancelRouteBtn.style.display = 'none';
  clearRoutesBtn.style.display = 'none';
  searchBtn.style.display = 'none';
  startSimBtn.style.display = 'none';
  stopSimBtn.style.display = 'none';

  if (!routingHandler && !areRoutesBuilt) {
    // State 1: Idle
    buildRouteBtn.style.display = 'flex';
  } else if (routingHandler && !areRoutesBuilt) {
    // State 2: Calculating
    cancelRouteBtn.style.display = 'flex';
  } else if (areRoutesBuilt && !routingHandler && !isSimulationActive) {
    // State 3: Route Built (Actions available)
    searchBtn.style.display = 'flex';
    startSimBtn.style.display = 'flex';
    clearRoutesBtn.style.display = 'flex';
  } else if (isSimulationActive) {
    // State 4: Simulating
    stopSimBtn.style.display = 'flex';
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
  const wrapper = gemKit.createView(viewId, (gemMap: GemMap) => {
    map = gemMap;
  });
  if (wrapper) container.appendChild(wrapper);

  // --- Controls Container (Fixed Header) ---
  controlsDiv = document.createElement('div');
  controlsDiv.style.cssText = `
    position: fixed;
    top: 30px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 12px;
    z-index: 2000;
    align-items: center;
    justify-content: center;
  `;
  document.body.appendChild(controlsDiv);

  // Build Route button
  buildRouteBtn = document.createElement('button');
  buildRouteBtn.innerHTML = `${ICONS.route} Build Route`;
  buildRouteBtn.className = 'gem-button gem-button-primary';
  buildRouteBtn.onclick = () => onBuildRouteButtonPressed();
  controlsDiv.appendChild(buildRouteBtn);

  // Cancel Route button
  cancelRouteBtn = document.createElement('button');
  cancelRouteBtn.innerHTML = `${ICONS.close} Cancel`;
  cancelRouteBtn.className = 'gem-button gem-button-danger';
  cancelRouteBtn.onclick = () => onCancelRouteButtonPressed();
  controlsDiv.appendChild(cancelRouteBtn);

  // Search Along Route button
  searchBtn = document.createElement('button');
  searchBtn.innerHTML = `${ICONS.search} Search`;
  searchBtn.className = 'gem-button gem-button-info';
  searchBtn.onclick = () => searchAlongRoute();
  controlsDiv.appendChild(searchBtn);

  // Start Simulation button
  startSimBtn = document.createElement('button');
  startSimBtn.innerHTML = `${ICONS.play} Simulate`;
  startSimBtn.className = 'gem-button gem-button-success';
  startSimBtn.onclick = () => startSimulation();
  controlsDiv.appendChild(startSimBtn);

  // Stop Simulation button
  stopSimBtn = document.createElement('button');
  stopSimBtn.innerHTML = `${ICONS.stop} Stop`;
  stopSimBtn.className = 'gem-button gem-button-danger';
  stopSimBtn.onclick = () => stopSimulation();
  controlsDiv.appendChild(stopSimBtn);

  // Clear Routes button (Placed last)
  clearRoutesBtn = document.createElement('button');
  clearRoutesBtn.innerHTML = `${ICONS.trash} Clear`;
  clearRoutesBtn.className = 'gem-button gem-button-warning';
  clearRoutesBtn.onclick = () => onClearRoutesButtonPressed();
  controlsDiv.appendChild(clearRoutesBtn);

  // Initialize Search Results Sidebar
  searchResultsPanel = document.createElement('div');
  searchResultsPanel.style.cssText = `
    position: fixed; top: 0; left: 0; bottom: 0; width: 320px;
    background: #fff; z-index: 1500;
    box-shadow: 4px 0 20px rgba(0,0,0,0.1);
    transform: translateX(-105%);
    transition: transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
    display: flex; flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  `;
  document.body.appendChild(searchResultsPanel);

  updateUI();
});

function onBuildRouteButtonPressed() {
  const departureLandmark = Landmark.withCoordinates(Coordinates.fromLatLong(37.77903, -122.41991));
  const destinationLandmark = Landmark.withCoordinates(
    Coordinates.fromLatLong(37.33619, -121.89058)
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

function onClearRoutesButtonPressed() {
  map?.preferences.routes.clear();
  map?.deactivateHighlight(); // Clear highlights
  routes = null;
  areRoutesBuilt = false;
  isSimulationActive = false;
  closeSearchResults(); // Close sidebar
  updateUI();
}

function onCancelRouteButtonPressed() {
  if (routingHandler) {
    RoutingService.cancelRoute(routingHandler);
    routingHandler = null;
    showMessage('Route calculation cancelled.');
  }
  updateUI();
}

function startSimulation() {
  if (isSimulationActive || !areRoutesBuilt || !routes || !map) return;
  map.preferences.routes.clearAllButMainRoute?.();
  const routesMap = map.preferences.routes;
  if (!routesMap.mainRoute) {
    showMessage('No main route available');
    return;
  }

  navigationHandler = NavigationService.startSimulation(routesMap.mainRoute, undefined, {
    onNavigationInstruction: () => {
      if (!isSimulationActive) {
        isSimulationActive = true;
        updateUI();
      }
    },
    onError: (error: GemError) => {
      isSimulationActive = false;
      onClearRoutesButtonPressed();
      if (error !== GemError.cancel) {
        stopSimulation();
      }
      updateUI();
    },
  });
  map.startFollowingPosition?.();
  isSimulationActive = true;
  updateUI();
  showMessage('Simulation started.');
}

function stopSimulation() {
  if (navigationHandler) {
    NavigationService.cancelNavigation(navigationHandler);
    navigationHandler = null;
  }
  onClearRoutesButtonPressed();
  isSimulationActive = false;
  areRoutesBuilt = false;
  updateUI();
  showMessage('Simulation stopped.');
}

function searchAlongRoute() {
  if (!areRoutesBuilt || !map) return;
  const routesMap = map.preferences.routes;
  if (!routesMap.mainRoute) {
    showMessage('No main route available');
    return;
  }

  showMessage('Searching along route...');

  SearchService.searchAlongRoute({
    route: routesMap.mainRoute,
    onCompleteCallback: (err: GemError, results: Landmark[]) => {
      if (err !== GemError.success) {
        showMessage('No results found.');
        return;
      }
      showMessage(`${results.length} results found.`);
      showSearchResults(results); // New function to display list
    },
  });
}

// --- Search Results UI Logic ---

function showSearchResults(results: Landmark[]) {
  searchResultsPanel.innerHTML = ''; // Clear previous
  searchResultsPanel.style.transform = 'translateX(0)';

  // Header
  const header = document.createElement('div');
  header.style.cssText = `
        padding: 20px;
        background: #f8f9fa;
        border-bottom: 1px solid #eee;
        display: flex; justify-content: space-between; align-items: center;
    `;
  header.innerHTML = `
        <h3 style="margin:0; font-size:18px; color:#333;">Search Results (${results.length})</h3>
        <button id="closeSearchBtn" style="background:none; border:none; cursor:pointer; color:#666; padding:5px;">
            ${ICONS.menuClose}
        </button>
    `;
  searchResultsPanel.appendChild(header);

  // List Container
  const list = document.createElement('div');
  list.style.cssText = `overflow-y: auto; flex: 1; padding: 10px;`;

  results.forEach((landmark) => {
    const item = document.createElement('div');
    item.style.cssText = `
            padding: 12px;
            margin-bottom: 8px;
            background: #fff;
            border-radius: 8px;
            border: 1px solid #eee;
            cursor: pointer;
            transition: all 0.2s;
            display: flex; gap: 12px; align-items: flex-start;
        `;

    // Icon
    const iconDiv = document.createElement('div');
    iconDiv.innerHTML = ICONS.pin;
    iconDiv.style.flexShrink = '0';

    // Text Info
    const infoDiv = document.createElement('div');
    infoDiv.innerHTML = `
            <div style="font-weight: 600; color: #333; font-size: 14px; margin-bottom: 2px;">${landmark.name || 'Unknown Place'}</div>
            <div style="color: #666; font-size: 12px;">${landmark.address?.getField(AddressField.streetName) || 'No Address'}</div>
        `;

    item.appendChild(iconDiv);
    item.appendChild(infoDiv);

    // Hover Effect
    item.onmouseenter = () => (item.style.backgroundColor = '#f5f5f5');
    item.onmouseleave = () => (item.style.backgroundColor = '#fff');

    // Click Action
    item.onclick = () => {
      if (!map) return;
      map.centerOnCoordinates(landmark.coordinates);

      // Highlight logic
      map.deactivateHighlight();
      const highlightSettings = new HighlightRenderSettings({
        options: new Set([HighlightOptions.showLandmark, HighlightOptions.noFading]),
      });

      // Ensure landmark has an icon if missing
      try {
        landmark.setImageFromIcon(GemIcon.searchResultsPin);
      } catch (e) {}

      map.activateHighlight([landmark], { renderSettings: highlightSettings });
    };

    list.appendChild(item);
  });

  searchResultsPanel.appendChild(list);

  // Bind Close Button
  const closeBtn = document.getElementById('closeSearchBtn');
  if (closeBtn) closeBtn.onclick = closeSearchResults;
}

function closeSearchResults() {
  searchResultsPanel.style.transform = 'translateX(-105%)';
  map?.deactivateHighlight();
}

// Helpers
function getRouteLabel(route: Route): string {
  const timeDistance = route.getTimeDistance();
  const totalDistance = timeDistance.unrestrictedDistanceM + timeDistance.restrictedDistanceM;
  const totalDuration = timeDistance.unrestrictedTimeS + timeDistance.restrictedTimeS;
  return `${convertDistance(totalDistance)}\n${convertDuration(totalDuration)}`;
}
