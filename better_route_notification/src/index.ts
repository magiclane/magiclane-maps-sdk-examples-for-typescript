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
  NavigationService,
  NavigationInstruction,
  GemError,
  Route,
  TaskHandler,
  NavigationEventType,
} from '@magiclane/maps-sdk';
import { GEMKIT_TOKEN, showMessage, convertDistance, convertDuration } from '../../shared';

let map: GemMap | null = null;
let currentInstruction: NavigationInstruction | null = null;

let areRoutesBuilt = false;
let isSimulationActive = false;

// We use the progress listener to cancel the route calculation.
let routingHandler: TaskHandler | null = null;

// We use the progress listener to cancel the navigation.
let navigationHandler: TaskHandler | null = null;

// UI Elements
let buildRouteBtn: HTMLButtonElement;
let startSimulationBtn: HTMLButtonElement;
let stopSimulationBtn: HTMLButtonElement;
let recenterBtn: HTMLButtonElement;
let navigationPanel: HTMLDivElement;
let instructionPanel: HTMLDivElement;
let bottomPanel: HTMLDivElement;

function updateUI() {
  // Logic to toggle main buttons in the same spot
  buildRouteBtn.style.display = 'none';
  startSimulationBtn.style.display = 'none';
  stopSimulationBtn.style.display = 'none';

  if (!areRoutesBuilt) {
    buildRouteBtn.style.display = 'block';
  } else if (areRoutesBuilt && !isSimulationActive) {
    startSimulationBtn.style.display = 'block';
  } else if (isSimulationActive) {
    stopSimulationBtn.style.display = 'block';
  }

  navigationPanel.style.display = isSimulationActive ? 'block' : 'none';
  bottomPanel.style.display = isSimulationActive ? 'block' : 'none';
}

// Custom method for calling calculate route and displaying the results.
function onBuildRouteButtonPressed() {
  // Define the departure
  const departureLandmark = Landmark.withLatLng({
    latitude: 48.79743778098061,
    longitude: 2.4029037044571875,
  });

  // Define the destination
  const destinationLandmark = Landmark.withLatLng({
    latitude: 48.904767018940184,
    longitude: 2.3223936076132086,
  });

  // Define the route preferences
  const routePreferences = new RoutePreferences({});

  showMessage('The route is calculating.');

  // Calculate route
  routingHandler = RoutingService.calculateRoute(
    [departureLandmark, destinationLandmark],
    routePreferences,
    (err: GemError, calculatedRoutes: Route[]) => {
      // If the route calculation is finished, we don't have a progress listener anymore.
      routingHandler = null;

      if (err === GemError.success) {
        const routesMap = map?.preferences.routes;

        // Display the routes on map
        calculatedRoutes.forEach((route, index) => {
          // Add route with label
          const label = getRouteLabel(route);
          routesMap?.add(route, index === 0, { label });
        });

        // Center the camera on routes
        map?.centerOnRoutes({ routes: calculatedRoutes });
        showMessage('Route calculated successfully!');
      } else {
        showMessage('Route calculation failed.');
      }

      areRoutesBuilt = true;
      updateUI();
    }
  );

  updateUI();
}

// Method for starting the simulation and following the position
function startSimulation() {
  if (!map) return;

  const routes = map.preferences.routes;

  // Set main route (using second route if available, like in Dart code)
  const routeAt1 = routes.at(1);
  if (routeAt1) {
    routes.mainRoute = routeAt1;
  }

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
      updateNavigationUI();
      updateUI();
    },
    onBetterRouteDetected: (route: Route, travelTime: number, delay: number, timeGain: number) => {
      // Display notification when a better route is detected
      showBetterRouteNotification(travelTime, delay, timeGain);
    },
    onBetterRouteInvalidated: () => {
      console.log('The previously found better route is no longer valid');
    },
    onBetterRouteRejected: (reason: GemError) => {
      console.log('The check for better route failed with reason:', reason);
    },
    onError: (error: GemError) => {
      // If the navigation has ended or if an error occurred while navigating, remove routes
      isSimulationActive = false;
      cancelRoute();

      if (error !== GemError.cancel) {
        stopSimulation();
      }
      updateUI();
    },
  });

  // Clear route alternatives from map
  map.preferences.routes.clearAllButMainRoute();

  // Set the camera to follow position
  map.startFollowingPosition();
}

// Method for removing the routes from display
function cancelRoute() {
  if (!map) return;

  // Remove the routes from map
  map.preferences.routes.clear();

  if (routingHandler !== null) {
    // Cancel the navigation
    RoutingService.cancelRoute(routingHandler);
    routingHandler = null;
  }

  areRoutesBuilt = false;
  updateUI();
}

// Method to stop the simulation and remove the displayed routes
function stopSimulation() {
  if (navigationHandler !== null) {
    // Cancel the navigation
    NavigationService.cancelNavigation(navigationHandler);
    navigationHandler = null;
  }

  cancelRoute();
  isSimulationActive = false;
  updateUI();
}

// Update navigation UI with current instruction
function updateNavigationUI() {
  if (!currentInstruction) return;

  // Update instruction panel
  const instructionText = instructionPanel.querySelector('.instruction-text');
  if (instructionText) {
    instructionText.textContent = currentInstruction.nextTurnInstruction || 'Continue straight';
  }

  const instructionDistance = instructionPanel.querySelector('.instruction-distance');
  if (instructionDistance) {
    const timeDistance = currentInstruction.timeDistanceToNextTurn;
    const distance = timeDistance.unrestrictedDistanceM + timeDistance.restrictedDistanceM;
    instructionDistance.textContent = convertDistance(distance);
  }

  // Update bottom panel
  const remainingDistance = bottomPanel.querySelector('.remaining-distance');
  if (remainingDistance) {
    const timeDistance = currentInstruction.remainingTravelTimeDistance;
    const distance = timeDistance.unrestrictedDistanceM + timeDistance.restrictedDistanceM;
    remainingDistance.textContent = convertDistance(distance);
  }

  const eta = bottomPanel.querySelector('.eta');
  if (eta) {
    // Calculate ETA based on remaining time
    const timeDistance = currentInstruction.remainingTravelTimeDistance;
    const remainingTimeS = timeDistance.unrestrictedTimeS + timeDistance.restrictedTimeS;
    const now = new Date();
    const etaTime = new Date(now.getTime() + remainingTimeS * 1000);
    eta.textContent = etaTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const remainingDuration = bottomPanel.querySelector('.remaining-duration');
  if (remainingDuration) {
    const timeDistance = currentInstruction.remainingTravelTimeDistance;
    const duration = timeDistance.unrestrictedTimeS + timeDistance.restrictedTimeS;
    remainingDuration.textContent = convertDuration(duration);
  }
}

// Show better route notification modal
function showBetterRouteNotification(travelTime: number, delay: number, timeGain: number) {
  // Create modal overlay
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.5); z-index: 3000;
    display: flex; justify-content: center; align-items: center; /* Centered */
    backdrop-filter: blur(2px);
  `;

  // Create better route panel
  const panel = document.createElement('div');
  panel.style.cssText = `
    background: white; border-radius: 20px; padding: 30px;
    width: 90%; max-width: 350px; 
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  `;

  panel.innerHTML = `
    <div style="text-align: center; margin-bottom: 25px;">
      <h3 style="margin: 0 0 15px 0; color: #333; font-size: 1.2rem;">Better Route Found!</h3>
      <div style="color: #666; font-size: 15px; line-height: 1.6;">
        <div>Travel Time: <span style="font-weight:600; color:#333;">${formatDuration(travelTime)}</span></div>
        <div>Delay: <span style="font-weight:600; color:#333;">${formatDuration(delay)}</span></div>
        <div style="color: #4CAF50; font-weight: bold; margin-top: 10px;">Time Saved: ${formatDuration(timeGain)}</div>
      </div>
    </div>
    <button id="dismiss-better-route" style="
      width: 100%; padding: 12px; background: #673ab7; color: white;
      border: none; border-radius: 50px; font-size: 16px; cursor: pointer;
      font-weight: 600; box-shadow: 0 4px 10px rgba(103, 58, 183, 0.3);
    ">Dismiss</button>
  `;

  modal.appendChild(panel);
  document.body.appendChild(modal);

  // Add dismiss functionality
  const dismissBtn = panel.querySelector('#dismiss-better-route') as HTMLButtonElement;
  dismissBtn.onclick = () => {
    document.body.removeChild(modal);
  };

  // Allow dismissing by clicking overlay
  modal.onclick = (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  };
}

// Format duration from seconds to readable format
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

// Utility function to get route label (distance and duration)
function getRouteLabel(route: Route): string {
  const timeDistance = route.getTimeDistance();
  const totalDistance = timeDistance.unrestrictedDistanceM + timeDistance.restrictedDistanceM;
  const totalDuration = timeDistance.unrestrictedTimeS + timeDistance.restrictedTimeS;

  return `${convertDistance(totalDistance)}\n${convertDuration(totalDuration)}`;
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

  // Build Route button
  buildRouteBtn = document.createElement('button');
  buildRouteBtn.textContent = 'Build Route';
  buildRouteBtn.className = 'gem-button gem-button-primary gem-button-center';
  buildRouteBtn.onclick = () => onBuildRouteButtonPressed();
  document.body.appendChild(buildRouteBtn);

  // Start Simulation button
  startSimulationBtn = document.createElement('button');
  startSimulationBtn.textContent = 'Start Simulation';
  startSimulationBtn.className = 'gem-button gem-button-success gem-button-center';
  startSimulationBtn.onclick = () => startSimulation();
  document.body.appendChild(startSimulationBtn);

  // Stop Simulation button
  stopSimulationBtn = document.createElement('button');
  stopSimulationBtn.textContent = 'Stop Simulation';
  stopSimulationBtn.className = 'gem-button gem-button-danger gem-button-center';
  stopSimulationBtn.onclick = () => stopSimulation();
  document.body.appendChild(stopSimulationBtn);

  // Navigation panel (Container for Instructions)
  navigationPanel = document.createElement('div');
  // IMPROVEMENT: Moved down slightly to not conflict with top buttons
  navigationPanel.style.cssText = `
    position: fixed; 
    top: 90px; 
    left: 20px; 
    z-index: 1000;
    display: none;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  `;

  // Instruction panel (The visible card)
  instructionPanel = document.createElement('div');
  instructionPanel.style.cssText = `
    background: rgba(255, 255, 255, 0.95); 
    border-radius: 16px; 
    padding: 20px; 
    margin-bottom: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15); 
    min-width: 220px;
    backdrop-filter: blur(5px);
  `;
  instructionPanel.innerHTML = `
    <div class="instruction-text" style="font-weight: 700; font-size: 1.1em; margin-bottom: 8px; color: #333;"></div>
    <div class="instruction-distance" style="color: #666; font-weight: 500;"></div>
  `;

  // Recenter button
  recenterBtn = document.createElement('button');
  recenterBtn.innerHTML = `
    <span style="font-size: 18px;">🧭</span>
    <span style="font-weight: 600;">Recenter</span>
  `;
  recenterBtn.style.cssText = `
    background: rgba(255, 255, 255, 0.95); 
    border: none; 
    border-radius: 50px; 
    padding: 10px 20px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15); 
    cursor: pointer;
    display: flex; 
    align-items: center; 
    gap: 8px;
    font-family: inherit;
    transition: transform 0.1s;
    backdrop-filter: blur(5px);
  `;
  recenterBtn.onmousedown = () => (recenterBtn.style.transform = 'scale(0.95)');
  recenterBtn.onmouseup = () => (recenterBtn.style.transform = 'scale(1)');

  recenterBtn.onclick = () => {
    if (map) {
      map.startFollowingPosition();
    }
  };

  navigationPanel.appendChild(instructionPanel);
  navigationPanel.appendChild(recenterBtn);
  document.body.appendChild(navigationPanel);

  // Bottom navigation panel (Stats)
  bottomPanel = document.createElement('div');
  bottomPanel.style.cssText = `
    position: fixed; 
    bottom: 30px; 
    left: 50%; 
    transform: translateX(-50%);
    width: 90%;
    max-width: 500px;
    background: rgba(255, 255, 255, 0.95); 
    padding: 16px 30px; 
    border-radius: 24px; 
    box-shadow: 0 4px 25px rgba(0, 0, 0, 0.15);
    display: none; 
    z-index: 1000;
    backdrop-filter: blur(5px);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  `;
  bottomPanel.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div class="remaining-distance" style="font-size: 20px; font-weight: 700; color: #333;"></div>
        <div style="color: #888; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">Distance</div>
      </div>
      <div style="text-align: center; border-left: 1px solid #eee; border-right: 1px solid #eee; padding: 0 20px;">
        <div class="eta" style="font-size: 20px; font-weight: 700; color: #333;"></div>
        <div style="color: #888; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">ETA</div>
      </div>
      <div style="text-align: right;">
        <div class="remaining-duration" style="font-size: 20px; font-weight: 700; color: #333;"></div>
        <div style="color: #888; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">Duration</div>
      </div>
    </div>
  `;
  document.body.appendChild(bottomPanel);

  updateUI();
});
