// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

import {
  GemKit,
  GemMap,
  Coordinates,
  PositionService,
  SearchService,
  SearchPreferences,
  Landmark,
  GemError,
  GemAnimation,
  AnimationType,
  GenericCategories,
  HighlightRenderSettings,
  HighlightOptions,
  ImageFileFormat,
  GemIcon,
  GenericCategory,
} from '@magiclane/maps-sdk';
import {
  GEMKIT_TOKEN,
  ICONS,
  showMessage,
  styleButton,
  convertDistance,
  BUTTON_COLORS,
  styles,
  applyStyles,
  mergeStyles,
  createSidebar,
  createSidebarHeader,
  createCard,
  createSpinner,
  createCloseButton,
  initializeSDK,
  createMapView,
  EventListenerManager,
} from '../../shared';

let map: GemMap | null = null;
let hasLiveDataSource = false;
let currentPosition: Coordinates | null = null;

// Event listener manager for proper cleanup
const events = new EventListenerManager();

// Default position: Brasov, Romania
const defaultPosition = new Coordinates({
  latitude: 45.6427,
  longitude: 25.5887,
  altitude: 0.0,
});

// UI Elements
let sidebarPanel: HTMLDivElement;
let resultsContainer: HTMLDivElement;
let whatIsNearbyBtn: HTMLButtonElement;
let followBtn: HTMLButtonElement | null = null;

// Get current location
async function getCurrentLocation(): Promise<void> {
  try {
    const permissionGranted = await PositionService.requestLocationPermission();

    if (permissionGranted) {
      if (!hasLiveDataSource) {
        PositionService.instance.setLiveDataSource();
        hasLiveDataSource = true;
      }

      currentPosition = PositionService.instance.position?.coordinates || null;

      if (currentPosition && map) {
        const animation = new GemAnimation({ type: AnimationType.linear });
        map.startFollowingPosition({ animation });
        showMessage('Location access granted.');
      } else {
        showMessage('Waiting for position...');
      }
    } else {
      showMessage('Location permission denied. Using default.');
    }
  } catch (error) {
    console.error('Error getting location:', error);
    showMessage('Error accessing location');
  }
}

// Get nearby locations around a position
async function getNearbyLocations(position: Coordinates): Promise<Landmark[]> {
  return new Promise((resolve) => {
    try {
      const preferences = SearchPreferences.create({
        searchAddresses: false,
        maxMatches: 50,
      });

      const genericCategories = GenericCategories.categories;
      if (genericCategories && preferences.landmarks) {
        genericCategories.forEach((category: GenericCategory) => {
          if (category.landmarkStoreId && category.id) {
            preferences.landmarks.addStoreCategoryId(category.landmarkStoreId, category.id);
          }
        });
      }

      SearchService.searchAroundPosition({
        position,
        preferences,
        onCompleteCallback: (err: GemError, results: Landmark[]) => {
          if (err === GemError.success && results) {
            resolve(results);
          } else {
            resolve([]);
          }
        },
      });
    } catch (error) {
      console.error('Error in nearby search:', error);
      resolve([]);
    }
  });
}

// UI Creation
function initSidebar() {
  // Use shared sidebar component
  sidebarPanel = createSidebar();

  // Header using shared component
  const header = createSidebarHeader("What's Nearby", () => toggleSidebar(false));
  sidebarPanel.appendChild(header);

  // Results Container
  resultsContainer = document.createElement('div');
  applyStyles(resultsContainer, {
    flex: '1',
    overflowY: 'auto',
    padding: '10px 20px',
    background: '#fff',
  });
  sidebarPanel.appendChild(resultsContainer);

  document.body.appendChild(sidebarPanel);
}

function toggleSidebar(show: boolean) {
  if (sidebarPanel) {
    sidebarPanel.style.transform = show ? 'translateX(0)' : 'translateX(-105%)';
  }
}

async function performSearch() {
  toggleSidebar(true);

  // Use shared spinner component
  resultsContainer.innerHTML = '';
  const spinnerContainer = createSpinner();
  spinnerContainer.appendChild(document.createTextNode('Scanning area...'));
  resultsContainer.appendChild(spinnerContainer);

  const searchPosition = currentPosition || defaultPosition;
  const normalizedPosition = new Coordinates({
    latitude: searchPosition.latitude,
    longitude: searchPosition.longitude,
    altitude: 0.0,
  });

  try {
    const nearbyLandmarks = await getNearbyLocations(normalizedPosition);
    renderResults(nearbyLandmarks, normalizedPosition);
  } catch (e) {
    resultsContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: #e74c3c;">Error loading locations</div>`;
  }
}

function renderResults(landmarks: Landmark[], currentPos: Coordinates) {
  resultsContainer.innerHTML = '';

  if (landmarks.length === 0) {
    const emptyState = document.createElement('div');
    applyStyles(
      emptyState,
      mergeStyles(styles.textMuted, {
        padding: '20px',
        textAlign: 'center',
      })
    );
    emptyState.textContent = 'No locations found nearby.';
    resultsContainer.appendChild(emptyState);
    return;
  }

  landmarks.forEach((landmark) => {
    // Use shared card component
    const item = createCard(() => {
      if (map && landmark.coordinates) {
        map.centerOnCoordinates(landmark.coordinates, { zoomLevel: 70 });
        try {
          const renderSettings = new HighlightRenderSettings({
            options: new Set([HighlightOptions.showLandmark]),
          });
          try {
            landmark.setImageFromIcon(GemIcon.searchResultsPin);
          } catch (e) {}
          map.activateHighlight([landmark], { renderSettings });
        } catch (e) {
          map.activateHighlight([landmark]);
        }
        if (window.innerWidth < 600) toggleSidebar(false);
      }
    });

    // Icon / Image
    const iconDiv = document.createElement('div');
    applyStyles(iconDiv, styles.iconContainer);

    let hasImage = false;
    try {
      const imageData = landmark.getImage({ width: 48, height: 48 }, ImageFileFormat.png);
      if (imageData && imageData.byteLength > 0) {
        const img = document.createElement('img');
        const blob = new Blob([new Uint8Array(imageData.buffer as ArrayBuffer)], {
          type: 'image/png',
        });
        img.src = URL.createObjectURL(blob);
        applyStyles(img, { width: '100%', height: '100%', objectFit: 'cover' });
        iconDiv.appendChild(img);
        hasImage = true;
      }
    } catch (e) {}

    if (!hasImage) {
      iconDiv.innerHTML = ICONS.pin;
    }

    // Text
    const contentDiv = document.createElement('div');
    applyStyles(contentDiv, { flex: '1', minWidth: '0' });

    const name =
      landmark.name ||
      (landmark.categories && landmark.categories.length > 0
        ? landmark.categories[0].name
        : 'Unknown');
    const dist = landmark.coordinates
      ? convertDistance(landmark.coordinates.distance(currentPos))
      : '';

    const nameEl = document.createElement('div');
    applyStyles(nameEl, {
      fontWeight: '600',
      color: '#333',
      fontSize: '14px',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    });
    nameEl.textContent = name;

    const distEl = document.createElement('div');
    applyStyles(distEl, {
      color: '#673ab7',
      fontSize: '12px',
      fontWeight: '500',
      marginTop: '2px',
    });
    distEl.textContent = `${dist} away`;

    contentDiv.appendChild(nameEl);
    contentDiv.appendChild(distEl);

    item.appendChild(iconDiv);
    item.appendChild(contentDiv);

    resultsContainer.appendChild(item);
  });
}

function showFollowButton() {
  if (followBtn) return;

  followBtn = document.createElement('button');
  followBtn.innerHTML = `${ICONS.navigation} <span style="margin-left:8px;">Recenter</span>`;
  applyStyles(
    followBtn,
    mergeStyles(styles.buttonBase, styles.buttonSecondary, styles.fixed, {
      bottom: '30px',
      right: '20px',
      left: 'auto',
      top: 'auto',
      transform: 'none',
      fontSize: '14px',
      padding: '12px 20px',
      zIndex: '2100',
      transition: 'transform 0.2s',
    })
  );

  followBtn.onclick = () => map?.startFollowingPosition?.();
  followBtn.onmouseenter = () => (followBtn!.style.transform = 'scale(1.05)');
  followBtn.onmouseleave = () => (followBtn!.style.transform = 'scale(1)');

  document.body.appendChild(followBtn);
}

// Initialization
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
  const wrapper = createMapView(gemKit, container, viewId, async (gemMap: GemMap) => {
    map = gemMap;
    map.centerOnCoordinates(defaultPosition, { zoomLevel: 50 });
    await getCurrentLocation();
  });

  if (!wrapper) {
    console.error('Failed to create map view');
    return;
  }

  initSidebar();

  // "What's Nearby" button
  whatIsNearbyBtn = document.createElement('button');
  whatIsNearbyBtn.innerHTML = `${ICONS.nearby} What's Nearby`;
  styleButton(whatIsNearbyBtn, BUTTON_COLORS.purple.primary, BUTTON_COLORS.purple.hover, {
    display: 'flex',
  });
  whatIsNearbyBtn.onclick = () => performSearch();
  document.body.appendChild(whatIsNearbyBtn);

  showFollowButton();

  // Register cleanup on page unload
  events.add(window, 'beforeunload', () => {
    events.cleanup();
  });
});
