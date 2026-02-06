// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

import {
  GemKit,
  GemMap,
  PositionService,
  Landmark,
  LandmarkCategory,
  SearchPreferences,
  SearchService,
  GemError,
  HighlightRenderSettings,
  HighlightOptions,
  AddressField,
  GemIcon,
} from '@magiclane/maps-sdk';
import { GEMKIT_TOKEN, showMessage, ICONS } from '../../shared';

let map: GemMap | null = null;
let selectedCategories: LandmarkCategory[] = [];
let searchResults: Landmark[] = [];
let categories: LandmarkCategory[] = [];

// UI References
let sidebarPanel: HTMLDivElement;
let searchBtn: HTMLButtonElement;
let resultsContainer: HTMLDivElement;
let searchInput: HTMLInputElement;

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

  // Search Category button (Top Center)
  searchBtn = document.createElement('button');
  searchBtn.innerHTML = `${ICONS.search} Search Categories`;
  searchBtn.className = 'gem-button gem-button-primary gem-button-center';
  searchBtn.onclick = () => toggleSidebar(true);
  document.body.appendChild(searchBtn);

  // Fetch categories from SDK
  try {
    categories = (window as any).GenericCategories?.categories || [];
    renderCategories(); // Render chips once loaded
  } catch (error) {
    categories = [];
  }
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
  header.innerHTML = `<h2 style="margin:0; font-size: 20px; color:#333;">Search</h2>`;

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = ICONS.close;
  closeBtn.style.cssText = `background:none; border:none; cursor:pointer; color:#666; padding:5px;`;
  closeBtn.onclick = () => toggleSidebar(false);
  header.appendChild(closeBtn);
  sidebarPanel.appendChild(header);

  // --- Search Input Area ---
  const inputContainer = document.createElement('div');
  inputContainer.style.cssText = `padding: 20px; background: #f9f9f9; border-bottom: 1px solid #eee;`;

  searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'e.g. restaurant, Hotel...';
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
  searchActionBtn.textContent = 'Search Area';
  searchActionBtn.style.cssText = `
    width: 100%; margin-top: 12px; padding: 10px; background: #673ab7; color: white;
    border: none; border-radius: 8px; font-weight: 600; cursor: pointer;
  `;
  searchActionBtn.onclick = () => performSearch(searchInput.value);

  inputContainer.appendChild(searchInput);
  inputContainer.appendChild(searchActionBtn);
  sidebarPanel.appendChild(inputContainer);

  // --- Categories Container ---
  const catLabel = document.createElement('div');
  catLabel.innerHTML = `${ICONS.filter} <span style="font-weight:600; font-size:13px; text-transform:uppercase; color:#888;">Filter by Category</span>`;
  catLabel.style.cssText = `padding: 15px 20px 5px 20px; display:flex; align-items:center; gap:6px;`;
  sidebarPanel.appendChild(catLabel);

  const categoriesContainer = document.createElement('div');
  categoriesContainer.id = 'categories-list';
  categoriesContainer.style.cssText = `
    padding: 10px 20px; display: flex; flex-wrap: wrap; gap: 8px; max-height: 150px; overflow-y: auto;
  `;
  sidebarPanel.appendChild(categoriesContainer);

  // --- Results List ---
  const resultsLabel = document.createElement('div');
  resultsLabel.innerHTML = `<span style="font-weight:600; font-size:13px; text-transform:uppercase; color:#888;">Results</span>`;
  resultsLabel.style.cssText = `padding: 10px 20px 5px 20px; border-top: 1px solid #eee;`;
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

function renderCategories() {
  const container = document.getElementById('categories-list');
  if (!container) return;
  container.innerHTML = '';

  categories.forEach((cat) => {
    const chip = document.createElement('button');
    const isActive = selectedCategories.includes(cat);
    chip.textContent = cat.name;
    chip.style.cssText = `
            padding: 6px 14px; border-radius: 20px; font-size: 13px; cursor: pointer;
            border: 1px solid ${isActive ? '#673ab7' : '#ddd'};
            background: ${isActive ? '#ede7f6' : '#fff'};
            color: ${isActive ? '#673ab7' : '#555'};
            transition: all 0.2s;
        `;
    chip.onclick = () => {
      if (selectedCategories.includes(cat)) {
        selectedCategories = selectedCategories.filter((c) => c !== cat);
      } else {
        selectedCategories.push(cat);
      }
      renderCategories(); // Re-render to update state
    };
    container.appendChild(chip);
  });
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
            <div style="margin-top:2px;">${ICONS.pin}</div>
            <div>
                <div style="font-weight:600; color:#333; font-size:14px;">${lmk.name}</div>
                <div style="color:#666; font-size:12px; margin-top:2px;">${getFormattedDistance(lmk)} • ${getAddress(lmk)}</div>
            </div>
        `;

    item.onmouseenter = () => (item.style.background = '#f5f5f5');
    item.onmouseleave = () => (item.style.background = '#fff');
    item.onclick = () => selectSearchResult(lmk);

    resultsContainer.appendChild(item);
  });
}

function performSearch(text: string) {
  if (!map) return;

  showMessage('Searching...');

  // Get center coordinates of the map view
  const container = document.getElementById('map-container');
  const x = container ? container.offsetWidth / 2 : 400;
  const y = container ? container.offsetHeight / 2 : 300;

  // Note: Using a fallback if transformScreenToWgs is not immediately available or coordinates are invalid
  let coords;
  try {
    coords = map.transformScreenToWgs({ x: Math.floor(x), y: Math.floor(y) });
  } catch (e) {
    // Fallback to a default if map isn't ready (demo safety)
  }

  if (!coords) {
    showMessage('Map not ready.');
    return;
  }

  // Set up search preferences
  const preferences = SearchPreferences.create({
    maxMatches: 40,
    allowFuzzyResults: true,
    searchMapPOIs: true,
    searchAddresses: false,
  });

  // Add selected categories
  selectedCategories.forEach((cat) => {
    if (preferences.landmarks && preferences.landmarks.addStoreCategoryId) {
      preferences.landmarks.addStoreCategoryId(cat.landmarkStoreId, cat.id);
    }
  });

  // Call SDK search
  SearchService.searchAroundPosition({
    position: coords,
    preferences: preferences,
    textFilter: text,
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
    const street = addressInfo.getField?.(AddressField.streetName) || '';
    const city = addressInfo.getField?.(AddressField.city) || '';

    if (!street && !city) return '';
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
  showMessage(`Selected: ${landmark.name}`);

  // On mobile-ish layouts, maybe close sidebar. For desktop, keep it open.
  if (window.innerWidth < 600) toggleSidebar(false);
}
