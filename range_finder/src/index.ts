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
  RouteRenderSettings,
  RouteRenderOptions,
  RouteTransportMode,
} from '@magiclane/maps-sdk';
import { Range } from './range';
import {
  GEMKIT_TOKEN,
  ICONS,
  showMessage,
  convertDuration,
  convertDistance,
  convertWh,
  ScreenPosition,
  initializeSDK,
  createMapView,
  EventListenerManager,
} from '../../shared';

let map: GemMap | null = null;
let focusedLandmark: Landmark | null = null;
let rangePanelDiv: HTMLDivElement | null = null;
let routeRanges: Range[] = [];

// Event listener manager for proper cleanup
const events = new EventListenerManager();

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
  const viewId = 1;
  const wrapper = createMapView(gemKit, container, viewId, (gemMap: GemMap) => {
    map = gemMap;
    registerLandmarkTapCallback();
    showMessage('Tap on the map to select a center point');
  });

  if (!wrapper) {
    console.error('Failed to create map view');
    return;
  }

  // Create the range panel overlay (hidden by default)
  rangePanelDiv = document.createElement('div');
  rangePanelDiv.style.display = 'none';
  document.body.appendChild(rangePanelDiv);

  // Register cleanup on page unload
  events.add(window, 'beforeunload', () => {
    events.cleanup();
  });
});

function registerLandmarkTapCallback() {
  if (!map) return;
  map.registerTouchCallback(async (pos: ScreenPosition) => {
    await map!.setCursorScreenPosition(pos);
    const landmarks = map!.cursorSelectionLandmarks();
    await map!.resetMapSelection();
    if (!landmarks.length) return;
    map!.activateHighlight(landmarks);
    focusedLandmark = landmarks[0];
    showRangePanel();
  });

  // Register callback for cleanup
  events.addSDKCallback('touch', () => map?.unregisterTouchCallback());
}

function showRangePanel() {
  if (!rangePanelDiv || !focusedLandmark) return;
  rangePanelDiv.innerHTML = '';
  rangePanelDiv.style.display = 'flex';

  // Modern Panel Styling
  rangePanelDiv.style.cssText = `
    position: fixed; 
    top: 50%; 
    left: 50%; 
    transform: translate(-50%, -50%);
    background: rgba(255, 255, 255, 0.98); 
    backdrop-filter: blur(10px);
    border-radius: 24px; 
    box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    padding: 24px; 
    z-index: 2000; 
    width: 90%; 
    max-width: 400px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    animation: fadeIn 0.3s ease-out;
  `;

  // Add animation style
  if (!document.getElementById('panel-anim')) {
    const style = document.createElement('style');
    style.id = 'panel-anim';
    style.textContent = `@keyframes fadeIn { from { opacity: 0; transform: translate(-50%, -45%); } to { opacity: 1; transform: translate(-50%, -50%); } }`;
    document.head.appendChild(style);
  }

  // Header
  const header = document.createElement('div');
  header.style.cssText = `display: flex; justify-content: space-between; align-items: center;`;
  header.innerHTML = `<div style="font-size: 20px; font-weight: 700; color: #111;">Range Finder</div>`;

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = ICONS.close;
  closeBtn.style.cssText = `
    background: rgba(0,0,0,0.05); 
    border: none; 
    cursor: pointer; 
    color: #666; 
    width: 32px;
    height: 32px;
    border-radius: 50%; 
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  `;
  closeBtn.onmouseenter = () => {
    closeBtn.style.background = 'rgba(0,0,0,0.1)';
    closeBtn.style.color = '#000';
  };
  closeBtn.onmouseleave = () => {
    closeBtn.style.background = 'rgba(0,0,0,0.05)';
    closeBtn.style.color = '#666';
  };
  closeBtn.onclick = () => {
    map?.deactivateAllHighlights();
    rangePanelDiv!.style.display = 'none';
    focusedLandmark = null;
  };
  header.appendChild(closeBtn);
  rangePanelDiv.appendChild(header);

  // Range Slider Section
  const rangeSection = document.createElement('div');
  rangeSection.innerHTML = `
    <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
        <label style="font-weight: 600; color: #444; font-size: 14px;">Time Limit</label>
        <span id="range-val-display" style="font-weight: 700; color: #2196f3; font-size: 14px;">${convertDuration(3600)}</span>
    </div>
  `;
  const rangeInput = document.createElement('input');
  rangeInput.type = 'range';
  rangeInput.min = '60';
  rangeInput.max = '10800';
  rangeInput.value = '3600';
  rangeInput.step = '60';
  rangeInput.style.cssText = `
    width: 100%; 
    accent-color: #2196f3; 
    height: 6px; 
    border-radius: 3px;
    cursor: pointer;
    margin-bottom: 8px;
  `;
  rangeInput.oninput = () => {
    const display = rangeSection.querySelector('#range-val-display');
    if (display) display.textContent = convertDuration(Number(rangeInput.value));
  };
  rangeSection.appendChild(rangeInput);
  rangePanelDiv.appendChild(rangeSection);

  // Transport Mode
  const transportSection = document.createElement('div');
  transportSection.innerHTML = `<label style="font-weight: 600; color: #444; font-size: 14px; display: block; margin-bottom: 8px;">Transport Mode</label>`;
  const transportSelect = document.createElement('select');
  transportSelect.style.cssText = `
    width: 100%; 
    padding: 12px; 
    border-radius: 12px; 
    border: 1px solid #e0e0e0; 
    background: #f5f5f5; 
    font-size: 14px; 
    color: #333; 
    outline: none;
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23007CB2%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E");
    background-repeat: no-repeat;
    background-position: right 12px top 50%;
    background-size: 10px auto;
  `;
  const modes = [
    { label: 'Car', value: RouteTransportMode.car },
    { label: 'Lorry', value: RouteTransportMode.lorry },
    { label: 'Pedestrian', value: RouteTransportMode.pedestrian },
    { label: 'Bicycle', value: RouteTransportMode.bicycle },
    { label: 'Public Transit', value: RouteTransportMode.public },
  ];
  modes.forEach((m) => {
    const opt = document.createElement('option');
    opt.value = String(m.value);
    opt.textContent = m.label;
    transportSelect.appendChild(opt);
  });
  transportSection.appendChild(transportSelect);
  rangePanelDiv.appendChild(transportSection);

  // Toggles Grid
  const togglesContainer = document.createElement('div');
  togglesContainer.style.cssText = `display: grid; grid-template-columns: 1fr 1fr; gap: 16px;`;

  const createToggle = (label: string, id: string) => {
    const wrapper = document.createElement('label');
    wrapper.style.cssText = `display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 13px; color: #555; user-select: none;`;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    input.style.accentColor = '#2196f3';
    input.style.width = '16px';
    input.style.height = '16px';
    wrapper.appendChild(input);
    wrapper.appendChild(document.createTextNode(label));
    return { wrapper, input };
  };

  const motorways = createToggle('Avoid Motorways', 'avoid-motorways');
  const tolls = createToggle('Avoid Tolls', 'avoid-tolls');
  const ferries = createToggle('Avoid Ferries', 'avoid-ferries');
  const unpaved = createToggle('Avoid Unpaved', 'avoid-unpaved');

  togglesContainer.appendChild(motorways.wrapper);
  togglesContainer.appendChild(tolls.wrapper);
  togglesContainer.appendChild(ferries.wrapper);
  togglesContainer.appendChild(unpaved.wrapper);
  rangePanelDiv.appendChild(togglesContainer);

  // Calculate Button
  const calcBtn = document.createElement('button');
  calcBtn.innerHTML = `${ICONS.calculate} Calculate Range`;
  calcBtn.style.cssText = `
    width: 100%; 
    padding: 14px; 
    background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%); 
    color: white; 
    border: none; 
    border-radius: 12px; 
    font-weight: 600; 
    font-size: 15px; 
    cursor: pointer; 
    display: flex; 
    align-items: center; 
    justify-content: center; 
    gap: 8px;
    box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
    transition: transform 0.1s, box-shadow 0.2s;
    margin-top: 8px;
  `;
  calcBtn.onmouseenter = () => (calcBtn.style.boxShadow = '0 6px 16px rgba(33, 150, 243, 0.4)');
  calcBtn.onmouseleave = () => (calcBtn.style.boxShadow = '0 4px 12px rgba(33, 150, 243, 0.3)');
  calcBtn.onmousedown = () => (calcBtn.style.transform = 'scale(0.98)');
  calcBtn.onmouseup = () => (calcBtn.style.transform = 'scale(1)');

  calcBtn.onclick = () => {
    if (!map || !focusedLandmark) return;
    // Gather preferences from UI
    const rangeValue = Number(rangeInput.value);
    const transportMode = Number(transportSelect.value); // RouteTransportMode enum value
    const avoidMotorways = motorways.input.checked;
    const avoidTollRoads = tolls.input.checked;
    const avoidFerries = ferries.input.checked;
    const avoidUnpavedRoads = unpaved.input.checked;

    // Build RoutePreferences
    const routePreferences = new RoutePreferences({
      avoidMotorways,
      avoidTollRoads,
      avoidFerries,
      avoidUnpavedRoads,
      transportMode,
      routeRanges: [rangeValue],
    });

    showMessage('Calculating range...');
    rangePanelDiv!.style.display = 'none'; // Hide panel while calculating

    RoutingService.calculateRoute(
      [focusedLandmark],
      routePreferences,
      (err: GemError, routes: Route[]) => {
        if (err === GemError.success && routes.length > 0) {
          // Color the range in a random color
          const randomColor = `rgba(${Math.floor(Math.random() * 200)},${Math.floor(Math.random() * 200)},${Math.floor(Math.random() * 200)},0.5)`;
          // Display the range on map
          if (map) {
            // Use RouteRenderSettings with options only (color not supported directly)
            const routeRenderSettings = new RouteRenderSettings({
              options: new Set([RouteRenderOptions.main]),
            });
            map.preferences.routes.add(routes[0], true, { routeRenderSettings });
            // Center the camera on range
            map.centerOnRoute(routes[0]);
          }
          // Add to local state
          routeRanges.push({
            route: routes[0],
            color: randomColor,
            transportMode,
            value: convertDuration(rangeValue),
            isEnabled: true,
          });
          showMessage('Range calculated successfully!');
          map?.deactivateAllHighlights();
          focusedLandmark = null;
        } else {
          showMessage('Range calculation failed.');
          rangePanelDiv!.style.display = 'flex'; // Show panel again on error
        }
      }
    );
  };
  rangePanelDiv.appendChild(calcBtn);
}
