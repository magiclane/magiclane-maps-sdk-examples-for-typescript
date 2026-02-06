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
  BikeProfile,
  BikeProfileElectricBikeProfile,
  TaskHandler,
} from '@magiclane/maps-sdk';
import { GEMKIT_TOKEN, showMessage, ICONS, convertDistance, convertDuration } from '../../shared';

// Type for screen position coordinates
interface ScreenPosition {
  x: number;
  y: number;
}

// Bike profile types enum
enum EBikeType {
  city = 'city',
  cross = 'cross',
  mountain = 'mountain',
  road = 'road',
}

let map: GemMap | null = null;
let routingHandler: TaskHandler | null = null;
let routes: Route[] | null = null;
let selectedBikeType: BikeProfile = BikeProfile.city;

// UI Elements
let bikeProfileBtn: HTMLButtonElement;
let buildRouteBtn: HTMLButtonElement;
let cancelRouteBtn: HTMLButtonElement;
let clearRoutesBtn: HTMLButtonElement;
let bikeProfileMenu: HTMLDivElement;

function updateUI() {
  // Logic to ensure buttons occupy the same center spot
  buildRouteBtn.style.display = 'none';
  cancelRouteBtn.style.display = 'none';
  clearRoutesBtn.style.display = 'none';

  if (!routingHandler && !routes) {
    buildRouteBtn.style.display = 'flex';
  } else if (routingHandler && !routes) {
    cancelRouteBtn.style.display = 'flex';
  } else if (routes && !routingHandler) {
    clearRoutesBtn.style.display = 'flex';
  }
}

// Route calculation functionality with bike profile
function onBuildRouteButtonPressed() {
  // Define the departure (Amsterdam area)
  const departureLandmark = Landmark.withLatLng({
    latitude: 52.36239785,
    longitude: 4.89891628,
  });

  // Define the destination (Amsterdam area)
  const destinationLandmark = Landmark.withLatLng({
    latitude: 52.3769534,
    longitude: 4.898427,
  });

  // Define the route preferences with selected bike type
  const routePreferences = new RoutePreferences({
    bikeProfile: new BikeProfileElectricBikeProfile({
      profile: selectedBikeType || BikeProfile.city,
    }),
  });

  showMessage('The bike route is calculating.');

  // Calculate route
  routingHandler = RoutingService.calculateRoute(
    [departureLandmark, destinationLandmark],
    routePreferences,
    (err: GemError, calculatedRoutes: Route[]) => {
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
        showMessage('Bike route calculated successfully!');

        routes = calculatedRoutes;
      } else {
        showMessage('Bike route calculation failed.');
      }

      updateUI();
    }
  );

  updateUI();
}

// Clear routes functionality
function onClearRoutesButtonPressed() {
  // Remove the routes from map
  map?.preferences.routes.clear();
  routes = null;
  updateUI();
}

// Cancel route calculation
function onCancelRouteButtonPressed() {
  if (routingHandler) {
    RoutingService.cancelRoute(routingHandler);
    routingHandler = null;
    showMessage('Bike route calculation cancelled.');
  }
  updateUI();
}

// Register route tap callback for selecting alternative routes
function registerRouteTapCallback() {
  if (!map) return;

  map.registerTouchCallback(async (pos: ScreenPosition) => {
    // Select the map objects at given position
    await map!.setCursorScreenPosition(pos);

    // Get the selected routes
    const selectedRoutes = map!.cursorSelectionRoutes();

    // If there is a route at position, select it as the main one
    if (selectedRoutes.length > 0) {
      const routesMap = map!.preferences.routes;
      if (routesMap) {
        routesMap.mainRoute = selectedRoutes[0];
      }
    }
  });
}

// Show bike profile selection menu
function showBikeProfileMenu() {
  const isVisible = bikeProfileMenu.style.opacity === '1';

  if (isVisible) {
    bikeProfileMenu.style.opacity = '0';
    bikeProfileMenu.style.transform = 'translateY(-10px)';
    setTimeout(() => {
      bikeProfileMenu.style.display = 'none';
    }, 200);
  } else {
    bikeProfileMenu.style.display = 'block';
    // Force reflow
    void bikeProfileMenu.offsetWidth;
    bikeProfileMenu.style.opacity = '1';
    bikeProfileMenu.style.transform = 'translateY(0)';
  }
}

// Select bike profile
function selectBikeProfile(profileType: EBikeType) {
  switch (profileType) {
    case EBikeType.city:
      selectedBikeType = BikeProfile.city;
      break;
    case EBikeType.cross:
      selectedBikeType = BikeProfile.cross;
      break;
    case EBikeType.mountain:
      selectedBikeType = BikeProfile.mountain;
      break;
    case EBikeType.road:
      selectedBikeType = BikeProfile.road;
      break;
  }

  // Update button content
  bikeProfileBtn.innerHTML = `${ICONS.bike} <span>${profileType.charAt(0).toUpperCase() + profileType.slice(1)}</span>`;

  // Close menu
  showBikeProfileMenu();

  showMessage(`Selected bike profile: ${profileType}`);
}

// Create bike profile selection menu
function createBikeProfileMenu(): HTMLDivElement {
  const menu = document.createElement('div');
  menu.style.cssText = `
    position: fixed; 
    top: 85px; 
    right: 20px; 
    background: rgba(255, 255, 255, 0.95); 
    border-radius: 16px; 
    box-shadow: 0 10px 40px rgba(0,0,0,0.15);
    padding: 8px; 
    z-index: 2001; 
    display: none; 
    min-width: 160px;
    backdrop-filter: blur(10px);
    opacity: 0;
    transform: translateY(-10px);
    transition: opacity 0.2s ease, transform 0.2s ease;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  `;

  const profiles = [
    { type: EBikeType.city, label: 'City Bike', icon: ICONS.city },
    { type: EBikeType.cross, label: 'Cross Bike', icon: ICONS.cross },
    { type: EBikeType.mountain, label: 'Mountain Bike', icon: ICONS.mountain },
    { type: EBikeType.road, label: 'Road Bike', icon: ICONS.road },
  ];

  profiles.forEach((profile) => {
    const option = document.createElement('div');
    option.innerHTML = `<span style="display:flex; align-items:center; justify-content:center; width:24px;">${profile.icon}</span> <span>${profile.label}</span>`;
    option.style.cssText = `
      padding: 12px 16px; 
      cursor: pointer; 
      transition: all 0.2s;
      font-size: 14px; 
      color: #333;
      border-radius: 10px;
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 500;
    `;
    option.onmouseenter = () => {
      option.style.backgroundColor = 'rgba(103, 58, 183, 0.08)';
      option.style.color = '#673ab7';
    };
    option.onmouseleave = () => {
      option.style.backgroundColor = 'transparent';
      option.style.color = '#333';
    };
    option.onclick = () => selectBikeProfile(profile.type);
    menu.appendChild(option);
  });

  return menu;
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

  const viewId = 3;
  const wrapper = gemKit.createView(viewId, (gemMap: GemMap) => {
    map = gemMap;
    // Register route tap callback for alternative route selection
    registerRouteTapCallback();
  });
  if (wrapper) container.appendChild(wrapper);

  // Create bike profile menu
  bikeProfileMenu = createBikeProfileMenu();
  document.body.appendChild(bikeProfileMenu);

  // Bike Profile selection button (Configuration - Top Right)
  bikeProfileBtn = document.createElement('button');
  bikeProfileBtn.innerHTML = `${ICONS.bike} <span>City Bike</span>`;
  bikeProfileBtn.className = 'gem-button gem-button-secondary';
  bikeProfileBtn.style.cssText = `
    position: fixed;
    top: 30px;
    right: 20px;
  `;
  bikeProfileBtn.onclick = (e) => {
    e.stopPropagation();
    showBikeProfileMenu();
  };
  document.body.appendChild(bikeProfileBtn);

  // Build Route button (Action - Top Center)
  buildRouteBtn = document.createElement('button');
  buildRouteBtn.innerHTML = `${ICONS.bike} Build Bike Route`;
  buildRouteBtn.className = 'gem-button gem-button-primary gem-button-center';
  buildRouteBtn.onclick = () => onBuildRouteButtonPressed();
  document.body.appendChild(buildRouteBtn);

  // Cancel Route button (Action - Top Center)
  cancelRouteBtn = document.createElement('button');
  cancelRouteBtn.innerHTML = `${ICONS.close} Cancel`;
  cancelRouteBtn.className = 'gem-button gem-button-danger gem-button-center';
  cancelRouteBtn.onclick = () => onCancelRouteButtonPressed();
  document.body.appendChild(cancelRouteBtn);

  // Clear Routes button (Action - Top Center)
  clearRoutesBtn = document.createElement('button');
  clearRoutesBtn.innerHTML = `${ICONS.trash} Clear Routes`;
  clearRoutesBtn.className = 'gem-button gem-button-success gem-button-center';
  clearRoutesBtn.onclick = () => onClearRoutesButtonPressed();
  document.body.appendChild(clearRoutesBtn);

  // Initialize with default city bike profile
  selectedBikeType = BikeProfile.city;

  // Close menu when clicking outside
  document.addEventListener('click', (event) => {
    if (
      !bikeProfileBtn.contains(event.target as Node) &&
      !bikeProfileMenu.contains(event.target as Node)
    ) {
      if (bikeProfileMenu.style.display === 'block') {
        showBikeProfileMenu(); // This will trigger the close animation logic
      }
    }
  });

  updateUI();
});
