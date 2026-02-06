// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

import {
  GemKit,
  GemMap,
  PositionService,
  Coordinates,
  ProjectionService,
  ProjectionType,
  WGS84Projection,
  MGRSProjection,
  UTMProjection,
  LAMProjection,
  GKProjection,
  BNGProjection,
  GemError,
} from '@magiclane/maps-sdk';

// Type for screen position coordinates
interface ScreenPosition {
  x: number;
  y: number;
}

// Union type for all projection types
type Projection =
  | WGS84Projection
  | MGRSProjection
  | UTMProjection
  | LAMProjection
  | GKProjection
  | BNGProjection;
import { GEMKIT_TOKEN, showMessage, ICONS } from '../../shared';

let map: GemMap | null = null;
let projectionsPanel: HTMLDivElement | null = null;
let lastProjections: {
  wgs?: WGS84Projection;
  mgrs?: MGRSProjection;
  utm?: UTMProjection;
  lam?: LAMProjection;
  gk?: GKProjection;
  bng?: BNGProjection;
} = {};

// Helper: show projections panel
function showProjectionsPanel() {
  if (projectionsPanel) projectionsPanel.remove();

  projectionsPanel = document.createElement('div');
  projectionsPanel.style.cssText = `
    position: fixed; 
    bottom: 30px; 
    left: 50%; 
    transform: translateX(-50%);
    width: 90%;
    max-width: 500px;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    z-index: 2000; 
    padding: 24px;
    border-radius: 20px;
    font-size: 14px; 
    color: #333;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    display: flex;
    flex-direction: column;
    gap: 12px;
    animation: slideUp 0.3s ease-out;
  `;

  // Add animation style
  if (!document.getElementById('panel-anim')) {
    const style = document.createElement('style');
    style.id = 'panel-anim';
    style.textContent = `@keyframes slideUp { from { transform: translate(-50%, 100%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }`;
    document.head.appendChild(style);
  }

  const createRow = (label: string, value: string) => `
    <div style="display: flex; flex-direction: column; border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom: 8px;">
      <span style="font-weight: 700; color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">${label}</span>
      <span style="font-family: 'SF Mono', 'Roboto Mono', monospace; color: #111; font-size: 13px; margin-top: 2px;">${value}</span>
    </div>
  `;

  let html =
    '<div style="font-size: 18px; font-weight: 700; margin-bottom: 8px; color: #111;">Coordinates</div>';

  if (lastProjections.wgs && lastProjections.wgs.coordinates) {
    html += createRow(
      'WGS84',
      `${lastProjections.wgs.coordinates.latitude.toFixed(6)}, ${lastProjections.wgs.coordinates.longitude.toFixed(6)}`
    );
  } else {
    html += createRow('WGS84', 'Not available');
  }

  html += createRow(
    'BNG',
    lastProjections.bng
      ? `${lastProjections.bng.easting.toFixed(4)}, ${lastProjections.bng.northing.toFixed(4)}`
      : 'Not available'
  );

  html += createRow(
    'UTM',
    lastProjections.utm
      ? `${lastProjections.utm.x.toFixed(2)}, ${lastProjections.utm.y.toFixed(2)} <span style="color:#666">(Zone ${lastProjections.utm.zone}${lastProjections.utm.hemisphere})</span>`
      : 'Not available'
  );

  html += createRow(
    'MGRS',
    lastProjections.mgrs
      ? `${lastProjections.mgrs.zone}${lastProjections.mgrs.letters} ${lastProjections.mgrs.easting.toFixed(2)} ${lastProjections.mgrs.northing.toFixed(2)}`
      : 'Not available'
  );

  html += createRow(
    'LAM',
    lastProjections.lam
      ? `${lastProjections.lam.x.toFixed(2)}, ${lastProjections.lam.y.toFixed(2)}`
      : 'Not available'
  );

  html += createRow(
    'GK',
    lastProjections.gk
      ? `${lastProjections.gk.easting.toFixed(2)}, ${lastProjections.gk.northing.toFixed(2)} <span style="color:#666">(Zone ${lastProjections.gk.zone})</span>`
      : 'Not available'
  );

  projectionsPanel.innerHTML = html;

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = ICONS.closeLarge;
  closeBtn.title = 'Close';
  closeBtn.style.cssText = `
    position: absolute; 
    top: 16px; 
    right: 16px; 
    background: rgba(0,0,0,0.05); 
    border: none; 
    color: #555; 
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  `;
  closeBtn.onmouseenter = () => {
    closeBtn.style.background = 'rgba(0,0,0,0.1)';
    closeBtn.style.color = '#000';
  };
  closeBtn.onmouseleave = () => {
    closeBtn.style.background = 'rgba(0,0,0,0.05)';
    closeBtn.style.color = '#555';
  };
  closeBtn.onclick = () => {
    if (projectionsPanel) {
      projectionsPanel.style.opacity = '0';
      projectionsPanel.style.transform = 'translate(-50%, 20px)';
      setTimeout(() => {
        if (projectionsPanel) projectionsPanel.remove();
        projectionsPanel = null;
        lastProjections = {};
      }, 300);
    }
  };
  projectionsPanel.appendChild(closeBtn);

  document.body.appendChild(projectionsPanel);
}

// Helper: convert projection (async, Promise-based)
function convertProjection(
  projection: Projection,
  type: ProjectionType
): Promise<Projection | null> {
  return new Promise((resolve) => {
    ProjectionService.convert(projection, type, (err: GemError, converted: Projection) => {
      if (err !== GemError.success) resolve(null);
      else resolve(converted);
    });
  });
}

// Map created callback
function onMapCreated(gemMap: GemMap) {
  map = gemMap;

  // Center map
  map.centerOnCoordinates(new Coordinates({ latitude: 45.472358, longitude: 9.184945 }), {
    zoomLevel: 80,
  });

  // Enable cursor
  map.preferences.enableCursor = true;
  map.preferences.enableCursorRender = true;

  // Show initial instruction
  showMessage('Tap anywhere on the map to see projection details');

  // Register touch callback
  map.registerTouchCallback(async (point: ScreenPosition) => {
    // Transform the screen point to Coordinates
    const coords = map!.transformScreenToWgs(point);

    // Update cursor position on the map
    map!.setCursorScreenPosition(point);

    // Build WGS84 projection from Coordinates
    const wgsProjection = new WGS84Projection(coords);

    // Convert to all projections in parallel
    const [utm, mgrs, lam, gk, bng] = await Promise.all([
      convertProjection(wgsProjection, ProjectionType.utm),
      convertProjection(wgsProjection, ProjectionType.mgrs),
      convertProjection(wgsProjection, ProjectionType.lam),
      convertProjection(wgsProjection, ProjectionType.gk),
      convertProjection(wgsProjection, ProjectionType.bng),
    ]);

    lastProjections = {
      wgs: wgsProjection,
      utm: utm as UTMProjection,
      mgrs: mgrs as MGRSProjection,
      lam: lam as LAMProjection,
      gk: gk as GKProjection,
      bng: bng as BNGProjection,
    };

    showProjectionsPanel();
  });
}

// Main entry
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

  const viewId = 10;
  const wrapper = gemKit.createView(viewId, (gemMap: GemMap) => {
    onMapCreated(gemMap);
  });
  if (wrapper) container.appendChild(wrapper);
});
