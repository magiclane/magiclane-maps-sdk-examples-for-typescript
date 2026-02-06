// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

import {
  GemKit,
  GemMap,
  PositionService,
  Landmark,
  RoutePreferences,
  RoutingService,
  GemError,
  Route,
  PTRoute,
  PTRouteSegment,
  TransitType,
  RouteTransportMode,
  TaskHandler,
} from '@magiclane/maps-sdk';

// Type for screen position coordinates
interface ScreenPosition {
  x: number;
  y: number;
}

// Type for route segments
interface RouteSegment {
  toPTRouteSegment?: () => PTRouteSegment | null;
}
import { GEMKIT_TOKEN, showMessage, ICONS, convertDistance, convertDuration } from '../../shared';

let map: GemMap | null = null;
let routingHandler: TaskHandler | null = null;
let ptSegments: PTRouteSegment[] | null = null;

// UI Elements
let buildRouteBtn: HTMLButtonElement;
let cancelRouteBtn: HTMLButtonElement;
let clearRoutesBtn: HTMLButtonElement;

// Route label helper (mimics Dart extension)
function getRouteLabel(route: Route): string {
  const td = route.getTimeDistance();
  const totalDistance = td.unrestrictedDistanceM + td.restrictedDistanceM;
  const totalDuration = td.unrestrictedTimeS + td.restrictedTimeS;

  // Convert the route to a public transit route (PTRoute).
  const publicTransitRoute: PTRoute | null = route.toPTRoute ? route.toPTRoute() : null;
  if (!publicTransitRoute) return '';

  // Get the first and last segments of the route.
  const firstSegment = publicTransitRoute.segments[0]?.toPTRouteSegment?.();
  const lastSegment =
    publicTransitRoute.segments[publicTransitRoute.segments.length - 1]?.toPTRouteSegment?.();

  if (!firstSegment || !lastSegment) return '';

  // Get departure and arrival times from the segments.
  const departureTime = firstSegment.departureTime;
  const arrivalTime = lastSegment.arrivalTime;

  // Calculate total walking distance (first and last segments are typically walking).
  const totalWalkingDistance =
    firstSegment.timeDistance.totalDistanceM + lastSegment.timeDistance.totalDistanceM;

  let formattedDepartureTime = '';
  let formattedArrivalTime = '';

  if (departureTime && arrivalTime) {
    formattedDepartureTime = `${departureTime.getHours()}:${departureTime.getMinutes().toString().padStart(2, '0')}`;
    formattedArrivalTime = `${arrivalTime.getHours()}:${arrivalTime.getMinutes().toString().padStart(2, '0')}`;
  }

  // Build the label string with the route's details.
  return (
    `${convertDuration(totalDuration)}\n` +
    `${formattedDepartureTime} - ${formattedArrivalTime}\n` +
    `${convertDistance(totalDistance)} (${convertDistance(totalWalkingDistance)} walking)\n` +
    `${publicTransitRoute.publicTransportFare || ''}`
  );
}

// UI: update segment panel
function updateSegmentPanel() {
  let panel = document.getElementById('pt-segments-panel') as HTMLDivElement;
  if (panel) panel.remove();

  if (!ptSegments || ptSegments.length === 0) return;

  panel = document.createElement('div');
  panel.id = 'pt-segments-panel';
  panel.style.cssText = `
    position: fixed; 
    left: 50%; 
    bottom: 30px; 
    transform: translateX(-50%);
    background: rgba(255, 255, 255, 0.95); 
    backdrop-filter: blur(10px);
    border-radius: 20px; 
    box-shadow: 0 8px 32px rgba(0,0,0,0.15);
    padding: 12px 24px; 
    display: flex; 
    flex-direction: row; 
    gap: 16px; 
    align-items: center; 
    z-index: 1100;
    max-width: 90vw;
    overflow-x: auto;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  `;

  ptSegments.forEach((segment, index) => {
    const segDiv = document.createElement('div');
    segDiv.style.cssText = `
      display: flex; 
      flex-direction: column; 
      align-items: center; 
      gap: 4px;
      min-width: 60px; 
      justify-content: center;
      position: relative;
    `;

    // Add arrow separator if not last
    if (index < ptSegments!.length - 1) {
      segDiv.style.paddingRight = '16px';
      segDiv.style.borderRight = '1px solid rgba(0,0,0,0.1)';
    }

    if (segment.transitType === TransitType.walk) {
      segDiv.innerHTML = `
        <div style="color: #555;">${ICONS.walk}</div>
        <span style="font-size: 12px; font-weight: 600; color: #666;">${convertDuration(segment.timeDistance.totalDistanceM)}</span>
      `;
    } else {
      const wheelchairIcon = segment.hasWheelchairSupport
        ? `<div style="position:absolute; top:-4px; right:-4px; background:#fff; border-radius:50%; padding:2px; box-shadow:0 2px 4px rgba(0,0,0,0.1);">${ICONS.wheelchair}</div>`
        : '';
      segDiv.innerHTML = `
        <div style="color: #4caf50; position: relative;">
            ${ICONS.bus}
            ${wheelchairIcon}
        </div>
        <div style="background: #4caf50; color: #fff; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: bold; white-space: nowrap;">
          ${segment.shortName || 'Bus'}
        </div>
      `;
    }
    panel.appendChild(segDiv);
  });

  document.body.appendChild(panel);
}

// UI: update buttons visibility
function updateUI() {
  buildRouteBtn.style.display = 'none';
  cancelRouteBtn.style.display = 'none';
  clearRoutesBtn.style.display = 'none';

  // Routes are not built.
  if (!routingHandler && !ptSegments) {
    buildRouteBtn.style.display = 'flex';
  }
  // Routes calculating is in progress.
  else if (routingHandler) {
    cancelRouteBtn.style.display = 'flex';
  }
  // Routes calculating is finished.
  else if (ptSegments) {
    clearRoutesBtn.style.display = 'flex';
  }

  updateSegmentPanel();
}

// Route calculation functionality
function onBuildRouteButtonPressed() {
  // Define the departure.
  const departureLandmark = Landmark.withLatLng({
    latitude: 51.505929,
    longitude: -0.097579,
  });

  // Define the destination.
  const destinationLandmark = Landmark.withLatLng({
    latitude: 51.507616,
    longitude: -0.105036,
  });

  // Define the route preferences with public transport mode.
  const routePreferences = new RoutePreferences({
    transportMode: RouteTransportMode.public,
  });

  showMessage('The route is being calculated.');

  routingHandler = RoutingService.calculateRoute(
    [departureLandmark, destinationLandmark],
    routePreferences,
    (err: GemError, routes: Route[]) => {
      routingHandler = null;

      if (err === GemError.success && routes.length > 0) {
        const routesMap = map?.preferences.routes;
        routes.forEach((route, idx) => {
          routesMap?.add(route, idx === 0, { label: idx === 0 ? getRouteLabel(route) : undefined });
        });
        map?.centerOnRoutes({ routes });

        // Convert normal route to PTRoute and then to PTRouteSegments
        const ptRoute: PTRoute | null = routes[0].toPTRoute() ? routes[0].toPTRoute() : null;
        if (ptRoute) {
          const segments: PTRouteSegment[] = ptRoute.segments
            .map((seg: RouteSegment) => seg.toPTRouteSegment && seg.toPTRouteSegment())
            .filter((seg: PTRouteSegment | null | undefined): seg is PTRouteSegment => !!seg);
          ptSegments = segments;
        } else {
          ptSegments = null;
        }
      } else {
        ptSegments = null;
        showMessage('Route calculation failed.');
      }
      updateUI();
    }
  );
  updateUI();
}

// Clear routes functionality
function onClearRoutesButtonPressed() {
  map?.preferences.routes.clear();
  ptSegments = null;
  updateUI();
}

// Cancel route calculation
function onCancelRouteButtonPressed() {
  if (routingHandler) {
    RoutingService.cancelRoute(routingHandler);
    routingHandler = null;
    showMessage('Route calculation cancelled.');
  }
  updateUI();
}

// Register route tap callback for selecting alternative routes
function registerRouteTapCallback() {
  if (!map) return;
  map.registerTouchCallback(async (pos: ScreenPosition) => {
    await map!.setCursorScreenPosition(pos);
    const selectedRoutes = map!.cursorSelectionRoutes();
    if (selectedRoutes.length > 0) {
      map!.preferences.routes.mainRoute = selectedRoutes[0];
    }
  });
}

// Main entry
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

  const viewId = 0;
  const wrapper = gemKit.createView(viewId, (gemMap: GemMap) => {
    map = gemMap;
    registerRouteTapCallback();
  });
  if (wrapper) container.appendChild(wrapper);

  // Build Route button
  buildRouteBtn = document.createElement('button');
  buildRouteBtn.innerHTML = `${ICONS.directions} Build Route`;
  buildRouteBtn.className = 'gem-button gem-button-primary gem-button-center';
  buildRouteBtn.onclick = () => onBuildRouteButtonPressed();
  document.body.appendChild(buildRouteBtn);

  // Cancel Route button
  cancelRouteBtn = document.createElement('button');
  cancelRouteBtn.innerHTML = `${ICONS.close} Cancel`;
  cancelRouteBtn.className = 'gem-button gem-button-danger gem-button-center';
  cancelRouteBtn.onclick = () => onCancelRouteButtonPressed();
  document.body.appendChild(cancelRouteBtn);

  // Clear Routes button
  clearRoutesBtn = document.createElement('button');
  clearRoutesBtn.innerHTML = `${ICONS.trash} Clear Routes`;
  clearRoutesBtn.className = 'gem-button gem-button-success gem-button-center';
  clearRoutesBtn.onclick = () => onClearRoutesButtonPressed();
  document.body.appendChild(clearRoutesBtn);

  updateUI();
});
