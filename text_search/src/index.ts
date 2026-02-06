// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

import {
  GemKit,
  GemMap,
  Coordinates,
  Landmark,
  HighlightRenderSettings,
  SearchService,
  SearchPreferences,
  GemError,
  AddressField,
  ImageFileFormat,
  HighlightOptions,
  GemIcon,
} from '@magiclane/maps-sdk';

import { GEMKIT_TOKEN, showMessage, ICONS } from '../../shared';

let map: GemMap | null = null;
let searchResults: Landmark[] = [];

// UI References
let sidebarPanel: HTMLDivElement;
let searchBtn: HTMLButtonElement;
let resultsContainer: HTMLDivElement;
let searchInput: HTMLInputElement;

// Extension methods for Landmark
function getAddress(landmark: Landmark): string {
  try {
    const addressInfo = landmark.address;
    const street = addressInfo.getField(AddressField.streetName) || '';
    const city = addressInfo.getField(AddressField.city) || '';
    const country = addressInfo.getField(AddressField.country) || '';
    return [street, city, country].filter(Boolean).join(', ');
  } catch {
    return '';
  }
}

function getFormattedDistance(landmark: Landmark): string {
  try {
    const distance = landmark.extraInfo?.getByKey?.('gmSearchResultDistance') || 0;
    const km = distance / 1000;
    return `${km.toFixed(1)} km`;
  } catch {
    return '';
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
  const wrapper = gemKit.createView(viewId, (gemMap: GemMap) => {
    map = gemMap;
  });
  if (wrapper) container.appendChild(wrapper);

  // Initialize UI
  createSidebar();

  // Search Button
  searchBtn = document.createElement('button');
  searchBtn.innerHTML = `${ICONS.search} Search`;
  searchBtn.className = 'gem-button gem-button-primary gem-button-center';
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
  header.innerHTML = `<h2 style="margin:0; font-size: 20px; color:#333;">Text Search</h2>`;

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = ICONS.close;
  closeBtn.style.cssText = `background:none; border:none; cursor:pointer; color:#666; padding:5px;`;
  closeBtn.onclick = () => toggleSidebar(false);
  header.appendChild(closeBtn);
  sidebarPanel.appendChild(header);

  // --- Input Area ---
  const inputContainer = document.createElement('div');
  inputContainer.style.cssText = `padding: 20px; background: #f9f9f9; border-bottom: 1px solid #eee;`;

  searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search places...';
  searchInput.style.cssText = `
    width: 100%; padding: 12px 16px; border: 1px solid #ddd; border-radius: 8px;
    font-size: 16px; outline: none; box-sizing: border-box; transition: border-color 0.2s;
  `;
  searchInput.onfocus = () => (searchInput.style.borderColor = '#673ab7');
  searchInput.onblur = () => (searchInput.style.borderColor = '#ddd');
  searchInput.onkeydown = (e) => {
    if (e.key === 'Enter') performSearch(searchInput.value);
  };

  const searchActionBtn = document.createElement('button');
  searchActionBtn.textContent = 'Go';
  searchActionBtn.style.cssText = `
    width: 100%; margin-top: 12px; padding: 10px; background: #673ab7; color: white;
    border: none; border-radius: 8px; font-weight: 600; cursor: pointer;
  `;
  searchActionBtn.onclick = () => performSearch(searchInput.value);

  inputContainer.appendChild(searchInput);
  inputContainer.appendChild(searchActionBtn);
  sidebarPanel.appendChild(inputContainer);

  // --- Results List ---
  const resultsLabel = document.createElement('div');
  resultsLabel.innerHTML = `<span style="font-weight:600; font-size:13px; text-transform:uppercase; color:#888;">Results</span>`;
  resultsLabel.style.cssText = `padding: 15px 20px 5px 20px;`;
  sidebarPanel.appendChild(resultsLabel);

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
    if (show && searchInput) setTimeout(() => searchInput.focus(), 100);
  }
}

async function performSearch(text: string) {
  if (!text.trim() || !map) return;

  // Calculate center of current view
  const container = document.getElementById('map-container');
  const x = container ? container.offsetWidth / 2 : window.innerWidth / 2;
  const y = container ? container.offsetHeight / 2 : window.innerHeight / 2;

  let coordinates;
  try {
    coordinates = map.transformScreenToWgs({ x: Math.floor(x), y: Math.floor(y) });
  } catch (e) {}

  if (!coordinates) {
    showMessage('Map not ready.');
    return;
  }

  resultsContainer.innerHTML =
    '<div style="padding: 20px; text-align: center; color: #888;">Searching...</div>';

  const preferences = SearchPreferences.create({
    maxMatches: 40,
    searchAddresses: true,
    searchMapPOIs: true,
  });

  return new Promise<void>((resolve) => {
    SearchService.search({
      textFilter: text,
      referenceCoordinates: coordinates,
      preferences: preferences,
      onCompleteCallback: (err: GemError, results: Landmark[]) => {
        if (err !== GemError.success) {
          resultsContainer.innerHTML =
            '<div style="padding: 20px; text-align: center; color: #888;">No results found</div>';
          searchResults = [];
          resolve();
          return;
        }

        searchResults = results;
        renderSearchResults(resultsContainer);
        resolve();
      },
    });
  });
}

function renderSearchResults(container: HTMLElement) {
  container.innerHTML = '';

  if (searchResults.length === 0) {
    container.innerHTML =
      '<div style="padding: 20px; text-align: center; color: #888;">No results found</div>';
    return;
  }

  searchResults.forEach((landmark) => {
    const resultItem = createSearchResultItem(landmark);
    container.appendChild(resultItem);
  });
}

function createSearchResultItem(landmark: Landmark): HTMLElement {
  const item = document.createElement('div');
  item.style.cssText = `
    padding: 12px; border: 1px solid #eee; border-radius: 8px; cursor: pointer;
    display: flex; align-items: center; gap: 12px; transition: background-color 0.2s;
    margin-bottom: 8px;
  `;

  item.addEventListener('mouseenter', () => (item.style.backgroundColor = '#f5f5f5'));
  item.addEventListener('mouseleave', () => (item.style.backgroundColor = 'transparent'));

  // Icon container
  const iconContainer = document.createElement('div');
  iconContainer.style.cssText = `
    width: 40px; height: 40px; flex-shrink: 0; display: flex;
    align-items: center; justify-content: center; background: #f3e5f5; border-radius: 8px; color: #673ab7;
  `;

  // Try to get actual image, fallback to SVG
  let hasImage = false;
  try {
    const imageData = landmark.getImage({ width: 40, height: 40 }, ImageFileFormat.png);
    if (imageData && imageData.byteLength > 0) {
      const img = document.createElement('img');
      const blob = new Blob([new Uint8Array(imageData.buffer as ArrayBuffer)], {
        type: 'image/png',
      });
      img.src = URL.createObjectURL(blob);
      img.style.cssText = 'width: 100%; height: 100%; object-fit: contain; border-radius: 6px;';
      iconContainer.innerHTML = '';
      iconContainer.style.background = 'transparent';
      iconContainer.appendChild(img);
      hasImage = true;
    }
  } catch (error) {
    // Ignore error, use default
  }

  if (!hasImage) {
    iconContainer.innerHTML = ICONS.pin;
  }

  // Text content
  const textContainer = document.createElement('div');
  textContainer.style.cssText = 'flex-grow: 1; overflow: hidden;';

  const name = document.createElement('div');
  name.textContent = landmark.name || 'Unnamed location';
  name.style.cssText = `
    font-weight: 600; color: #333; white-space: nowrap; font-size: 14px;
    overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px;
  `;

  const details = document.createElement('div');
  details.innerHTML = `<span style="color:#673ab7; font-weight:500;">${getFormattedDistance(landmark)}</span> • ${getAddress(landmark)}`;
  details.style.cssText = `
    font-size: 12px; color: #666; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis;
  `;

  textContainer.appendChild(name);
  textContainer.appendChild(details);
  item.appendChild(iconContainer);
  item.appendChild(textContainer);

  item.onclick = () => selectSearchResult(landmark);

  return item;
}

async function selectSearchResult(landmark: Landmark) {
  if (!map) return;

  // Activating the highlight
  try {
    const renderSettings = new HighlightRenderSettings({
      options: new Set([HighlightOptions.showLandmark]),
    });
    // Try to ensure icon is set for the map pin if it wasn't fetched earlier
    try {
      landmark.setImageFromIcon(GemIcon.searchResultsPin);
    } catch (e) {}

    map.activateHighlight([landmark], { renderSettings });
  } catch {
    map.activateHighlight([landmark]);
  }

  // Centering the map on the desired coordinates
  if (landmark.coordinates) {
    map.centerOnCoordinates(landmark.coordinates, { zoomLevel: 70 });
  }

  showMessage(`Selected: ${landmark.name}`);

  // Always close sidebar on selection
  toggleSidebar(false);
}
