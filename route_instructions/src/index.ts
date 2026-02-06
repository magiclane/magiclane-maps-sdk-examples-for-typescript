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
  RouteSegment,
  RouteInstruction,
  Coordinates,
  RouteRenderSettings,
  RouteRenderOptions,
  TaskHandler,
} from '@magiclane/maps-sdk';
import {
  GEMKIT_TOKEN,
  ICONS,
  showMessage,
  styleButton,
  convertDistance,
  convertDuration,
  BUTTON_COLORS,
  styles,
  applyStyles,
  mergeStyles,
  createModalOverlay,
  createModalContent,
  createModalHeader,
  createCloseButton,
  initializeSDK,
  createMapView,
  EventListenerManager,
} from '../../shared';

let map: GemMap | null = null;
let routingHandler: TaskHandler | null = null;
let areRoutesBuilt = false;
let instructions: RouteInstruction[] = [];

// Event listener manager for proper cleanup
const events = new EventListenerManager();

// UI Elements
let routeBtn: HTMLButtonElement;
let cancelBtn: HTMLButtonElement;
let instructionsBtn: HTMLButtonElement;
let instructionsModal: HTMLDivElement;

function updateUI() {
  routeBtn.style.display = 'none';
  cancelBtn.style.display = 'none';
  instructionsBtn.style.display = 'none';

  if (!areRoutesBuilt) {
    routeBtn.style.display = 'flex';
  } else {
    // Show Cancel and Instructions buttons
    // We need to offset one of them so they don't overlap
    cancelBtn.style.display = 'flex';
    instructionsBtn.style.display = 'flex';

    // Adjust positions
    cancelBtn.style.transform = 'translateX(-110%)';
    instructionsBtn.style.transform = 'translateX(10%)';

    // Update hover effects to respect the new transform
    cancelBtn.onmouseenter = () => {
      cancelBtn.style.transform = 'translateX(-110%) translateY(-2px)';
      cancelBtn.style.boxShadow = `0 6px 20px #f4433699`;
      cancelBtn.style.background = '#ef5350';
    };
    cancelBtn.onmouseleave = () => {
      cancelBtn.style.transform = 'translateX(-110%) translateY(0)';
      cancelBtn.style.boxShadow = `0 4px 15px #f4433666`;
      cancelBtn.style.background = '#f44336';
    };

    instructionsBtn.onmouseenter = () => {
      instructionsBtn.style.transform = 'translateX(10%) translateY(-2px)';
      instructionsBtn.style.boxShadow = `0 6px 20px #2196f399`;
      instructionsBtn.style.background = '#42a5f5';
    };
    instructionsBtn.onmouseleave = () => {
      instructionsBtn.style.transform = 'translateX(10%) translateY(0)';
      instructionsBtn.style.boxShadow = `0 4px 15px #2196f366`;
      instructionsBtn.style.background = '#2196f3';
    };
  }
}

// Method for calculating route and displaying the results
async function onBuildRouteButtonPressed() {
  console.log('Build route button pressed');
  showMessage('The route is calculating.');

  try {
    // Define the departure (Frankfurt)
    const departureLandmark = Landmark.withCoordinates(Coordinates.fromLatLong(50.11428, 8.68133));

    // Define the intermediary point (Karlsruhe)
    const intermediaryPointLandmark = Landmark.withCoordinates(
      Coordinates.fromLatLong(49.0069, 8.4037)
    );

    // Define the destination (Munich)
    const destinationLandmark = Landmark.withCoordinates(Coordinates.fromLatLong(48.1351, 11.582));

    // Define the route preferences
    const routePreferences = new RoutePreferences({});

    console.log('Calculating route...');
    const routes = await calculateRoute(
      [departureLandmark, intermediaryPointLandmark, destinationLandmark],
      routePreferences
    );

    if (routes && routes.length > 0) {
      console.log('Route calculated successfully');
      showMessage('Route calculated successfully!');

      // Get the routes collection from map preferences
      const routesMap = map?.preferences.routes;

      // Display the routes on map
      for (const route of routes) {
        const isMainRoute = route === routes[0];
        const renderSettings = new RouteRenderSettings({
          options: new Set([RouteRenderOptions.showTraffic, RouteRenderOptions.showHighlights]),
        });
        routesMap?.add(route, isMainRoute, {
          routeRenderSettings: renderSettings,
        });
      }

      // Center the camera on routes
      map?.centerOnRoutes({ routes: routes });

      // Get the segments of the main route
      instructions = getInstructionsFromSegments(routes[0].segments);
      areRoutesBuilt = true;
      updateUI();

      console.log('Route instructions extracted:', instructions.length);
    } else {
      console.log('Route calculation failed');
      showMessage('Route calculation failed.');
    }
  } catch (error) {
    console.error('Error in onBuildRouteButtonPressed:', error);
    showMessage('Route calculation error.');
  }
}

// Method for canceling/removing routes
function onRouteCancelButtonPressed() {
  console.log('Cancel route button pressed');

  // Remove the routes from map
  map?.preferences.routes.clear();

  if (routingHandler) {
    // Cancel the calculation of the route
    RoutingService.cancelRoute(routingHandler);
    routingHandler = null;
  }

  // Remove the instructions
  instructions = [];
  areRoutesBuilt = false;
  updateUI();

  // Hide instructions modal if open
  instructionsModal.style.display = 'none';
}

// Method for showing route instructions
function onRouteInstructionsButtonPressed() {
  console.log('Route instructions button pressed');
  showInstructionsModal();
}

// Parse all segments and gather all instructions
function getInstructionsFromSegments(segments: RouteSegment[]): RouteInstruction[] {
  const instructionsList: RouteInstruction[] = [];

  for (const segment of segments) {
    const segmentInstructions = segment.instructions;
    instructionsList.push(...segmentInstructions);
  }

  return instructionsList;
}

// Calculate route with promise wrapper
async function calculateRoute(
  waypoints: Landmark[],
  preferences: RoutePreferences
): Promise<Route[] | null> {
  return new Promise((resolve) => {
    try {
      console.log('Calling RoutingService.calculateRoute...');

      // Add timeout to avoid hanging forever
      const timeout = setTimeout(() => {
        console.error('Route calculation timed out after 30 seconds');
        resolve(null);
      }, 30000);

      routingHandler = RoutingService.calculateRoute(
        waypoints,
        preferences,
        (err: GemError, routes: Route[]) => {
          clearTimeout(timeout);
          routingHandler = null;

          console.log('Route calculation callback called:', {
            err,
            routesCount: routes?.length || 0,
          });

          if (err === GemError.success && routes && routes.length > 0) {
            console.log('Route calculation successful');
            resolve(routes);
          } else {
            console.error('Route calculation failed:', err);
            resolve(null);
          }
        }
      );

      console.log('RoutingService.calculateRoute called, waiting for callback...');
    } catch (error) {
      console.error('Error calling RoutingService.calculateRoute:', error);
      resolve(null);
    }
  });
}

// Get formatted distance for route instruction
function getFormattedDistanceUntilInstruction(instruction: RouteInstruction): string {
  const rawDistance =
    instruction.traveledTimeDistance.restrictedDistanceM +
    instruction.traveledTimeDistance.unrestrictedDistanceM;
  return convertDistance(rawDistance);
}

// Get route label for display
function getRouteLabel(route: Route): string {
  const timeDistance = route.getTimeDistance();
  const totalDistance = timeDistance.unrestrictedDistanceM + timeDistance.restrictedDistanceM;
  const totalDuration = timeDistance.unrestrictedTimeS + timeDistance.restrictedTimeS;

  return `${convertDistance(totalDistance)}\n${convertDuration(totalDuration)}`;
}

// Show instructions modal
function showInstructionsModal() {
  instructionsModal.innerHTML = '';
  instructionsModal.style.display = 'flex'; // Use flex to center

  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: rgba(255, 255, 255, 0.95);
    width: 90%; 
    max-width: 500px;
    border-radius: 20px; 
    max-height: 80vh; 
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    display: flex;
    flex-direction: column;
    animation: slideUp 0.3s ease-out;
  `;

  // Add animation style
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    /* Custom scrollbar */
    .instructions-list::-webkit-scrollbar {
      width: 6px;
    }
    .instructions-list::-webkit-scrollbar-track {
      background: transparent;
    }
    .instructions-list::-webkit-scrollbar-thumb {
      background-color: rgba(0,0,0,0.1);
      border-radius: 3px;
    }
  `;
  modalContent.appendChild(style);

  // Create header
  const header = document.createElement('div');
  header.style.cssText = `
    padding: 20px 24px;
    display: flex; 
    justify-content: space-between; 
    align-items: center;
    border-bottom: 1px solid rgba(0,0,0,0.05);
  `;

  const title = document.createElement('h2');
  title.textContent = 'Route Instructions';
  title.style.cssText = `
    margin: 0; 
    font-size: 20px; 
    font-weight: 600;
    color: #1a1a1a;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  `;

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = ICONS.close;
  closeBtn.style.cssText = `
    background: rgba(0,0,0,0.05); 
    border: none; 
    color: #666; 
    cursor: pointer; 
    padding: 8px; 
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  `;
  closeBtn.onmouseenter = () => {
    closeBtn.style.background = 'rgba(0,0,0,0.1)';
    closeBtn.style.color = '#000';
  };
  closeBtn.onmouseleave = () => {
    closeBtn.style.background = 'rgba(0,0,0,0.05)';
    closeBtn.style.color = '#666';
  };
  closeBtn.onclick = () => (instructionsModal.style.display = 'none');

  header.appendChild(title);
  header.appendChild(closeBtn);
  modalContent.appendChild(header);

  // Create instructions list
  const instructionsList = document.createElement('div');
  instructionsList.className = 'instructions-list';
  instructionsList.style.cssText = `
    overflow-y: auto; 
    padding: 0;
    flex: 1;
  `;

  if (instructions.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.style.cssText = `
      padding: 40px;
      text-align: center;
      color: #666;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;
    emptyState.textContent = 'No instructions available.';
    instructionsList.appendChild(emptyState);
  } else {
    instructions.forEach((instruction, index) => {
      const item = createInstructionItem(instruction, index);
      instructionsList.appendChild(item);
    });
  }

  modalContent.appendChild(instructionsList);
  instructionsModal.appendChild(modalContent);
}

// Create individual instruction item
function createInstructionItem(instruction: RouteInstruction, index: number): HTMLElement {
  const item = document.createElement('div');
  item.style.cssText = `
    display: flex; 
    align-items: center; 
    padding: 16px 24px;
    border-bottom: 1px solid rgba(0,0,0,0.05);
    transition: background 0.2s ease;
  `;
  item.onmouseenter = () => (item.style.background = 'rgba(0,0,0,0.02)');
  item.onmouseleave = () => (item.style.background = 'transparent');

  // Create icon container
  const iconContainer = document.createElement('div');
  iconContainer.style.cssText = `
    width: 48px; 
    height: 48px; 
    margin-right: 20px;
    display: flex; 
    align-items: center; 
    justify-content: center;
    background: #f5f5f5; 
    border-radius: 12px;
    flex-shrink: 0;
    overflow: hidden;
  `;

  // Add turn image exactly like in RouteInstructionsPanel
  const turnImage = document.createElement('img');
  turnImage.style.cssText = 'width: 100%; height: 100%; object-fit: contain; display: block;';
  turnImage.alt = 'Turn Image';
  turnImage.onerror = () => {
    // Fallback to arrow icon if image fails to load
    turnImage.style.display = 'none';
    iconContainer.innerHTML = ICONS.directions;
    iconContainer.style.color = '#666';
  };

  try {
    // Use the exact same method as RouteInstructionsPanel
    const imageData = instruction.getTurnImage({ size: { width: 56, height: 56 }, format: 0 }); // 0 corresponds to PNG

    if (imageData && imageData.length > 0) {
      // Correct `imageData` conversion exactly as in RouteInstructionsPanel
      const imageDataArray = Array.from(imageData) as unknown as number[];
      turnImage.src = `data:image/png;base64,${btoa(String.fromCharCode(...imageDataArray))}`;
      iconContainer.appendChild(turnImage);
    } else {
      // Fallback icon if no image data
      iconContainer.innerHTML = ICONS.directions;
      iconContainer.style.color = '#666';
    }
  } catch (error) {
    console.warn('Error loading turn image:', error);
    // Fallback icon
    iconContainer.innerHTML = ICONS.directions;
    iconContainer.style.color = '#666';
  }

  // Create text content
  const textContainer = document.createElement('div');
  textContainer.style.cssText =
    'flex: 1; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;';

  const turnInstruction = document.createElement('div');
  turnInstruction.textContent = instruction.turnInstruction || 'Continue';
  turnInstruction.style.cssText = `
    font-size: 15px; 
    font-weight: 500; 
    color: #1a1a1a;
    margin-bottom: 4px; 
    line-height: 1.4;
  `;

  const followRoadInstruction = document.createElement('div');
  followRoadInstruction.textContent = instruction.followRoadInstruction || '';
  followRoadInstruction.style.cssText = `
    font-size: 13px; 
    color: #666; 
    line-height: 1.4;
  `;

  textContainer.appendChild(turnInstruction);
  if (instruction.followRoadInstruction) {
    textContainer.appendChild(followRoadInstruction);
  }

  // Create distance
  const distance = document.createElement('div');
  distance.textContent = getFormattedDistanceUntilInstruction(instruction);
  distance.style.cssText = `
    font-size: 14px; 
    color: #2196f3; 
    font-weight: 600;
    margin-left: 16px;
    min-width: 60px; 
    text-align: right;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  `;

  item.appendChild(iconContainer);
  item.appendChild(textContainer);
  item.appendChild(distance);

  return item;
}

// Initialize the map and UI
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

  // Create map view with error handling
  const viewId = 4;
  const wrapper = createMapView(gemKit, container, viewId, (gemMap: GemMap) => {
    map = gemMap;
  });

  if (!wrapper) {
    console.error('Failed to create map view');
    return;
  }

  // Create Buttons with event tracking
  routeBtn = document.createElement('button');
  routeBtn.innerHTML = `${ICONS.directions} Build Route`;
  styleButton(routeBtn, BUTTON_COLORS.green.primary, BUTTON_COLORS.green.hover);
  events.add(routeBtn, 'click', onBuildRouteButtonPressed);
  document.body.appendChild(routeBtn);

  cancelBtn = document.createElement('button');
  cancelBtn.innerHTML = `${ICONS.close} Cancel Route`;
  styleButton(cancelBtn, BUTTON_COLORS.red.primary, BUTTON_COLORS.red.hover);
  events.add(cancelBtn, 'click', onRouteCancelButtonPressed);
  document.body.appendChild(cancelBtn);

  instructionsBtn = document.createElement('button');
  instructionsBtn.innerHTML = `${ICONS.info} Instructions`;
  styleButton(instructionsBtn, BUTTON_COLORS.blue.primary, BUTTON_COLORS.blue.hover);
  events.add(instructionsBtn, 'click', onRouteInstructionsButtonPressed);
  document.body.appendChild(instructionsBtn);

  // Create instructions modal
  instructionsModal = document.createElement('div');
  instructionsModal.style.cssText = `
    display: none; position: fixed; z-index: 4000; left: 0; top: 0;
    width: 100%; height: 100%; overflow: hidden;
    background-color: rgba(0,0,0,0.4);
    backdrop-filter: blur(4px);
    justify-content: center;
    align-items: center;
  `;
  document.body.appendChild(instructionsModal);

  // Close modal when clicking outside - tracked for cleanup
  events.add(instructionsModal, 'click', (e: MouseEvent) => {
    if (e.target === instructionsModal) {
      instructionsModal.style.display = 'none';
    }
  });

  updateUI();

  // Register cleanup on page unload
  events.add(window, 'beforeunload', () => {
    events.cleanup();
  });
});
