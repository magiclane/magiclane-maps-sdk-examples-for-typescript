// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

import {
  GemKit,
  GemMap,
  Coordinates,
  PositionService,
  TrafficService,
  GemError,
  RouteTransportMode,
  Path,
  UserRoadblockPathPreviewCoordinate,
  Color,
} from '@magiclane/maps-sdk';
import { GEMKIT_TOKEN, showMessage, ICONS, styleButton } from '../../shared';

let map: GemMap | null = null;
let drawMode = false;

// Coordinates logic
let permanentCoords: Coordinates[] = [];
let previewCoordsList: Coordinates[] = [];
let previewCursor: UserRoadblockPathPreviewCoordinate | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// UI Elements
let addBtn: HTMLButtonElement;
let drawBtn: HTMLButtonElement;
let checkBtn: HTMLButtonElement;
let cancelBtn: HTMLButtonElement;

function updateUI() {
  if (drawMode) {
    drawBtn.style.display = 'none';

    // Layout: Cancel (Left), Add (Center), Finish (Right)
    cancelBtn.style.display = 'flex';
    cancelBtn.style.left = '50%';
    cancelBtn.style.transform = 'translateX(-170%)';

    addBtn.style.display = 'flex';
    addBtn.style.left = '50%';
    addBtn.style.transform = 'translateX(-50%)';

    checkBtn.style.display = 'flex';
    checkBtn.style.left = '50%';
    checkBtn.style.transform = 'translateX(70%)';
  } else {
    drawBtn.style.display = 'flex';
    drawBtn.style.left = '50%';
    drawBtn.style.transform = 'translateX(-50%)';

    addBtn.style.display = 'none';
    checkBtn.style.display = 'none';
    cancelBtn.style.display = 'none';
  }
}

function redrawPath() {
  if (!map) return;
  const previewPath = Path.fromCoordinates(previewCoordsList);
  const permanentPath = Path.fromCoordinates(permanentCoords);

  map.preferences.paths.clear();
  // Green for preview
  map.preferences.paths.add(previewPath, { colorInner: new Color(0, 255, 0, 0), szInner: 10 });
  // Red for permanent
  map.preferences.paths.add(permanentPath, { colorInner: new Color(255, 0, 0, 0), szInner: 10 });
}

// Logic aligned strictly with Dart implementation
function handlePreviewPathUpdate(allowRecursive: boolean) {
  if (!map) return;

  const viewport = map.viewport;
  const centerScreen = { x: Math.floor(viewport.width / 2), y: Math.floor(viewport.height / 2) };
  const centerCoord = map.transformScreenToWgs(centerScreen);

  // 1. On first call, initialize permanentCoords with the center coordinate
  if (permanentCoords.length === 0) {
    permanentCoords.push(centerCoord);
  }

  // 2. If previewCursor is null, set it from center and return
  if (!previewCursor) {
    previewCursor = UserRoadblockPathPreviewCoordinate.fromCoordinates(centerCoord);
    return;
  }

  // 3. Compute route coordinates from previous coordinates to new coordinates
  const result = TrafficService.getPersistentRoadblockPathPreview({
    from: previewCursor,
    to: centerCoord,
    transportMode: RouteTransportMode.car,
  });

  // Extract results based on return type
  const error = result[2] || (result as any)[2];

  if (error !== GemError.success) {
    resetPreviewPathOnError(allowRecursive);
    return;
  }

  const newCoords = result[0] || (result as any)[0];
  const newCursor = result[1] || (result as any)[1];

  updatePreviewPath(newCoords, newCursor);
}

function resetPreviewPathOnError(allowRecursive: boolean) {
  // Clear preview list
  previewCoordsList = [];

  // Reset cursor to the last valid permanent coordinate
  if (permanentCoords.length > 0) {
    previewCursor = UserRoadblockPathPreviewCoordinate.fromCoordinates(
      permanentCoords[permanentCoords.length - 1]
    );
  }

  redrawPath();

  if (allowRecursive) {
    handlePreviewPathUpdate(false);
  }
}

function updatePreviewPath(from: Coordinates[], to: UserRoadblockPathPreviewCoordinate) {
  previewCoordsList = [...previewCoordsList, ...from];
  previewCursor = to;
  redrawPath();
}

function onAddBtnPressed() {
  // Move preview into permanent
  permanentCoords = [...permanentCoords, ...previewCoordsList];
  previewCoordsList = [];
  redrawPath();
  showMessage('Segment added. Pan to continue drawing.');
}

function onDrawBtnPressed() {
  drawMode = true;
  permanentCoords = [];
  previewCursor = null;
  previewCoordsList = [];
  updateUI();

  // Initialize drawing immediately
  handlePreviewPathUpdate(false);
  showMessage("Pan map to draw. Press 'Add' to lock segments.");
}

function onCheckBtnPressed() {
  const now = new Date();
  const expire = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day expiration

  const result = TrafficService.addPersistentRoadblockByCoordinates({
    coords: permanentCoords,
    startTime: now,
    expireTime: expire,
    transportMode: RouteTransportMode.car,
    id: now.toISOString(),
  });

  // Reset state
  drawMode = false;
  permanentCoords = [];
  previewCursor = null;
  previewCoordsList = [];
  updateUI();

  // Handle result
  const error = result.second || (result as any)[1] || (result as any).second;

  if (error !== GemError.success) {
    showMessage(`Error ${error} when adding roadblock.`);
  } else {
    showMessage('Roadblock added successfully!');
  }

  redrawPath();
}

function onCancelBtnPressed() {
  drawMode = false;
  permanentCoords = [];
  previewCoordsList = [];
  previewCursor = null;
  updateUI();
  redrawPath();
}

async function onMapCreated(gemMap: GemMap) {
  map = gemMap;

  // IMPROVEMENT: Use native cursor
  map.preferences.enableCursor = true;
  map.preferences.enableCursorRender = true;

  // Register move callback
  map.registerMoveCallback(() => {
    if (!drawMode) return;

    // Debounce to calculate preview only after movement settles slightly
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      handlePreviewPathUpdate(true);
    }, 100);
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  let gemKit;
  try {
    gemKit = await GemKit.initialize(GEMKIT_TOKEN);
  } catch (error) {
    showMessage('Failed to initialize GemKit SDK. Please check your token.', 5000);
    console.error('GemKit initialization error:', error);
    return;
  }
  await PositionService.instance;

  const container = document.getElementById('map-container');
  if (!container) throw new Error('Map container not found');

  const viewId = 2;
  const wrapper = gemKit.createView(viewId, onMapCreated);
  if (wrapper) container.appendChild(wrapper);

  // --- Create Buttons ---

  // 1. Add Segment Button
  addBtn = document.createElement('button');
  addBtn.innerHTML = `${ICONS.add} Add`;
  styleButton(addBtn, '#2196f3', '#42a5f5');
  addBtn.onclick = onAddBtnPressed;
  document.body.appendChild(addBtn);

  // 2. Draw Mode Button (Start)
  drawBtn = document.createElement('button');
  drawBtn.innerHTML = `${ICONS.draw} Draw Roadblock`;
  styleButton(drawBtn, '#673ab7', '#7e57c2');
  drawBtn.onclick = onDrawBtnPressed;
  document.body.appendChild(drawBtn);

  // 3. Finish Button
  checkBtn = document.createElement('button');
  checkBtn.innerHTML = `${ICONS.check} Finish`;
  styleButton(checkBtn, '#4caf50', '#66bb6a');
  checkBtn.onclick = onCheckBtnPressed;
  document.body.appendChild(checkBtn);

  // 4. Cancel Button
  cancelBtn = document.createElement('button');
  cancelBtn.innerHTML = `${ICONS.close} Cancel`;
  styleButton(cancelBtn, '#f44336', '#ef5350');
  cancelBtn.onclick = onCancelBtnPressed;
  document.body.appendChild(cancelBtn);

  updateUI();
});
