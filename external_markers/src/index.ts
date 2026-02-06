// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

import type * as GeoJSON from 'geojson';
import {
  GemKit,
  GemMap,
  Coordinates,
  PositionService,
  ExternalRendererMarkers,
  MarkerCollectionRenderSettings,
} from '@magiclane/maps-sdk';
import { PinManager } from './pinmanager';
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
let externalRender: ExternalRendererMarkers | null = null;
const pinManager = new PinManager('map-container');

// Event listener manager for proper cleanup
const events = new EventListenerManager();

// Fetch and convert OpenChargeMap data to GeoJSON
type OpenChargeMapEntry = {
  ID: number;
  AddressInfo: {
    Latitude: number;
    Longitude: number;
    Title?: string;
    AddressLine1?: string;
    Town?: string;
  };
};

async function fetchAndConvertToGeoJSON(): Promise<GeoJSON.FeatureCollection> {
  const url =
    'https://api.openchargemap.io/v3/poi/?output=json&latitude=45.75&longitude=3.15&distance=10&distanceunit=KM&key=58092721-4ce4-4b62-b6fd-5e6840190520';
  const response = await fetch(url);
  const data: OpenChargeMapEntry[] = await response.json();
  const geoJson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: data
      .filter((entry) => entry.AddressInfo?.Latitude && entry.AddressInfo?.Longitude)
      .map((entry) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [entry.AddressInfo.Longitude, entry.AddressInfo.Latitude],
        },
        properties: {
          id: entry.ID,
          title: entry.AddressInfo.Title || '',
          town: entry.AddressInfo.Town || '',
        },
      })),
  };
  return geoJson;
}

function addMarkers() {
  if (map === null) return;

  showMessage('Fetching charging stations...');

  fetchAndConvertToGeoJSON()
    .then((data) => {
      const geoJsonString = JSON.stringify(data);
      const response = map?.addGeoJsonAsMarkerCollection(geoJsonString, 'markers');

      if (!response || response.length === 0) {
        showMessage('No markers found.');
        return;
      }

      const ms = new MarkerCollectionRenderSettings({});
      map?.preferences.markers.add(response[0], { settings: ms, externalRender: externalRender!! });
      map?.centerOnArea(response[0].area);

      if (externalRender) {
        externalRender.onNotifyCustom = (data) => {
          if (data === 2) {
            pinManager.updatePins(externalRender!!.visiblePoints, map);
          }
        };
      }
      showMessage('Markers added successfully!');
    })
    .catch((err) => {
      console.error(err);
      showMessage('Error loading markers.');
    });
}

// Wait for DOM to load and initialize map
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
  const viewId = 1;
  const wrapper = createMapView(gemKit, container, viewId, (gemMap: GemMap) => {
    map = gemMap;
    externalRender = new ExternalRendererMarkers();
  });

  if (!wrapper) {
    console.error('Failed to create map view');
    return;
  }

  // Add Markers button
  const addMarkersBtn = document.createElement('button');
  addMarkersBtn.innerHTML = `${ICONS.addLocation} Add Markers`;

  // Apply Modern Style
  styleButton(addMarkersBtn, '#007bff', '#0056b3'); // Blue

  addMarkersBtn.onclick = () => addMarkers();
  document.body.appendChild(addMarkersBtn);

  // Register cleanup on page unload
  events.add(window, 'beforeunload', () => {
    events.cleanup();
  });
});
