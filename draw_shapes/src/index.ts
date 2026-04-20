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
  initializeSDK,
  createMapView,
  EventListenerManager,
  applyStyles,
  mergeStyles,
  styles,
  StyleManager,
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
  applyStyles(
    polylineBtn,
    mergeStyles(styles.buttonBase, styles.buttonPrimary, {
      position: 'fixed',
      top: '30px',
      left: '50%',
      transform: 'translateX(-160%)',
    })
  );
  StyleManager.addHoverEffect(
    polylineBtn,
    { background: '#7e57c2', boxShadow: '0 6px 20px rgba(103, 58, 183, 0.5)' },
    { background: '#673ab7', boxShadow: '0 4px 15px rgba(103, 58, 183, 0.4)' }
  );
  polylineBtn.onclick = onPolylineButtonPressed;
  document.body.appendChild(polylineBtn);

  // 2. Polygon button (Center)
  const polygonBtn = document.createElement('button');
  polygonBtn.innerHTML = `${ICONS.polygon} Polygon`;
  applyStyles(
    polygonBtn,
    mergeStyles(styles.buttonBase, styles.buttonInfo, {
      position: 'fixed',
      top: '30px',
      left: '50%',
      transform: 'translateX(-50%)',
    })
  );
  StyleManager.addHoverEffect(
    polygonBtn,
    { background: '#42a5f5', boxShadow: '0 6px 20px rgba(33, 150, 243, 0.5)' },
    { background: '#2196f3', boxShadow: '0 4px 15px rgba(33, 150, 243, 0.4)' }
  );
  polygonBtn.onclick = onPolygonButtonPressed;
  document.body.appendChild(polygonBtn);

  // 3. Points button (Right)
  const pointsBtn = document.createElement('button');
  pointsBtn.innerHTML = `${ICONS.points} Points`;
  applyStyles(
    pointsBtn,
    mergeStyles(styles.buttonBase, styles.buttonSuccess, {
      position: 'fixed',
      top: '30px',
      left: '50%',
      transform: 'translateX(60%)',
    })
  );
  StyleManager.addHoverEffect(
    pointsBtn,
    { background: '#43a047', boxShadow: '0 6px 20px rgba(76, 175, 80, 0.5)' },
    { background: '#4caf50', boxShadow: '0 4px 15px rgba(76, 175, 80, 0.4)' }
  );
  pointsBtn.onclick = onPointsButtonPressed;
  document.body.appendChild(pointsBtn);

  // Register cleanup on page unload
  events.add(window, 'beforeunload', () => {
    events.cleanup();
  });
});
