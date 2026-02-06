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
  SearchPreferences,
  SearchService,
  GemError,
  HighlightRenderSettings,
  HighlightOptions,
  AddressField,
  GemIcon,
} from '@magiclane/maps-sdk';
import { GEMKIT_TOKEN, showMessage, ICONS, styleButton } from '../../shared';

// Pin icon with red fill for search results
const PIN_ICON = `<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 0 24 24" width="20" fill="#f44336"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;

let map: GemMap | null = null;
let searchResults: Landmark[] = [];

// UI References
let sidebarPanel: HTMLDivElement;
let searchBtn: HTMLButtonElement;
let resultsContainer: HTMLDivElement;
let latInput: HTMLInputElement;
let lngInput: HTMLInputElement;

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

  // Initialize UI
  createSidebar();

  // Search Location button
  searchBtn = document.createElement('button');
  searchBtn.innerHTML = `${ICONS.search} Search Location`;
  styleButton(searchBtn, '#673ab7', '#7e57c2', { display: 'flex' });
  searchBtn.onclick = () => toggleSidebar(true);
  document.body.appendChild(searchBtn);
});

function createSidebar() {
  sidebarPanel = document.createElement('div');
  sidebarPanel.style.cssText = `
    position: fixed; top: 0; left: 0; bottom: 0; width: 360px;
    background: #fff; z-index: 2500;
    box-shadow: 4px 0 20px rgba(0,0,0,0.1);
    transform: translateX(-105%);
    transition: transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
    display: flex; flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  `;

  // --- Header ---
  const header = document.createElement('div');
  header.style.cssText = `
    padding: 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;
  `;
  header.innerHTML = `<h2 style="margin:0; font-size: 20px; color:#333;">Search Area</h2>`;

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = ICONS.closeLarge;
  closeBtn.style.cssText = `background:none; border:none; cursor:pointer; color:#666; padding:5px;`;
  closeBtn.onclick = () => toggleSidebar(false);
  header.appendChild(closeBtn);
  sidebarPanel.appendChild(header);

  // --- Input Area ---
  const inputContainer = document.createElement('div');
  inputContainer.style.cssText = `padding: 20px; background: #f9f9f9; border-bottom: 1px solid #eee; display:flex; flex-direction:column; gap:12px;`;

  // Latitude
  latInput = document.createElement('input');
  latInput.type = 'text';
  latInput.placeholder = 'Latitude (e.g. 48.85)';
  latInput.style.cssText = `width: 100%; padding: 12px 16px; border: 1px solid #ddd; border-radius: 8px; font-size: 16px; outline: none; box-sizing: border-box;`;

  // Longitude
  lngInput = document.createElement('input');
  lngInput.type = 'text';
  lngInput.placeholder = 'Longitude (e.g. 2.35)';
  lngInput.style.cssText = `width: 100%; padding: 12px 16px; border: 1px solid #ddd; border-radius: 8px; font-size: 16px; outline: none; box-sizing: border-box;`;

  const searchActionBtn = document.createElement('button');
  searchActionBtn.textContent = 'Search';
  searchActionBtn.style.cssText = `
    width: 100%; padding: 12px; background: #673ab7; color: white;
    border: none; border-radius: 8px; font-weight: 600; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 8px;
  `;
  searchActionBtn.onclick = () => performSearch(latInput.value, lngInput.value);

  inputContainer.appendChild(latInput);
  inputContainer.appendChild(lngInput);
  inputContainer.appendChild(searchActionBtn);
  sidebarPanel.appendChild(inputContainer);

  // --- Results Label ---
  const resultsLabel = document.createElement('div');
  resultsLabel.innerHTML = `<span style="font-weight:600; font-size:13px; text-transform:uppercase; color:#888;">Results</span>`;
  resultsLabel.style.cssText = `padding: 15px 20px 5px 20px;`;
  sidebarPanel.appendChild(resultsLabel);

  // --- Results List ---
  resultsContainer = document.createElement('div');
  resultsContainer.style.cssText = `
    flex: 1; overflow-y: auto; padding: 10px 20px; background: #fff;
  `;
  sidebarPanel.appendChild(resultsContainer);

  document.body.appendChild(sidebarPanel);
}

function toggleSidebar(show: boolean) {
  if (sidebarPanel) {
    sidebarPanel.style.transform = show ? 'translateX(0)' : 'translateX(-105%)';
  }
}

function renderResults() {
  resultsContainer.innerHTML = '';

  if (searchResults.length === 0) {
    resultsContainer.innerHTML = `<div style="text-align:center; color:#999; margin-top:20px;">No results found.</div>`;
    return;
  }

  searchResults.forEach((lmk) => {
    const item = document.createElement('div');
    item.style.cssText = `
            padding: 12px; margin-bottom: 8px; border: 1px solid #eee; border-radius: 8px;
            cursor: pointer; transition: background 0.2s; display: flex; gap: 12px;
        `;

    item.innerHTML = `
            <div style="margin-top:2px;">${PIN_ICON}</div>
            <div>
                <div style="font-weight:600; color:#333; font-size:14px;">${lmk.name || 'Unknown Location'}</div>
                <div style="color:#666; font-size:12px; margin-top:2px;">${getFormattedDistance(lmk)} • ${getAddress(lmk)}</div>
            </div>
        `;

    item.onmouseenter = () => (item.style.background = '#f5f5f5');
    item.onmouseleave = () => (item.style.background = '#fff');
    item.onclick = () => selectSearchResult(lmk);

    resultsContainer.appendChild(item);
  });
}

function performSearch(lat: string, lng: string) {
  if (!map) return;
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lng);

  if (isNaN(latitude) || isNaN(longitude)) {
    showMessage('Invalid latitude or longitude');
    return;
  }

  showMessage('Searching...');
  const coords = Coordinates.fromLatLong(latitude, longitude);

  const preferences = SearchPreferences.create({
    maxMatches: 40,
    allowFuzzyResults: true,
  });

  SearchService.searchAroundPosition({
    position: coords,
    preferences,
    onCompleteCallback: (err: GemError, results: Landmark[]) => {
      if (err !== GemError.success) {
        showMessage('No results found');
        searchResults = [];
        renderResults();
        return;
      }
      searchResults = results;
      renderResults();
    },
  });
}

function getFormattedDistance(landmark: Landmark): string {
  try {
    const dist = landmark.extraInfo?.getByKey?.('gmSearchResultDistance') || 0;
    const km = (dist / 1000).toFixed(1);
    return `${km} km`;
  } catch {
    return '';
  }
}

function getAddress(landmark: Landmark): string {
  try {
    const addressInfo = landmark.address || {};
    const street = addressInfo.getField(AddressField.streetName) || '';
    const city = addressInfo.getField(AddressField.city) || '';

    if (!street && !city) return 'Address not available';
    return [street, city].filter(Boolean).join(', ');
  } catch {
    return '';
  }
}

function selectSearchResult(landmark: Landmark) {
  if (!map) return;
  // Highlight the landmark
  try {
    const renderSettings = new HighlightRenderSettings({
      options: new Set([HighlightOptions.showLandmark]),
    });

    // Ensure icon
    try {
      landmark.setImageFromIcon(GemIcon.searchResultsPin);
    } catch (e) {}

    map.activateHighlight([landmark], { renderSettings });
  } catch {
    map.activateHighlight([landmark]);
  }
  // Center map on landmark
  if (landmark.coordinates) {
    map.centerOnCoordinates(landmark.coordinates, { zoomLevel: 70 });
  }
  // Show message
  showMessage(`Selected: ${landmark.name}`);

  // Close sidebar on mobile
  if (window.innerWidth < 600) toggleSidebar(false);
}
