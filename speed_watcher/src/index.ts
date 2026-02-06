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
  GemImprovedPosition,
  GemPositionListener,
  Coordinates,
  TaskHandler,
} from '@magiclane/maps-sdk';
import {
  GEMKIT_TOKEN,
  ICONS,
  showMessage,
  styleButton,
  convertDistance,
  convertDuration,
  mpsToKmph,
  BUTTON_COLORS,
  styles,
  applyStyles,
  mergeStyles,
  createControlsBar,
  createSpeedIndicator,
  createSpeedLimit,
  initializeSDK,
  createMapView,
  EventListenerManager,
} from '../../shared';

// Extension for Route for calculating the route label which will be displayed on map
function getMapLabel(route: Route): string {
  const timeDistance = route.getTimeDistance();
  const totalDistance = timeDistance.unrestrictedDistanceM + timeDistance.restrictedDistanceM;
  const totalDuration = timeDistance.unrestrictedTimeS + timeDistance.restrictedTimeS;
  return `${convertDistance(totalDistance)} \n${convertDuration(totalDuration)}`;
}

// SpeedIndicator component (Modernized)
class SpeedIndicator {
  private container: HTMLDivElement;
  private speedText: HTMLDivElement;
  private limitContainer: HTMLDivElement;
  private positionListener: (position: GemImprovedPosition) => void;
  private gemPositionListener: GemPositionListener;

  constructor() {
    // Use shared style utilities for the container
    this.container = createSpeedIndicator();

    // Current Speed Area
    this.speedText = document.createElement('div');
    applyStyles(this.speedText, {
      fontSize: '36px',
      fontWeight: '700',
      lineHeight: '1',
      marginBottom: '4px',
    });
    this.speedText.textContent = '0';

    const unitText = document.createElement('div');
    applyStyles(
      unitText,
      mergeStyles(styles.textSmall, {
        textTransform: 'uppercase',
        marginBottom: '12px',
        fontWeight: '600',
      })
    );
    unitText.textContent = 'km/h';

    // Speed Limit Circle (Traffic Sign Style)
    this.limitContainer = createSpeedLimit();

    this.container.appendChild(this.speedText);
    this.container.appendChild(unitText);
    this.container.appendChild(this.limitContainer);

    this.positionListener = (position: GemImprovedPosition) => {
      this.speedText.textContent = `${mpsToKmph(position.speed)}`;
      const limit = mpsToKmph(position.speedLimit);
      this.limitContainer.textContent = limit > 0 ? `${limit}` : '--';

      // Visual Alert if speeding
      if (limit > 0 && mpsToKmph(position.speed) > limit) {
        this.speedText.style.color = '#ff5252';
      } else {
        this.speedText.style.color = '#fff';
      }
    };
    this.gemPositionListener = PositionService.instance.addImprovedPositionListener(
      this.positionListener
    );
  }

  getElement(): HTMLDivElement {
    return this.container;
  }

  destroy() {
    this.container.remove();
  }
}

// FollowPositionButton component (Modernized)
class FollowPositionButton {
  private button: HTMLButtonElement;
  constructor(onTap: () => void) {
    this.button = document.createElement('button');
    this.button.innerHTML = `${ICONS.compass} <span style="margin-left:8px;">Recenter</span>`;
    applyStyles(
      this.button,
      mergeStyles(
        styles.buttonBase,
        styles.buttonSecondary,
        styles.fixed,
        styles.centerHorizontal,
        {
          bottom: '30px',
          top: 'auto',
          fontSize: '14px',
          padding: '12px 20px',
          transition: 'transform 0.2s',
        }
      )
    );
    this.button.onclick = onTap;

    this.button.onmouseenter = () => (this.button.style.transform = 'translateX(-50%) scale(1.05)');
    this.button.onmouseleave = () => (this.button.style.transform = 'translateX(-50%) scale(1)');
  }
  getElement(): HTMLButtonElement {
    return this.button;
  }
  destroy() {
    this.button.remove();
  }
}

// Main app logic
let map: GemMap | null = null;
let areRoutesBuilt = false;
let isSimulationActive = false;
let routingHandler: TaskHandler | null = null;
let navigationHandler: TaskHandler | null = null;
let currentInstruction: NavigationInstruction | null = null;
let speedIndicator: SpeedIndicator | null = null;
let followPositionBtn: FollowPositionButton | null = null;

// Event listener manager for proper cleanup
const events = new EventListenerManager();

// UI References
let controlsDiv: HTMLDivElement;
let buildRouteBtn: HTMLButtonElement;
let startSimBtn: HTMLButtonElement;
let stopSimBtn: HTMLButtonElement;

function onMapCreated(gemMap: GemMap) {
  map = gemMap;
}

function onBuildRouteButtonPressed() {
  const departureLandmark = Landmark.withCoordinates(Coordinates.fromLatLong(41.898499, 12.526655));
  const destinationLandmark = Landmark.withCoordinates(
    Coordinates.fromLatLong(41.891037, 12.492692)
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
          routesMap.add(route, idx === 0, { label: getMapLabel(route) });
        });
        map!.centerOnRoutes({ routes });
        areRoutesBuilt = true;
        showMessage('Route built successfully!');
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
  navigationHandler = NavigationService.startSimulation(routes.mainRoute, undefined, {
    onNavigationInstruction: (instruction: NavigationInstruction) => {
      isSimulationActive = true;
      currentInstruction = instruction;
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
  cancelRoute();
  isSimulationActive = false;
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

function updateUI() {
  // Button visibility
  if (buildRouteBtn)
    buildRouteBtn.style.display = !routingHandler && !areRoutesBuilt ? 'flex' : 'none';
  if (startSimBtn)
    startSimBtn.style.display = !isSimulationActive && areRoutesBuilt ? 'flex' : 'none';
  if (stopSimBtn) stopSimBtn.style.display = isSimulationActive ? 'flex' : 'none';

  // SpeedIndicator panel
  if (isSimulationActive) {
    if (!speedIndicator) {
      speedIndicator = new SpeedIndicator();
      document.body.appendChild(speedIndicator.getElement());
    }
    if (!followPositionBtn) {
      followPositionBtn = new FollowPositionButton(() => map!.startFollowingPosition?.());
      document.body.appendChild(followPositionBtn.getElement());
    }
  } else {
    if (speedIndicator) {
      speedIndicator.destroy();
      speedIndicator = null;
    }
    if (followPositionBtn) {
      followPositionBtn.destroy();
      followPositionBtn = null;
    }
  }
}

// UI layout and initialization
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

  // --- Controls Container (Fixed Header) ---
  controlsDiv = createControlsBar();
  document.body.appendChild(controlsDiv);

  // Buttons
  buildRouteBtn = document.createElement('button');
  buildRouteBtn.innerHTML = `${ICONS.route} Build Route`;
  styleButton(buildRouteBtn, BUTTON_COLORS.purple.primary, BUTTON_COLORS.purple.hover, {
    position: 'relative',
    transform: 'none',
  });
  buildRouteBtn.onclick = () => onBuildRouteButtonPressed();
  controlsDiv.appendChild(buildRouteBtn);

  startSimBtn = document.createElement('button');
  startSimBtn.innerHTML = `${ICONS.play} Start Simulation`;
  styleButton(startSimBtn, BUTTON_COLORS.green.primary, BUTTON_COLORS.green.hover, {
    position: 'relative',
    transform: 'none',
  });
  startSimBtn.onclick = () => startSimulation();
  controlsDiv.appendChild(startSimBtn);

  stopSimBtn = document.createElement('button');
  stopSimBtn.innerHTML = `${ICONS.stop} Stop Simulation`;
  styleButton(stopSimBtn, BUTTON_COLORS.red.primary, BUTTON_COLORS.red.hover, {
    position: 'relative',
    transform: 'none',
  });
  stopSimBtn.onclick = () => stopSimulation();
  controlsDiv.appendChild(stopSimBtn);

  // Create GemKit map view with error handling
  const viewId = 1;
  const wrapper = createMapView(gemKit, container, viewId, (gemMap: GemMap) => {
    onMapCreated(gemMap);
    routingHandler = null;
    areRoutesBuilt = false;
    updateUI();
  });

  if (!wrapper) {
    console.error('Failed to create map view');
    return;
  }

  updateUI();

  // Register cleanup on page unload
  events.add(window, 'beforeunload', () => {
    events.cleanup();
  });
});
