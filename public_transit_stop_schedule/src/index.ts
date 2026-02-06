// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

import {
  GemKit,
  GemMap,
  PositionService,
  Coordinates,
  GemError,
  CommonOverlayId,
} from '@magiclane/maps-sdk';
import { GEMKIT_TOKEN, showMessage } from '../../shared';

// Type for screen position coordinates
interface ScreenPosition {
  x: number;
  y: number;
}

// Types for public transit data (not exported from SDK)
interface PTRoute {
  routeType: string;
  routeShortName?: string;
  routeLongName?: string;
  routeColor?: string;
  routeTextColor?: string;
  heading?: string;
}

interface PTTrip {
  route: PTRoute;
  departureTime?: Date;
  stopTimes: PTStopTime[];
}

interface PTStopTime {
  stopName: string;
  departureTime?: Date;
}

interface PTStopInfo {
  trips: PTTrip[];
}

interface TimezoneResult {
  localTime: Date;
}

let map: GemMap | null = null;
let selectedPTStop: PTStopInfo | null = null;
let selectedPTStopCoords: Coordinates | null = null;
let selectedTrip: PTTrip | null = null;

// Get local time for coordinates
async function getLocalTime(referenceCoords: Coordinates): Promise<Date> {
  return new Promise((resolve, reject) => {
    // Using any types since TimezoneService and TimezoneResult are not exported
    (window as any).gem_kit?.TimezoneService?.getTimezoneInfoFromCoordinates?.(
      referenceCoords,
      new Date(),
      (error: GemError, result: TimezoneResult) => {
        if (error === GemError.success) {
          resolve(result.localTime);
        } else {
          reject(new Error('Failed to get timezone info'));
        }
      }
    ) || reject(new Error('TimezoneService not available'));
  });
}

// Get transport icon based on route type
function getTransportIcon(type: string): string {
  // Using string comparison since PTRouteType enum is not available
  switch (type) {
    case 'bus':
      return '🚌';
    case 'underground':
      return '🚇';
    case 'railway':
      return '🚆';
    case 'tram':
      return '🚊';
    case 'waterTransport':
      return '⛴️';
    case 'misc':
      return '🚌';
    default:
      return '🚌';
  }
}

// Calculate time difference for departure
function calculateTimeDifference(localCurrentTime: Date, ptTrip: PTTrip): string {
  if (!ptTrip.departureTime) return '–';

  const diffMs = ptTrip.departureTime.getTime() - localCurrentTime.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  return `${diffMinutes} min`;
}

// Format time as H:mm
function formatTime(date: Date): string {
  return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
}

// Create departure times panel
function createDepartureTimesPanel(stopTimes: PTStopTime[], localTime: Date): HTMLDivElement {
  const panel = document.createElement('div');
  panel.style.cssText = `
    display: flex; flex-direction: column; height: 100%;
    background: #fff; overflow: hidden;
  `;

  const listContainer = document.createElement('div');
  listContainer.style.cssText = `
    flex: 1; overflow-y: auto; background: #fff;
  `;

  stopTimes.forEach((stopTime, index) => {
    const itemDiv = document.createElement('div');
    itemDiv.style.cssText = `
      padding: 12px 16px; display: flex; justify-content: space-between; align-items: center;
      ${index < stopTimes.length - 1 ? 'border-bottom: 1px solid #e0e0e0;' : ''}
    `;

    const leftColumn = document.createElement('div');
    leftColumn.style.cssText = `
      flex: 1; display: flex; flex-direction: column; gap: 4px;
    `;

    const stopName = document.createElement('div');
    stopName.textContent = stopTime.stopName;
    stopName.style.cssText = `
      font-weight: 500; color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    `;

    const status = document.createElement('div');
    if (stopTime.departureTime) {
      status.textContent = stopTime.departureTime > localTime ? 'Scheduled' : 'Departed';
    }
    status.style.cssText = `
      font-size: 0.9em; color: #666;
    `;

    leftColumn.appendChild(stopName);
    if (stopTime.departureTime) leftColumn.appendChild(status);

    const timeDiv = document.createElement('div');
    timeDiv.textContent = stopTime.departureTime ? formatTime(stopTime.departureTime) : '–';
    timeDiv.style.cssText = `
      font-weight: 500; color: #000; margin-left: 8px;
    `;

    itemDiv.appendChild(leftColumn);
    itemDiv.appendChild(timeDiv);
    listContainer.appendChild(itemDiv);
  });

  panel.appendChild(listContainer);
  return panel;
}

// Create PT line list item
function createPTLineListItem(
  ptTrip: PTTrip,
  localCurrentTime: Date,
  onTap: () => void
): HTMLDivElement {
  const item = document.createElement('div');
  item.style.cssText = `
    padding: 12px 16px; display: flex; justify-content: space-between; align-items: center;
    cursor: pointer; transition: background-color 0.2s;
  `;

  item.addEventListener('mouseenter', () => {
    item.style.backgroundColor = '#f5f5f5';
  });
  item.addEventListener('mouseleave', () => {
    item.style.backgroundColor = 'transparent';
  });
  item.addEventListener('click', onTap);

  const leftSection = document.createElement('div');
  leftSection.style.cssText = `
    display: flex; align-items: center; gap: 12px;
  `;

  const iconDiv = document.createElement('div');
  iconDiv.style.fontSize = '24px';
  iconDiv.textContent = getTransportIcon(ptTrip.route.routeType);

  const infoColumn = document.createElement('div');
  infoColumn.style.cssText = `
    display: flex; flex-direction: column; gap: 4px;
  `;

  const routeBadge = document.createElement('div');
  routeBadge.textContent = ptTrip.route.routeShortName || 'None';
  routeBadge.style.cssText = `
    padding: 4px 15px; border-radius: 14px; font-weight: 500;
    background-color: ${ptTrip.route.routeColor || '#4caf50'};
    color: ${ptTrip.route.routeTextColor || '#fff'};
    display: inline-block; width: fit-content;
  `;

  const routeName = document.createElement('div');
  routeName.textContent = ptTrip.route.heading || ptTrip.route.routeLongName || 'N/A';
  routeName.style.cssText = `
    color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    max-width: 200px;
  `;

  const scheduleInfo = document.createElement('div');
  scheduleInfo.textContent = ptTrip.departureTime
    ? `Scheduled • ${formatTime(ptTrip.departureTime)}`
    : 'Scheduled • ';
  scheduleInfo.style.cssText = `
    font-size: 0.9em; color: #666;
  `;

  infoColumn.appendChild(routeBadge);
  infoColumn.appendChild(routeName);
  infoColumn.appendChild(scheduleInfo);

  leftSection.appendChild(iconDiv);
  leftSection.appendChild(infoColumn);

  const timeDiv = document.createElement('div');
  timeDiv.textContent = calculateTimeDifference(localCurrentTime, ptTrip);
  timeDiv.style.cssText = `
    font-weight: 500; color: #000;
  `;

  item.appendChild(leftSection);
  item.appendChild(timeDiv);

  return item;
}

// Create public transit stop panel
async function createPublicTransitStopPanel(
  ptStopInfo: PTStopInfo,
  localTime: Date
): Promise<HTMLDivElement> {
  const panel = document.createElement('div');
  panel.style.cssText = `
    position: fixed; bottom: 0; left: 0; right: 0;
    height: 60vh; background: #fff; display: flex; flex-direction: column;
    box-shadow: 0 -2px 8px rgba(0,0,0,0.1); z-index: 1000;
  `;

  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    width: 100%; background: #fff; padding: 12px 16px;
    display: flex; justify-content: space-between; align-items: center;
    border-bottom: 1px solid #e0e0e0;
  `;

  const backButton = document.createElement('button');
  backButton.innerHTML = '←';
  backButton.style.cssText = `
    background: none; border: none; font-size: 1.5em; cursor: pointer;
    width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;
    ${selectedTrip ? '' : 'opacity: 0; pointer-events: none;'}
  `;
  backButton.onclick = () => {
    selectedTrip = null;
    updatePublicTransitStopPanel();
  };

  const title = document.createElement('div');
  title.textContent = selectedTrip
    ? `Stops for ${selectedTrip.route.routeShortName}`
    : 'Select a Trip';
  title.style.cssText = `
    font-weight: 500; font-size: 1.1em; color: #000;
  `;

  const closeButton = document.createElement('button');
  closeButton.innerHTML = '✕';
  closeButton.style.cssText = `
    background: none; border: none; font-size: 1.2em; cursor: pointer;
    width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;
  `;
  closeButton.onclick = () => {
    selectedPTStop = null;
    selectedPTStopCoords = null;
    selectedTrip = null;
    updatePublicTransitStopPanel();
  };

  header.appendChild(backButton);
  header.appendChild(title);
  header.appendChild(closeButton);

  // Body
  const body = document.createElement('div');
  body.style.cssText = `
    flex: 1; overflow: hidden; background: #fff;
  `;

  if (!selectedTrip) {
    // Show list of trips
    const listContainer = document.createElement('div');
    listContainer.style.cssText = `
      height: 100%; overflow-y: auto;
    `;

    ptStopInfo.trips.forEach((trip: PTTrip, index: number) => {
      const tripItem = createPTLineListItem(trip, localTime, () => {
        selectedTrip = trip;
        updatePublicTransitStopPanel();
      });

      if (index < ptStopInfo.trips.length - 1) {
        tripItem.style.borderBottom = '1px solid #e0e0e0';
      }

      listContainer.appendChild(tripItem);
    });

    body.appendChild(listContainer);
  } else {
    // Show departure times
    const departurePanel = createDepartureTimesPanel(selectedTrip.stopTimes, localTime);
    body.appendChild(departurePanel);
  }

  panel.appendChild(header);
  panel.appendChild(body);

  return panel;
}

// Update the public transit stop panel
async function updatePublicTransitStopPanel() {
  let panel = document.getElementById('pt-stop-panel');
  if (panel) panel.remove();

  if (!selectedPTStop || !selectedPTStopCoords) return;

  try {
    const localTime = await getLocalTime(selectedPTStopCoords);
    panel = await createPublicTransitStopPanel(selectedPTStop, localTime);
    panel.id = 'pt-stop-panel';
    document.body.appendChild(panel);
  } catch (error) {
    console.error('Error creating PT stop panel:', error);
    showMessage('Error loading stop information');
  }
}

// Register long press callback for selecting PT stops
function registerLongPressCallback() {
  if (!map) return;

  map.registerLongPressCallback(async (pos: ScreenPosition) => {
    await map!.setCursorScreenPosition(pos);

    const items = map!.cursorSelectionOverlayItemsByType(CommonOverlayId.PublicTransport);
    const coords = map!.transformScreenToWgs(pos);

    for (const item of items) {
      const ptStopInfo = await item.getPTStopInfo();
      if (ptStopInfo) {
        selectedPTStop = ptStopInfo;
        selectedPTStopCoords = coords;
        selectedTrip = null;
        updatePublicTransitStopPanel();
        break;
      }
    }
  });
}

// Setup UI elements
function setupUI() {
  // Create app bar
  const appBar = document.createElement('div');
  appBar.style.cssText = `
    width: 100%; height: 56px; background: #4527a0; color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.2em; font-weight: 500; position: fixed; top: 0; left: 0; z-index: 1000;
    box-shadow: 0 2px 8px rgba(0,0,0,0.10);
  `;
  appBar.textContent = 'Public Transit Stops';
  document.body.appendChild(appBar);

  // Create map container
  //   const mapContainer = document.createElement('div');
  //   mapContainer.id = 'map-container';
  //   mapContainer.style.cssText = `
  //     position: absolute; top: 56px; left: 0;
  //     width: 100%; height: calc(100vh - 56px);
  //   `;

  //   document.body.appendChild(mapContainer);
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

  const container = document.getElementById('map-container');
  if (!container) throw new Error('Map container not found');

  const viewId = 12;
  const wrapper = gemKit.createView(viewId, (gemMap: GemMap) => {
    map = gemMap;
    registerLongPressCallback();
  });
  if (wrapper) container.appendChild(wrapper);
});
