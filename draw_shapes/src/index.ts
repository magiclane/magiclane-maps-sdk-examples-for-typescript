// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

import {
  GemKit,
  GemMap,
  Coordinates,
  PositionService,
  Marker,
  MarkerCollection,
  MarkerType,
  MarkerCollectionRenderSettings,
} from '@magiclane/maps-sdk';
import {
  GEMKIT_TOKEN,
  ICONS,
  showMessage,
  styleButton,
  initializeSDK,
  createMapView,
  EventListenerManager,
} from '../../shared';

let map: GemMap | null = null;

// Event listener manager for proper cleanup
const events = new EventListenerManager();

async function showMarkerCollectionOnMap(markerCollection: MarkerCollection) {
  const settings = new MarkerCollectionRenderSettings();

  // Clear previous markers from the map
  await map?.preferences.markers.clear();

  // Show the current marker on map and center on it
  map?.preferences.markers.add(markerCollection, { settings });
  map?.centerOnArea(markerCollection.area, { zoomLevel: 50 });
}

function onPolylineButtonPressed() {
  const markerCollection = MarkerCollection.create(
    MarkerType.Polyline,
    'Polyline marker collection'
  );

  const marker = new Marker();
  marker.setCoordinates([
    new Coordinates({ latitude: 52.360495, longitude: 4.936882 }),
    new Coordinates({ latitude: 52.360495, longitude: 4.836882 }),
  ]);
  markerCollection.add(marker);
  console.log('Polyline marker collection size:', markerCollection.size);

  showMarkerCollectionOnMap(markerCollection);
  showMessage('Polyline drawn');
}

function onPolygonButtonPressed() {
  const markerCollection = MarkerCollection.create(MarkerType.Polygon, 'Polygon marker collection');

  const marker = new Marker();
  marker.setCoordinates([
    new Coordinates({ latitude: 52.340234, longitude: 4.886882 }),
    new Coordinates({ latitude: 52.300495, longitude: 4.936882 }),
    new Coordinates({ latitude: 52.300495, longitude: 4.836882 }),
  ]);
  markerCollection.add(marker);

  showMarkerCollectionOnMap(markerCollection);
  showMessage('Polygon drawn');
}

function onPointsButtonPressed() {
  const markerCollection = MarkerCollection.create(MarkerType.Point, 'Points marker collection');

  const marker = new Marker();
  marker.setCoordinates([
    new Coordinates({ latitude: 52.380495, longitude: 4.930882 }),
    new Coordinates({ latitude: 52.380495, longitude: 4.900882 }),
    new Coordinates({ latitude: 52.380495, longitude: 4.870882 }),
    new Coordinates({ latitude: 52.380495, longitude: 4.840882 }),
  ]);
  markerCollection.add(marker);

  showMarkerCollectionOnMap(markerCollection);
  showMessage('Points drawn');
}

async function onMapCreated(gemMap: GemMap) {
  map = gemMap;
}

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
  await PositionService.instance;

  // Create map view with error handling
  const viewId = 2;
  const wrapper = createMapView(gemKit, container, viewId, onMapCreated);

  if (!wrapper) {
    console.error('Failed to create map view');
    return;
  }

  // Layout calculations for spacing (Total width approx: 150*3 = 450px)
  // We center them using transform translateX relative to center

  // 1. Polyline button (Left)
  const polylineBtn = document.createElement('button');
  polylineBtn.innerHTML = `${ICONS.polyline} Polyline`;
  styleButton(polylineBtn, '#673ab7', '#7e57c2'); // Purple
  // Explicit positioning logic overrides generic styleButton top/left
  polylineBtn.style.left = '50%';
  polylineBtn.style.transform = 'translateX(-160%)';
  polylineBtn.onclick = onPolylineButtonPressed;
  document.body.appendChild(polylineBtn);

  // 2. Polygon button (Center)
  const polygonBtn = document.createElement('button');
  polygonBtn.innerHTML = `${ICONS.polygon} Polygon`;
  styleButton(polygonBtn, '#2196f3', '#42a5f5'); // Blue
  polygonBtn.style.left = '50%';
  polygonBtn.style.transform = 'translateX(-50%)';
  polygonBtn.onclick = onPolygonButtonPressed;
  document.body.appendChild(polygonBtn);

  // 3. Points button (Right)
  const pointsBtn = document.createElement('button');
  pointsBtn.innerHTML = `${ICONS.points} Points`;
  styleButton(pointsBtn, '#4caf50', '#66bb6a'); // Green
  pointsBtn.style.left = '50%';
  pointsBtn.style.transform = 'translateX(60%)';
  pointsBtn.onclick = onPointsButtonPressed;
  document.body.appendChild(pointsBtn);

  // Register cleanup on page unload
  events.add(window, 'beforeunload', () => {
    events.cleanup();
  });
});
