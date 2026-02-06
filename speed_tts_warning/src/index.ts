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
  GemError,
  Route,
  NavigationService,
  NavigationInstruction,
  PositionService,
  AlarmService,
  AlarmListener,
  Coordinates,
  TaskHandler,
} from '@magiclane/maps-sdk';
import { GEMKIT_TOKEN, showMessage, ICONS } from '../../shared';

// Application State
let map: GemMap | null = null;
let ttsEngine: TTSEngine;
let areRoutesBuilt = false;
let isSimulationActive = false;
let routingHandler: TaskHandler | null = null;
let navigationHandler: TaskHandler | null = null;
let alarmService: AlarmService | null = null;
let alarmListener: AlarmListener | null = null;
let currentSpeedLimit: number | null = null;

// UI References
let controlsDiv: HTMLDivElement;
let buildRouteBtn: HTMLButtonElement;
let startSimBtn: HTMLButtonElement;
let stopSimBtn: HTMLButtonElement;
let speedLimitPanel: HTMLDivElement;
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
  ttsEngine = new TTSEngine();

  const mapContainer = document.getElementById('map-container');
  if (!mapContainer) throw new Error('Map container not found');

  const viewId = 2;
  const wrapper = gemKit.createView(viewId, (gemMap: GemMap) => {
    map = gemMap;
    routingHandler = null;
    areRoutesBuilt = false;
    updateUI();
  });
  if (wrapper) mapContainer.appendChild(wrapper);

  // --- Controls Container (Fixed Header) ---
  controlsDiv = document.createElement('div');
  controlsDiv.className = 'gem-controls-bar';
  document.body.appendChild(controlsDiv);

  // Build Route button
  buildRouteBtn = document.createElement('button');
  buildRouteBtn.innerHTML = `${ICONS.route} Build Route`;
  buildRouteBtn.className = 'gem-button gem-button-primary gem-button-center';
  buildRouteBtn.onclick = () => onBuildRouteButtonPressed();
  controlsDiv.appendChild(buildRouteBtn);

  // Start Simulation button
  startSimBtn = document.createElement('button');
  startSimBtn.innerHTML = `${ICONS.play} Start Simulation`;
  startSimBtn.className = 'gem-button gem-button-success gem-button-center';
  startSimBtn.onclick = () => startSimulation();
  controlsDiv.appendChild(startSimBtn);

  // Stop Simulation button
  stopSimBtn = document.createElement('button');
  stopSimBtn.innerHTML = `${ICONS.stop} Stop Simulation`;
  stopSimBtn.className = 'gem-button gem-button-danger gem-button-center';
  stopSimBtn.onclick = () => stopSimulation();
  controlsDiv.appendChild(stopSimBtn);

  // Initialize Speed Limit Panel (Hidden by default)
  createSpeedLimitPanel();

  updateUI();
});

function createSpeedLimitPanel() {
  speedLimitPanel = document.createElement('div');
  speedLimitPanel.style.cssText = `
        position: fixed;
        bottom: 110px;
        left: 20px;
        background: #fff;
        border-radius: 16px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.15);
        padding: 12px 20px;
        display: none;
        align-items: center;
        gap: 16px;
        z-index: 2000;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        animation: slideUp 0.3s ease-out;
    `;

  // Inject CSS for animation
  const style = document.createElement('style');
  style.innerHTML = `
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    `;
  document.head.appendChild(style);

  document.body.appendChild(speedLimitPanel);
}

function updateSpeedPanel(limit: number) {
  if (!speedLimitPanel) return;

  // Traffic Sign Visual
  const signHtml = `
        <div style="
            width: 50px; height: 50px;
            border-radius: 50%;
            background: #fff;
            border: 5px solid #d32f2f;
            display: flex; align-items: center; justify-content: center;
            font-weight: 800; font-size: 20px; color: #333;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        ">
            ${limit}
        </div>
    `;

  speedLimitPanel.innerHTML = `
        ${signHtml}
        <div>
            <div style="font-size: 11px; text-transform: uppercase; color: #888; font-weight: 700;">Speed Limit</div>
            <div style="font-size: 18px; font-weight: 600; color: #d32f2f;">Detected</div>
        </div>
    `;

  speedLimitPanel.style.display = 'flex';
}

function updateUI() {
  buildRouteBtn.style.display = !routingHandler && !areRoutesBuilt ? 'flex' : 'none';
  startSimBtn.style.display = !isSimulationActive && areRoutesBuilt ? 'flex' : 'none';
  stopSimBtn.style.display = isSimulationActive ? 'flex' : 'none';

  if (speedLimitPanel) {
    if (isSimulationActive && currentSpeedLimit !== null) {
      updateSpeedPanel(currentSpeedLimit);
    } else {
      speedLimitPanel.style.display = 'none';
    }
  }

  if (isSimulationActive) showFollowButton();
  else if (followBtn) (followBtn.remove(), (followBtn = null));
}

function onBuildRouteButtonPressed() {
  // Departure: Kassel
  const departureLandmark = Landmark.withCoordinates(
    Coordinates.fromLatLong(51.35416637819253, 9.378580176120199)
  );
  // Destination: Kassel (nearby)
  const destinationLandmark = Landmark.withCoordinates(
    Coordinates.fromLatLong(51.36704970265849, 9.404698019844462)
  );

  const routePreferences = new RoutePreferences({});
  showMessage('Calculating route...');

  routingHandler = RoutingService.calculateRoute(
    [departureLandmark, destinationLandmark],
    routePreferences,
    (err: GemError, routes: Route[]) => {
      routingHandler = null;
      if (err === GemError.success && routes.length > 0) {
        const routesMap = map!.preferences.routes;
        routes.forEach((route: Route, idx: number) => {
          routesMap.add(route, idx === 0);
        });
        map!.centerOnRoutes({ routes });
        areRoutesBuilt = true;
        showMessage('Route built successfully.');
      } else {
        showMessage('Route calculation failed.');
      }
      updateUI();
    }
  );
  updateUI();
}

function startSimulation() {
  const routes = map!.preferences.routes;
  routes.clearAllButMainRoute?.();

  if (!routes.mainRoute) {
    showMessage('No main route available');
    return;
  }

  alarmListener = AlarmListener.create({
    onSpeedLimit: async (speed: number, limit: number, insideCityArea: boolean) => {
      // API often returns m/s, convert to km/h
      const speedLimitConverted = Math.round(limit * 3.6);

      if (currentSpeedLimit !== speedLimitConverted) {
        currentSpeedLimit = speedLimitConverted;
        updateUI();

        const speedWarning = `Speed limit is ${speedLimitConverted} kilometers per hour`;
        ttsEngine.speakText(speedWarning);
        showMessage(`Alert: ${speedLimitConverted} km/h limit`);
      }
    },
  });

  alarmService = AlarmService.create(alarmListener);

  navigationHandler = NavigationService.startSimulation(routes.mainRoute, undefined, {
    onNavigationInstruction: (instruction: NavigationInstruction) => {
      isSimulationActive = true;
      updateUI();
    },
    onDestinationReached: (landmark: Landmark) => {
      stopSimulation();
      cancelRoute();
      showMessage('Destination reached!');
    },
    onError: (error: GemError) => {
      isSimulationActive = false;
      cancelRoute();
      if (error !== GemError.cancel) {
        stopSimulation();
      }
    },
  });

  map!.startFollowingPosition?.();
  isSimulationActive = true;
  updateUI();
  showMessage('Simulation started');
}

function stopSimulation() {
  if (navigationHandler) {
    NavigationService.cancelNavigation(navigationHandler);
    navigationHandler = null;
  }

  if (alarmService) {
    // Clean up alarm service if SDK supports explicit disposal,
    // otherwise setting to null handles GC reference release
    alarmService = null;
  }

  cancelRoute();
  isSimulationActive = false;
  currentSpeedLimit = null;
  updateUI();
  showMessage('Simulation stopped');
}

function cancelRoute() {
  map!.preferences.routes.clear?.();
  if (routingHandler) {
    RoutingService.cancelRoute(routingHandler);
    routingHandler = null;
  }
  areRoutesBuilt = false;
  updateUI();
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

// TTS engine using window.speechSynthesis
class TTSEngine {
  private synth: SpeechSynthesis;
  private utter: SpeechSynthesisUtterance | null = null;

  constructor() {
    this.synth = window.speechSynthesis;
  }

  speakText(text: string) {
    if (this.synth.speaking) {
      this.synth.cancel();
    }
    this.utter = new SpeechSynthesisUtterance(text);
    this.utter.rate = 0.9;
    this.utter.pitch = 1.0;
    this.utter.volume = 1.0;
    this.synth.speak(this.utter);
  }

  stop() {
    if (this.synth.speaking) {
      this.synth.cancel();
    }
  }
}
