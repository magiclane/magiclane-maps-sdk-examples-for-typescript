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
  TaskHandler,
} from '@magiclane/maps-sdk';
import { GEMKIT_TOKEN, showMessage, ICONS, convertDistance, convertDuration } from '../../shared';

let map1: GemMap | null = null;
let map2: GemMap | null = null;
let routingHandler1: TaskHandler | null = null;
let routingHandler2: TaskHandler | null = null;

// Route label helper (mimics Dart extension)
function getRouteLabel(route: Route): string {
  const td = route.getTimeDistance();
  const totalDistance = td.unrestrictedDistanceM + td.restrictedDistanceM;
  const totalDuration = td.unrestrictedTimeS + td.restrictedTimeS;

  return `${convertDistance(totalDistance)}\n${convertDuration(totalDuration)}`;
}

// Remove all routes from both maps
function removeRoutes() {
  if (routingHandler1) {
    RoutingService.cancelRoute(routingHandler1);
    routingHandler1 = null;
  }
  if (routingHandler2) {
    RoutingService.cancelRoute(routingHandler2);
    routingHandler2 = null;
  }
  if (map1) map1.preferences.routes.clear();
  if (map2) map2.preferences.routes.clear();
}

// Route calculation callback
function onRouteBuiltFinished(err: GemError, routes: Route[] | null, isFirstMap: boolean) {
  if (isFirstMap) routingHandler1 = null;
  else routingHandler2 = null;

  if (err === GemError.success && routes && routes.length > 0) {
    const controller = isFirstMap ? map1 : map2;
    const routesMap = controller?.preferences.routes;
    routes.forEach((route, idx) => {
      routesMap?.add(route, idx === 0, { label: getRouteLabel(route) });
    });
    controller?.centerOnRoutes({ routes });
  }
}

// Build route for a map
function onBuildRouteButtonPressed(isFirstMap: boolean) {
  const waypoints: Landmark[] = [];
  if (isFirstMap) {
    waypoints.push(Landmark.withLatLng({ latitude: 37.77903, longitude: -122.41991 }));
    waypoints.push(Landmark.withLatLng({ latitude: 37.33619, longitude: -121.89058 }));
  } else {
    waypoints.push(Landmark.withLatLng({ latitude: 51.50732, longitude: -0.12765 }));
    waypoints.push(Landmark.withLatLng({ latitude: 51.27483, longitude: 0.52316 }));
  }
  const routePreferences = new RoutePreferences();

  showMessage(
    isFirstMap ? 'The first route is calculating.' : 'The second route is calculating.',
    2000
  );

  if (isFirstMap) {
    routingHandler1 = RoutingService.calculateRoute(
      waypoints,
      routePreferences,
      (err: GemError, routes: Route[] | null) => onRouteBuiltFinished(err, routes, true)
    );
  } else {
    routingHandler2 = RoutingService.calculateRoute(
      waypoints,
      routePreferences,
      (err: GemError, routes: Route[] | null) => onRouteBuiltFinished(err, routes, false)
    );
  }
}

// Map 1 created callback
function onMap1Created(gemMap: GemMap) {
  map1 = gemMap;
}

// Map 2 created callback
function onMap2Created(gemMap: GemMap) {
  map2 = gemMap;
}

// UI setup
function setupUI() {
  // Modern App Bar
  const appBar = document.createElement('div');
  appBar.style.cssText = `
    width: 100vw; 
    height: 64px; 
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
    color: #fff;
    display: flex; 
    align-items: center; 
    padding: 0 24px; 
    font-size: 1.2em; 
    font-weight: 600; 
    position: fixed; 
    top: 0; 
    left: 0; 
    z-index: 2000;
    box-shadow: 0 4px 20px rgba(102, 126, 234, 0.3);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    letter-spacing: 0.5px;
  `;

  // Left section with clear routes button and title
  const leftSection = document.createElement('div');
  leftSection.style.cssText = 'display: flex; align-items: center; gap: 16px;';

  const clearBtn = document.createElement('button');
  clearBtn.id = 'removeRoutesBtn';
  clearBtn.innerHTML = ICONS.close;
  clearBtn.title = 'Clear All Routes';
  clearBtn.style.cssText = `
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: #fff;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  `;
  clearBtn.onmouseenter = () => {
    clearBtn.style.background = 'rgba(255, 255, 255, 0.3)';
    clearBtn.style.transform = 'scale(1.1)';
  };
  clearBtn.onmouseleave = () => {
    clearBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    clearBtn.style.transform = 'scale(1)';
  };

  const title = document.createElement('span');
  title.textContent = 'Multi Map Routing';

  leftSection.appendChild(clearBtn);
  leftSection.appendChild(title);

  // Right section with map route buttons, now grouped next to title
  const rightSection = document.createElement('div');
  rightSection.style.cssText = 'display: flex; align-items: center; gap: 12px; margin-left: 32px;';

  const createMapButton = (id: string, label: string) => {
    const btn = document.createElement('button');
    btn.id = id;
    btn.innerHTML = `${ICONS.route} ${label}`;
    btn.style.cssText = `
      background: rgba(255, 255, 255, 0.2);
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
      font-family: inherit;
    `;
    btn.onmouseenter = () => {
      btn.style.background = 'rgba(255, 255, 255, 0.3)';
      btn.style.transform = 'translateY(-2px)';
    };
    btn.onmouseleave = () => {
      btn.style.background = 'rgba(255, 255, 255, 0.2)';
      btn.style.transform = 'translateY(0)';
    };
    return btn;
  };

  const route1Btn = createMapButton('buildRoute1Btn', 'Route 1');
  const route2Btn = createMapButton('buildRoute2Btn', 'Route 2');

  rightSection.appendChild(route1Btn);
  rightSection.appendChild(route2Btn);

  // App bar: leftSection + rightSection (no spacer)
  appBar.appendChild(leftSection);
  appBar.appendChild(rightSection);
  document.body.appendChild(appBar);

  // Button handlers
  (document.getElementById('removeRoutesBtn') as HTMLButtonElement).onclick = removeRoutes;
  (document.getElementById('buildRoute1Btn') as HTMLButtonElement).onclick = () =>
    onBuildRouteButtonPressed(true);
  (document.getElementById('buildRoute2Btn') as HTMLButtonElement).onclick = () =>
    onBuildRouteButtonPressed(false);

  // Layout for two maps side by side with modern spacing
  const main = document.createElement('div');
  main.style.cssText = `
    position: absolute; 
    top: 64px; 
    left: 0; 
    width: 100vw; 
    height: calc(100vh - 64px);
    display: flex; 
    flex-direction: row;
    gap: 12px;
    padding: 12px;
    background: #f5f5f5;
    box-sizing: border-box;
  `;

  const map1Container = document.createElement('div');
  map1Container.id = 'map1-container';
  map1Container.style.cssText = `
    flex: 1; 
    position: relative;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    border-radius: 16px; 
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    background: #fff;
  `;

  const map2Container = document.createElement('div');
  map2Container.id = 'map2-container';
  map2Container.style.cssText = `
    flex: 1; 
    position: relative;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    border-radius: 16px; 
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    background: #fff;
  `;

  main.appendChild(map1Container);
  main.appendChild(map2Container);
  document.body.appendChild(main);

  // Add global CSS to force all children of map containers to fill parent
  const style = document.createElement('style');
  style.textContent = `
    #map1-container > *, #map2-container > * {
      width: 100% !important;
      height: 100% !important;
      position: absolute !important;
      top: 0; left: 0;
      border-radius: 16px;
    }
    #map1-container canvas, #map2Container canvas {
      width: 100% !important;
      height: 100% !important;
      display: block;
      border-radius: 16px;
    }
  `;
  document.head.appendChild(style);
}

// Main entry
window.addEventListener('DOMContentLoaded', async () => {
  setupUI();

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

  // Map 1
  const map1Container = document.getElementById('map1-container');
  if (!map1Container) throw new Error('Map 1 container not found');
  const wrapper1 = gemKit.createView(7, (gemMap: GemMap) => onMap1Created(gemMap));
  if (wrapper1) map1Container.appendChild(wrapper1);

  // Map 2
  const map2Container = document.getElementById('map2-container');
  if (!map2Container) throw new Error('Map 2 container not found');
  const wrapper2 = gemKit.createView(8, (gemMap: GemMap) => onMap2Created(gemMap));
  if (wrapper2) map2Container.appendChild(wrapper2);
});
