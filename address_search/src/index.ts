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
  AddressDetailLevel,
  GemError,
  AnimationType,
  GuidedAddressSearchService,
  GemAnimation,
} from '@magiclane/maps-sdk';
import { GEMKIT_TOKEN, showMessage } from '../../shared';

let map: GemMap | null = null;

// Address search helper
function searchAddress({
  landmark,
  detailLevel,
  text,
}: {
  landmark: Landmark;
  detailLevel: AddressDetailLevel;
  text: string;
}): Promise<Landmark | null> {
  return new Promise((resolve) => {
    GuidedAddressSearchService.search(
      text,
      landmark,
      detailLevel,
      (err: GemError, results: Landmark[]) => {
        if (
          (err !== GemError.success && err !== GemError.reducedResult) ||
          !results ||
          results.length === 0
        ) {
          resolve(null);
        } else {
          resolve(results[0]);
        }
      }
    );
  });
}

// Highlight and center on a landmark
function presentLandmark(landmark: Landmark) {
  if (!map) return;
  map.activateHighlight([landmark]);
  const animation = new GemAnimation({ type: AnimationType.linear });
  map.centerOnCoordinates(landmark.coordinates, { zoomLevel: 50, animation: animation });
}

// Main search logic
async function onSearchButtonPressed() {
  showMessage('Search is in progress...');

  // 1. Country: Spain
  const countryLandmark = GuidedAddressSearchService.getCountryLevelItem('ESP');
  if (!countryLandmark) return showMessage('Country not found.');
  console.log('Country:', countryLandmark.name);

  // 2. City: Barcelona
  const cityLandmark = await searchAddress({
    landmark: countryLandmark,
    detailLevel: AddressDetailLevel.city,
    text: 'Barcelona',
  });
  if (!cityLandmark) return showMessage('City not found.');
  console.log('City:', cityLandmark.name);

  // 3. Street: Carrer de Mallorca
  const streetLandmark = await searchAddress({
    landmark: cityLandmark,
    detailLevel: AddressDetailLevel.street,
    text: 'Carrer de Mallorca',
  });
  if (!streetLandmark) return showMessage('Street not found.');
  console.log('Street:', streetLandmark.name);

  // 4. House number: 401
  const houseNumberLandmark = await searchAddress({
    landmark: streetLandmark,
    detailLevel: AddressDetailLevel.houseNumber,
    text: '401',
  });
  if (!houseNumberLandmark) return showMessage('House number not found.');
  console.log('House number:', houseNumberLandmark.name);

  presentLandmark(houseNumberLandmark);
  showMessage('Search complete!');
}

// Map setup
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

  const viewId = 1;
  const wrapper = gemKit.createView(viewId, (gemMap: GemMap) => {
    map = gemMap;
  });
  if (wrapper) container.appendChild(wrapper);

  // Add search button
  const searchBtn = document.createElement('button');
  searchBtn.textContent = 'Search Address';
  searchBtn.className = 'gem-button gem-button-primary gem-button-center';
  searchBtn.onclick = onSearchButtonPressed;
  document.body.appendChild(searchBtn);
});
