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
  RouteTransportMode,
  Coordinates,
  RouteRenderOptions,
  RectType,
  PositionService,
  BuildTerrainProfile,
  GemIcon,
  HighlightRenderSettings,
  HighlightOptions,
  RouteRenderSettings,
  TaskHandler,
  Color, // Import Color for path styling
  Path,
} from '@magiclane/maps-sdk';

// Type for elevation sample
interface ElevationSample {
  distance: number;
  elevation: number;
}
import {
  GEMKIT_TOKEN,
  showMessage,
  ICONS,
  styleButton,
  convertDistance,
  convertDuration,
} from '../../shared';

// Custom chart icon for route profile header
const CHART_ICON = `<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 0 24 24" width="20" fill="currentColor"><path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/></svg>`;

// Helper: Convert Hex color string to Gem SDK Color
function hexToColor(hex: string): Color {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return new Color(r, g, b, 255);
}

let map: GemMap | null = null;
let routingHandler: TaskHandler | null = null;
let focusedRoute: Route | null = null;

// UI Elements
let buildRouteBtn: HTMLButtonElement;
let cancelRouteBtn: HTMLButtonElement;
let clearRoutesBtn: HTMLButtonElement;
let routeProfilePanel: HTMLDivElement;

function updateUI() {
  buildRouteBtn.style.display = 'none';
  cancelRouteBtn.style.display = 'none';
  clearRoutesBtn.style.display = 'none';

  if (!routingHandler && !focusedRoute) {
    buildRouteBtn.style.display = 'flex';
  } else if (routingHandler) {
    cancelRouteBtn.style.display = 'flex';
  } else if (focusedRoute) {
    clearRoutesBtn.style.display = 'flex';
  }

  // Animate panel visibility
  if (routeProfilePanel) {
    if (focusedRoute) {
      routeProfilePanel.style.transform = 'translateY(0)';
    } else {
      routeProfilePanel.style.transform = 'translateY(110%)';
    }
  }
}

// Method for building route with terrain profile
async function onBuildRouteButtonPressed() {
  console.log('Build route button pressed');
  showMessage('Calculating terrain route...');

  try {
    // Define the departure (Swiss Alps - start point)
    const departureLandmark = Landmark.withCoordinates(Coordinates.fromLatLong(46.59344, 7.91069));

    // Define the destination (Swiss Alps - end point)
    const destinationLandmark = Landmark.withCoordinates(
      Coordinates.fromLatLong(46.55945, 7.89293)
    );

    // Define the route preferences with terrain profile enabled
    const routePreferences = new RoutePreferences({
      buildTerrainProfile: new BuildTerrainProfile({ enable: true }),
      transportMode: RouteTransportMode.pedestrian,
    });

    const routes = await calculateRoute([departureLandmark, destinationLandmark], routePreferences);

    if (routes && routes.length > 0) {
      showMessage('Route calculated successfully!');

      const routesMap = map?.preferences.routes;

      for (const route of routes) {
        const routeRenderSettings = new RouteRenderSettings({
          options: new Set([RouteRenderOptions.showTraffic, RouteRenderOptions.showHighlights]),
        });
        const isMainRoute = route === routes[0];
        routesMap?.add(route, isMainRoute, {
          routeRenderSettings: routeRenderSettings,
        });
      }

      if (routesMap) {
        routesMap.mainRoute = routes[0];
      }

      focusedRoute = routes[0];
      centerOnRoute([focusedRoute]);
      createRouteProfilePanel(focusedRoute);
      updateUI();
    } else {
      showMessage('Route calculation failed.');
    }
  } catch (error) {
    console.error('Error in onBuildRouteButtonPressed:', error);
    showMessage('Route calculation error.');
  }
}

// Method for clearing routes
function onClearRoutesButtonPressed() {
  map?.preferences.routes.clear();
  map?.preferences.paths.clear();
  map?.deactivateHighlight();

  focusedRoute = null;
  updateUI();
}

// Method for canceling route calculation
function onCancelRouteButtonPressed() {
  if (routingHandler) {
    RoutingService.cancelRoute(routingHandler);
    routingHandler = null;
    updateUI();
    showMessage('Route calculation cancelled.');
  }
}

// Calculate route with promise wrapper
async function calculateRoute(
  waypoints: Landmark[],
  preferences: RoutePreferences
): Promise<Route[] | null> {
  return new Promise((resolve) => {
    try {
      const timeout = setTimeout(() => {
        console.error('Route calculation timed out');
        resolve(null);
      }, 30000);

      routingHandler = RoutingService.calculateRoute(
        waypoints,
        preferences,
        (err: GemError, routes: Route[]) => {
          clearTimeout(timeout);
          routingHandler = null;

          if (err === GemError.success && routes && routes.length > 0) {
            resolve(routes);
          } else {
            resolve(null);
          }
        }
      );
    } catch (error) {
      resolve(null);
    }
  });
}

// Center camera on route
function centerOnRoute(routes: Route[]) {
  if (!map) return;

  const container = document.getElementById('map-container');
  if (!container) return;

  const containerRect = container.getBoundingClientRect();

  // Center route in top 50% of screen to account for the panel
  map.centerOnRoutes({
    routes: routes,
    screenRect: new RectType({
      x: 0,
      y: 80,
      width: containerRect.width,
      height: containerRect.height / 2 - 80,
    }),
  });
}

// Register route tap callback
async function registerRouteTapCallback() {
  if (!map) return;

  map.registerTouchCallback(async (pos: { x: number; y: number }) => {
    try {
      if (!map) return;
      map.setCursorScreenPosition(pos);

      const routes = map.cursorSelectionRoutes();

      if (routes.length > 0) {
        const routesMap = map.preferences.routes;
        if (routesMap) {
          routesMap.mainRoute = routes[0];
        }

        focusedRoute = routes[0];
        createRouteProfilePanel(focusedRoute);
        updateUI();
        centerOnRoute([focusedRoute]);
      }
    } catch (error) {
      console.error('Error in route tap callback:', error);
    }
  });
}

// Create route profile panel
function createRouteProfilePanel(route: Route) {
  routeProfilePanel.innerHTML = '';

  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    padding: 20px;
    background: rgba(255,255,255,0.95);
    border-bottom: 1px solid #eee;
    backdrop-filter: blur(10px);
    border-radius: 20px 20px 0 0;
    position: sticky; top: 0; z-index: 10;
  `;

  const timeDistance = route.getTimeDistance();
  const totalDistance = timeDistance.unrestrictedDistanceM + timeDistance.restrictedDistanceM;
  const totalDuration = timeDistance.unrestrictedTimeS + timeDistance.restrictedTimeS;

  header.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h2 style="margin:0; font-size:18px; color:#333; display:flex; align-items:center; gap:8px;">${CHART_ICON} Route Profile</h2>
        <span style="font-size:12px; color:#666; background:#eee; padding:4px 8px; border-radius:12px;">${RouteTransportMode[route.preferences.transportMode] || 'Walking'}</span>
    </div>
    <div style="display:flex; gap:20px;">
        <div>
            <div style="font-size:12px; color:#888;">Distance</div>
            <div style="font-size:16px; font-weight:600; color:#333;">${convertDistance(totalDistance)}</div>
        </div>
        <div>
            <div style="font-size:12px; color:#888;">Duration</div>
            <div style="font-size:16px; font-weight:600; color:#333;">${convertDuration(totalDuration)}</div>
        </div>
    </div>
  `;
  routeProfilePanel.appendChild(header);

  // Content Container
  const content = document.createElement('div');
  content.style.cssText = 'padding: 20px; padding-bottom: 40px;';

  // Check terrain profile
  let hasTerrainProfile = false;
  try {
    hasTerrainProfile = route.terrainProfile != null;
  } catch (e) {}

  if (hasTerrainProfile) {
    // Elevation Chart
    content.appendChild(createElevationSection(route));

    // Interactive Sections
    content.appendChild(createInteractiveSliderSection('Surface Analysis', 'Surface', route));
    content.appendChild(createInteractiveSliderSection('Road Type Analysis', 'Road Type', route));
    content.appendChild(createInteractiveSliderSection('Steepness Analysis', 'Steepness', route));

    // Landmarks
    content.appendChild(createElevationLandmarkButtons(route));
  } else {
    const noProfile = document.createElement('div');
    noProfile.style.cssText = 'text-align:center; padding:40px; color:#888;';
    noProfile.innerHTML = 'Terrain profile data not available.';
    content.appendChild(noProfile);
  }

  routeProfilePanel.appendChild(content);
}

// Create interactive slider section
function createInteractiveSliderSection(title: string, type: string, route: Route): HTMLElement {
  const section = document.createElement('div');
  section.style.cssText = `
    background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #f0f0f0;
  `;

  const titleEl = document.createElement('h3');
  titleEl.textContent = title;
  titleEl.style.cssText = 'margin: 0 0 16px 0; color: #333; font-size: 15px; font-weight:600;';
  section.appendChild(titleEl);

  const mockSections = createMockSections(type);

  const barContainer = document.createElement('div');
  barContainer.style.cssText = `
    position: relative; height: 32px; border-radius: 6px; overflow: hidden;
    margin-bottom: 16px; background: #f5f5f5; display: flex;
  `;

  mockSections.forEach((sec) => {
    const seg = document.createElement('div');
    seg.style.width = `${sec.percent * 100}%`;
    seg.style.backgroundColor = sec.color;
    seg.title = `${sec.name}`;
    barContainer.appendChild(seg);
  });

  // Slider Controls
  const sliderContainer = document.createElement('div');
  sliderContainer.style.cssText = 'position: relative; margin-top: -32px; z-index: 5; height:32px;';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  const totalDistance =
    route.getTimeDistance().unrestrictedDistanceM + route.getTimeDistance().restrictedDistanceM;
  slider.max = totalDistance.toString();
  slider.value = '0';
  slider.style.cssText = `
    width: 100%; height: 32px; cursor: pointer; position:absolute; top:0; left:0;
    background: transparent; -webkit-appearance: none; appearance: none; outline: none; margin:0;
  `;

  // Inject style for slider thumb
  const styleId = `slider-${type.replace(/\s/g, '')}-${Date.now()}`;
  const style = document.createElement('style');
  style.textContent = `
    #${styleId}::-webkit-slider-thumb {
      -webkit-appearance: none; width: 4px; height: 32px; background: #212121;
      border: 1px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5); cursor: pointer;
    }
    #${styleId}::-moz-range-thumb {
      width: 4px; height: 32px; background: #212121; border: 1px solid white; cursor: pointer;
    }
  `;
  document.head.appendChild(style);
  slider.id = styleId;

  sliderContainer.appendChild(slider);
  section.appendChild(barContainer);
  section.appendChild(sliderContainer);

  const info = document.createElement('div');
  info.style.cssText =
    'font-size: 13px; color: #666; margin-top:8px; display:flex; justify-content:space-between;';
  const infoText = document.createElement('span');
  infoText.textContent = 'Drag to analyze';
  info.appendChild(infoText);
  section.appendChild(info);

  // Logic
  const updateAnalysis = (val: number) => {
    const sec = findSectionAtDistance(val, totalDistance, mockSections);
    infoText.innerHTML = `<strong>${sec.name}</strong> at ${convertDistance(val)}`;
    // IMPORTANT: Pass the full section object to highlightRouteSection
    highlightRouteSection(route, sec, val);
  };

  slider.addEventListener('input', (e) =>
    updateAnalysis(parseFloat((e.target as HTMLInputElement).value))
  );

  return section;
}

// Mock Data Generation
function createMockSections(type: string): Array<{ name: string; percent: number; color: string }> {
  switch (type) {
    case 'Surface':
      return [
        { name: 'Asphalt', percent: 0.6, color: '#90A4AE' },
        { name: 'Paved', percent: 0.25, color: '#CFD8DC' },
        { name: 'Unpaved', percent: 0.15, color: '#8D6E63' },
      ];
    case 'Road Type':
      return [
        { name: 'Road', percent: 0.4, color: '#B0BEC5' },
        { name: 'Path', percent: 0.35, color: '#E0E0E0' },
        { name: 'Street', percent: 0.25, color: '#78909C' },
      ];
    case 'Steepness':
      return [
        { name: 'Descent High', percent: 0.1, color: '#43A047' },
        { name: 'Descent Low', percent: 0.15, color: '#81C784' },
        { name: 'Neutral', percent: 0.5, color: '#FFEB3B' },
        { name: 'Ascent Low', percent: 0.15, color: '#FFB74D' },
        { name: 'Ascent High', percent: 0.1, color: '#F4511E' },
      ];
    default:
      return [{ name: 'Unknown', percent: 1.0, color: '#cccccc' }];
  }
}

function findSectionAtDistance(
  distance: number,
  totalDistance: number,
  sections: Array<{ name: string; percent: number; color: string }>
) {
  const progress = distance / totalDistance;
  let acc = 0;
  for (const s of sections) {
    acc += s.percent;
    if (progress <= acc) return s;
  }
  return sections[sections.length - 1];
}

// RESTORED: Core logic for highlighting path segments
function highlightRouteSection(
  route: Route,
  section: { name: string; percent: number; color: string } | null,
  distance: number
) {
  try {
    const coords = route.getCoordinateOnRoute(Math.floor(distance));
    if (coords && map) {
      map.deactivateHighlight();

      const landmark = Landmark.create();
      landmark.coordinates = coords;

      try {
        landmark.setImageFromIcon(GemIcon.searchResultsPin);
      } catch (error) {
        // Fallback if icon fails
      }

      try {
        const renderSettings = new HighlightRenderSettings({
          options: new Set([HighlightOptions.showLandmark, HighlightOptions.noFading]),
        });
        map.activateHighlight([landmark], { renderSettings: renderSettings });
      } catch (error) {
        map.activateHighlight([landmark]);
      }

      // RESTORED: Only call _presentPaths if we have a valid section
      if (section && section.name) {
        // showMessage(`${section.name} at ${convertDistance(distance)}`, 1000); // Optional: reduced duration
        _presentPaths(route, section);
      }
    }
  } catch (error) {
    console.error('Error in highlightRouteSection:', error);
  }
}

// RESTORED: Function to draw path segments on the map
function _presentPaths(route: Route, section: { name: string; percent: number; color: string }) {
  try {
    if (!map) return;
    map.preferences.paths.clear();

    // Get the calculated path segments from our mock data + route logic
    const paths = getRouteSegmentsForSection(route, section);

    paths.forEach((pathSegment) => {
      if (pathSegment && map) {
        // Add path to map with color
        // We convert the hex string from mock data to a Gem Color object
        map.preferences.paths.add(pathSegment, { colorInner: hexToColor(section.color) });
      }
    });
  } catch (error) {
    console.log('Could not present paths:', error);
  }
}

// RESTORED: Helper to extract relevant path segments based on section logic
function getRouteSegmentsForSection(
  route: Route,
  section: { name: string; percent: number; color: string }
): Path[] {
  try {
    const totalDistance =
      route.getTimeDistance().unrestrictedDistanceM + route.getTimeDistance().restrictedDistanceM;
    const paths: Path[] = [];

    // Determine the type of section (Surface, Road Type, etc.)
    const type = getSectionTypeFromName(section.name);
    const mockSections = createMockSections(type);

    let currentDistance = 0;
    mockSections.forEach((mockSection) => {
      const segmentLength = mockSection.percent * totalDistance;

      // Only extract the path if it matches the current section name we are looking for
      if (mockSection.name === section.name) {
        const startDistance = currentDistance;
        const endDistance = currentDistance + segmentLength;

        // Extract geometry from route
        try {
          // route.getPath returns the geometry between two distances
          const pathSegment = route.getPath(Math.floor(startDistance), Math.floor(endDistance));
          if (pathSegment) {
            paths.push(pathSegment);
          }
        } catch (pathError) {
          console.log('Could not extract path segment:', pathError);
        }
      }
      currentDistance += segmentLength;
    });

    return paths;
  } catch (error) {
    console.log('Error getting route segments:', error);
    return [];
  }
}

// RESTORED: Helper to map section names back to their parent category
function getSectionTypeFromName(sectionName: string): string {
  if (['Asphalt', 'Paved', 'Unpaved'].includes(sectionName)) return 'Surface';
  if (['Road', 'Path', 'Street'].includes(sectionName)) return 'Road Type';
  if (['Descent High', 'Descent Low', 'Neutral', 'Ascent Low', 'Ascent High'].includes(sectionName))
    return 'Steepness';
  return 'Unknown';
}

// Elevation Buttons
function createElevationLandmarkButtons(route: Route): HTMLElement {
  const container = document.createElement('div');
  container.style.cssText = `
    background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #f0f0f0;
  `;

  const title = document.createElement('h3');
  title.textContent = 'Key Locations';
  title.style.cssText = 'margin: 0 0 16px 0; color: #333; font-size: 15px; font-weight:600;';
  container.appendChild(title);

  const grid = document.createElement('div');
  grid.style.cssText = 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;';

  const totalDistance =
    route.getTimeDistance().unrestrictedDistanceM + route.getTimeDistance().restrictedDistanceM;
  const samples = getElevationSamples(route);

  let minEle = samples[0]?.elevation || 0,
    maxEle = samples[0]?.elevation || 0;
  let minDist = 0,
    maxDist = 0;

  samples.forEach((s) => {
    if (s.elevation < minEle) {
      minEle = s.elevation;
      minDist = s.distance;
    }
    if (s.elevation > maxEle) {
      maxEle = s.elevation;
      maxDist = s.distance;
    }
  });

  const landmarks = [
    { name: 'Start', dist: 0, val: samples[0]?.elevation || 0, color: '#4CAF50' },
    {
      name: 'End',
      dist: totalDistance,
      val: samples[samples.length - 1]?.elevation || 0,
      color: '#F44336',
    },
    { name: 'Low', dist: minDist, val: minEle, color: '#2196F3' },
    { name: 'High', dist: maxDist, val: maxEle, color: '#FF9800' },
  ];

  landmarks.forEach((l) => {
    const btn = document.createElement('button');
    btn.style.cssText = `
      background: #f9f9f9; border: 1px solid #eee; border-radius: 8px; padding: 10px;
      cursor: pointer; text-align: center; transition: all 0.2s;
    `;
    btn.innerHTML = `
      <div style="font-size:12px; font-weight:600; color:${l.color}; margin-bottom:4px;">${l.name}</div>
      <div style="font-size:11px; color:#666;">${Math.round(l.val)}m</div>
    `;
    btn.onclick = () => {
      // Pass complete section object structure to satisfy signature
      highlightRouteSection(route, { name: l.name, percent: 0, color: l.color }, l.dist);
    };
    btn.onmouseenter = () => (btn.style.background = '#f0f0f0');
    btn.onmouseleave = () => (btn.style.background = '#f9f9f9');
    grid.appendChild(btn);
  });

  container.appendChild(grid);
  return container;
}

// Elevation Chart
function createElevationSection(route: Route): HTMLElement {
  const section = document.createElement('div');
  section.style.cssText = `
    background: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #f0f0f0;
  `;

  const title = document.createElement('h3');
  title.textContent = 'Elevation Profile';
  title.style.cssText = 'margin: 0 0 16px 0; color: #333; font-size: 15px; font-weight:600;';
  section.appendChild(title);

  const samples = getElevationSamples(route);
  if (samples.length > 0) {
    section.appendChild(createSimpleElevationChart(samples, route));
  } else {
    section.innerHTML += '<div style="color:#999;font-style:italic;">No data</div>';
  }
  return section;
}

function getElevationSamples(route: Route) {
  const totalDistance =
    route.getTimeDistance().unrestrictedDistanceM + route.getTimeDistance().restrictedDistanceM;
  let count = Math.min(Math.ceil(totalDistance / 50), 200);
  count = Math.max(count, 2);

  try {
    const raw = route.terrainProfile!.getElevationSamples(count, 0, totalDistance);
    const result = [];
    let d = 0;
    for (let i = 0; i < raw.first.length; i++) {
      result.push({ distance: d, elevation: raw.first[i] });
      d += raw.second;
    }
    return result;
  } catch (e) {
    return [];
  }
}

// Updated Chart with Min/Max Labels and Slider Overlay
function createSimpleElevationChart(samples: ElevationSample[], route: Route): HTMLElement {
  const container = document.createElement('div');
  container.style.cssText =
    'position:relative; width:100%; height:160px; background:#fafafa; border-radius:8px; overflow:hidden; border:1px solid #eee;';

  // Calculate Min/Max
  let min = samples[0].elevation,
    max = samples[0].elevation;
  samples.forEach((s) => {
    min = Math.min(min, s.elevation);
    max = Math.max(max, s.elevation);
  });

  // Padding for visual appeal
  const range = max - min + 20;
  const renderMin = min - 10;

  // SVG
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  // Fixed ViewBox
  svg.setAttribute('viewBox', '0 0 1000 150');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.style.display = 'block';

  // Area Path
  let d = `M 0 150 `;
  const w = 1000 / (samples.length - 1);

  samples.forEach((s: ElevationSample, i: number) => {
    const x = i * w;
    const y = 150 - ((s.elevation - renderMin) / range) * 150;
    d += `L ${x} ${y} `;
  });

  d += `L 1000 150 Z`;

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', 'rgba(103, 58, 183, 0.2)');
  path.setAttribute('stroke', '#673AB7');
  path.setAttribute('stroke-width', '2');
  svg.appendChild(path);
  container.appendChild(svg);

  // Min/Max Labels
  const maxLabel = document.createElement('div');
  maxLabel.textContent = `${Math.round(max)}m`;
  maxLabel.style.cssText =
    'position:absolute; top:4px; right:8px; font-size:11px; color:#673AB7; font-weight:600;';
  container.appendChild(maxLabel);

  const minLabel = document.createElement('div');
  minLabel.textContent = `${Math.round(min)}m`;
  minLabel.style.cssText =
    'position:absolute; bottom:4px; right:8px; font-size:11px; color:#673AB7; font-weight:600;';
  container.appendChild(minLabel);

  // Interaction Layer (Slider)
  const totalDistance = samples[samples.length - 1].distance;

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = totalDistance.toString();
  slider.step = 'any';
  slider.value = '0';
  slider.style.cssText = `
    position: absolute; top:0; left:0; width:100%; height:100%;
    margin:0; opacity:0; cursor:crosshair; z-index:2;
  `;
  container.appendChild(slider);

  // Vertical Indicator Line & Tooltip
  const indicator = document.createElement('div');
  indicator.style.cssText = `
    position:absolute; top:0; bottom:0; width:1px; background:#E91E63;
    pointer-events:none; display:none; z-index:1; left:0;
  `;
  container.appendChild(indicator);

  const tooltip = document.createElement('div');
  tooltip.style.cssText = `
    position:absolute; top:8px; left:8px; background:rgba(255,255,255,0.9);
    padding:4px 8px; border-radius:4px; font-size:12px; color:#333;
    box-shadow:0 1px 3px rgba(0,0,0,0.2); pointer-events:none; display:none; z-index:1;
  `;
  container.appendChild(tooltip);

  // Interaction Logic
  const updateInteraction = (dist: number) => {
    // 1. Update UI
    const percent = (dist / totalDistance) * 100;
    indicator.style.left = `${percent}%`;
    indicator.style.display = 'block';

    // Find closest sample for elevation
    const sample = samples.reduce((prev, curr) =>
      Math.abs(curr.distance - dist) < Math.abs(prev.distance - dist) ? curr : prev
    );

    tooltip.innerHTML = `Dist: <strong>${convertDistance(dist)}</strong><br>Elev: <strong>${Math.round(sample.elevation)}m</strong>`;
    tooltip.style.display = 'block';

    // 2. Update Map - Pass null for section to avoid path errors from elevation chart
    highlightRouteSection(route, null, dist);
  };

  slider.addEventListener('input', (e) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    updateInteraction(val);
  });

  return container;
}

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
    registerRouteTapCallback();
  });
  if (wrapper) container.appendChild(wrapper);

  // Setup UI
  buildRouteBtn = document.createElement('button');
  buildRouteBtn.innerHTML = `${ICONS.route} Build Route`;
  styleButton(buildRouteBtn, '#673ab7', '#7e57c2'); // Purple
  buildRouteBtn.onclick = onBuildRouteButtonPressed;
  document.body.appendChild(buildRouteBtn);

  cancelRouteBtn = document.createElement('button');
  cancelRouteBtn.innerHTML = `${ICONS.close} Cancel`;
  styleButton(cancelRouteBtn, '#f44336', '#ef5350'); // Red
  cancelRouteBtn.onclick = onCancelRouteButtonPressed;
  document.body.appendChild(cancelRouteBtn);

  clearRoutesBtn = document.createElement('button');
  clearRoutesBtn.innerHTML = `${ICONS.trash} Clear Routes`;
  styleButton(clearRoutesBtn, '#ff9800', '#ffb74d'); // Orange
  clearRoutesBtn.onclick = onClearRoutesButtonPressed;
  document.body.appendChild(clearRoutesBtn);

  // Profile Panel Container (Bottom Sheet)
  routeProfilePanel = document.createElement('div');
  routeProfilePanel.style.cssText = `
    position: fixed; 
    bottom: 0; left: 0; right: 0; 
    height: 50vh;
    background: #fdfdfd; 
    border-radius: 20px 20px 0 0;
    box-shadow: 0 -5px 30px rgba(0,0,0,0.15);
    z-index: 1500;
    transform: translateY(110%);
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    overflow-y: auto;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  `;
  document.body.appendChild(routeProfilePanel);

  updateUI();
});
