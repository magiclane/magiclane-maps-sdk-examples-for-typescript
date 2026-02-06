// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

import {
  GemKit,
  GemMap,
  Landmark,
  TruckProfile,
  RoutePreferences,
  RoutingService,
  GemError,
  Route,
  Coordinates,
  TaskHandler,
} from '@magiclane/maps-sdk';
import { GEMKIT_TOKEN, showMessage, ICONS, convertDistance, convertDuration } from '../../shared';

let map: GemMap | null = null;
let truckProfile: TruckProfile = new TruckProfile();
let routingHandler: TaskHandler | null = null;
let routes: Route[] | null = null;
let settingsSidebar: HTMLDivElement;

// UI References
let controlsDiv: HTMLDivElement;
let buildRouteBtn: HTMLButtonElement;
let cancelRouteBtn: HTMLButtonElement;
let clearRoutesBtn: HTMLButtonElement;
let settingsBtn: HTMLButtonElement;

// Extension methods for Route
function getMapLabel(route: Route): string {
  try {
    const timeDistance = route.getTimeDistance();
    const totalDistance = timeDistance.unrestrictedDistanceM + timeDistance.restrictedDistanceM;
    const totalDuration = timeDistance.unrestrictedTimeS + timeDistance.restrictedTimeS;

    return `${convertDistance(totalDistance)} \n${convertDuration(totalDuration)}`;
  } catch {
    return 'Route';
  }
}

// UI layout and initialization
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

  const viewId = 1;
  const wrapper = gemKit.createView(viewId, async (gemMap: GemMap) => {
    map = gemMap;
    await registerRouteTapCallback();
  });
  if (wrapper) container.appendChild(wrapper);

  // --- Controls Container (Fixed Header) ---
  controlsDiv = document.createElement('div');
  controlsDiv.style.cssText = `
    position: fixed; top: 30px; left: 50%; transform: translateX(-50%);
    display: flex; gap: 12px; z-index: 2000; align-items: center; justify-content: center;
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

  // Clear Routes button
  clearRoutesBtn = document.createElement('button');
  clearRoutesBtn.innerHTML = `${ICONS.trash} Clear`;
  clearRoutesBtn.className = 'gem-button gem-button-warning';
  clearRoutesBtn.onclick = () => onClearRoutesButtonPressed();
  controlsDiv.appendChild(clearRoutesBtn);

  // Settings Sidebar
  createSettingsSidebar();

  // Floating Settings Toggle Button
  settingsBtn = document.createElement('button');
  settingsBtn.innerHTML = ICONS.settings;
  settingsBtn.style.cssText = `
    position: fixed; bottom: 30px; left: 20px; width: 56px; height: 56px;
    background: #fff; color: #555; border: none; border-radius: 50%;
    font-size: 1.5em; cursor: pointer; z-index: 2000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    display: flex; align-items: center; justify-content: center;
    transition: transform 0.2s, color 0.2s;
  `;
  settingsBtn.onmouseenter = () => {
    settingsBtn.style.transform = 'scale(1.1)';
    settingsBtn.style.color = '#673ab7';
  };
  settingsBtn.onmouseleave = () => {
    settingsBtn.style.transform = 'scale(1)';
    settingsBtn.style.color = '#555';
  };
  settingsBtn.onclick = () => toggleSettingsSidebar(true);
  document.body.appendChild(settingsBtn);

  updateUI();
});

function updateUI() {
  buildRouteBtn.style.display = !routingHandler && !routes ? 'flex' : 'none';
  cancelRouteBtn.style.display = routingHandler ? 'flex' : 'none';
  clearRoutesBtn.style.display = routes ? 'flex' : 'none';
}

function onBuildRouteButtonPressed() {
  if (!map) return;

  const departureLandmark = Landmark.withCoordinates(Coordinates.fromLatLong(48.87126, 2.33787)); // Paris
  const destinationLandmark = Landmark.withCoordinates(Coordinates.fromLatLong(51.4739, -0.0302)); // London

  const routePreferences = new RoutePreferences({ truckProfile });

  showMessage('Calculating truck route...');

  routingHandler = RoutingService.calculateRoute(
    [departureLandmark, destinationLandmark],
    routePreferences,
    (err: GemError, calculatedRoutes: Route[]) => {
      routingHandler = null;
      updateUI();

      if (err === GemError.success && map) {
        const routesMap = map.preferences.routes;
        calculatedRoutes.forEach((route, index) => {
          routesMap.add(route, index === 0, { label: getMapLabel(route) });
        });
        map.centerOnRoutes({ routes: calculatedRoutes });
        routes = calculatedRoutes;
        updateUI();
        showMessage('Routes calculated successfully!');
      } else {
        showMessage('Failed to calculate route');
      }
    }
  );
  updateUI();
}

function onClearRoutesButtonPressed() {
  if (!map) return;
  map.preferences.routes.clear();
  routes = null;
  updateUI();
  showMessage('Routes cleared');
}

function onCancelRouteButtonPressed() {
  if (routingHandler) {
    RoutingService.cancelRoute(routingHandler);
    routingHandler = null;
    updateUI();
    showMessage('Route calculation cancelled');
  }
}

async function registerRouteTapCallback() {
  if (!map) return;
  map.registerTouchCallback(async (pos: { x: number; y: number }) => {
    if (!map) return;
    await map.setCursorScreenPosition(pos);
    const selectedRoutes = map.cursorSelectionRoutes();
    if (selectedRoutes.length > 0) {
      map.preferences.routes.mainRoute = selectedRoutes[0];
    }
  });
}

function createSettingsSidebar() {
  settingsSidebar = document.createElement('div');
  settingsSidebar.style.cssText = `
    position: fixed; top: 0; left: 0; bottom: 0; width: 340px;
    background: #fff; z-index: 2500;
    box-shadow: 4px 0 20px rgba(0,0,0,0.1);
    transform: translateX(-105%);
    transition: transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
    display: flex; flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  `;

  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;
  `;
  header.innerHTML = `<h2 style="margin:0; font-size: 20px; color:#333; display:flex; gap:10px; align-items:center;">${ICONS.truck} Truck Profile</h2>`;

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = ICONS.close;
  closeBtn.style.cssText = `background:none; border:none; cursor:pointer; color:#666; padding:5px;`;
  closeBtn.onclick = () => toggleSettingsSidebar(false);
  header.appendChild(closeBtn);
  settingsSidebar.appendChild(header);

  // Sliders Content
  const content = document.createElement('div');
  content.style.cssText = `flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 24px;`;

  const sliders = [
    { label: 'Height', property: 'height', min: 180, max: 400, unit: 'cm', step: 1 },
    { label: 'Length', property: 'length', min: 500, max: 2000, unit: 'cm', step: 10 },
    { label: 'Width', property: 'width', min: 200, max: 400, unit: 'cm', step: 1 },
    { label: 'Axle Load', property: 'axleLoad', min: 1500, max: 10000, unit: 'kg', step: 50 },
    { label: 'Max Speed', property: 'maxSpeed', min: 60, max: 250, unit: 'km/h', step: 5 },
    { label: 'Total Weight', property: 'mass', min: 3000, max: 50000, unit: 'kg', step: 100 },
  ];

  sliders.forEach((s) => {
    content.appendChild(
      buildSlider(s.label, s.property as keyof TruckProfile, s.min, s.max, s.unit, s.step)
    );
  });

  settingsSidebar.appendChild(content);

  // Footer Actions
  const footer = document.createElement('div');
  footer.style.cssText = `padding: 20px; border-top: 1px solid #eee; background: #f9f9f9;`;
  const doneBtn = document.createElement('button');
  doneBtn.textContent = 'Apply Settings';
  doneBtn.style.cssText = `
    width: 100%; padding: 12px; background: #673ab7; color: white;
    border: none; border-radius: 8px; font-weight: 600; cursor: pointer;
  `;
  doneBtn.onclick = () => {
    toggleSettingsSidebar(false);
    showMessage('Truck profile updated');
  };
  footer.appendChild(doneBtn);
  settingsSidebar.appendChild(footer);

  document.body.appendChild(settingsSidebar);
}

function toggleSettingsSidebar(show: boolean) {
  if (settingsSidebar) {
    settingsSidebar.style.transform = show ? 'translateX(0)' : 'translateX(-105%)';
  }
}

function buildSlider(
  label: string,
  property: keyof TruckProfile,
  min: number,
  max: number,
  unit: string,
  step: number
): HTMLElement {
  const container = document.createElement('div');

  const currentValue = Math.max(min, (truckProfile as any)[property] || min);

  // Label Row
  const topRow = document.createElement('div');
  topRow.style.cssText = 'display: flex; justify-content: space-between; margin-bottom: 8px;';

  const labelEl = document.createElement('span');
  labelEl.textContent = label;
  labelEl.style.cssText = 'font-weight: 600; color: #333; font-size: 14px;';

  const valueEl = document.createElement('span');
  valueEl.textContent = `${currentValue} ${unit}`;
  valueEl.style.cssText = 'font-weight: 600; color: #673ab7; font-size: 14px;';

  topRow.appendChild(labelEl);
  topRow.appendChild(valueEl);
  container.appendChild(topRow);

  // Slider Input
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = min.toString();
  slider.max = max.toString();
  slider.step = step.toString();
  slider.value = currentValue.toString();
  slider.style.cssText = `
    width: 100%; height: 6px; border-radius: 3px; background: #ddd; outline: none; cursor: pointer;
    accent-color: #673ab7;
  `;

  slider.oninput = () => {
    const val = parseInt(slider.value);
    (truckProfile as any)[property] = val;
    valueEl.textContent = `${val} ${unit}`;
  };

  container.appendChild(slider);

  // Min/Max Labels
  const rangeLabels = document.createElement('div');
  rangeLabels.style.cssText =
    'display: flex; justify-content: space-between; margin-top: 4px; font-size: 11px; color: #888;';
  rangeLabels.innerHTML = `<span>${min}</span><span>${max}</span>`;
  container.appendChild(rangeLabels);

  return container;
}
