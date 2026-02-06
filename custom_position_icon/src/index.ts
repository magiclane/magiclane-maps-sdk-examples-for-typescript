// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

import {
  GemKit,
  GemMap,
  PositionService,
  MapSceneObject,
  SceneObjectFileFormat,
  GemAnimation,
  AnimationType,
} from '@magiclane/maps-sdk';
import { GEMKIT_TOKEN, showMessage, ICONS } from '../../shared';

let map: GemMap | null = null;
let hasLiveDataSource = false;

// UI Elements
let followPositionBtn: HTMLButtonElement;

// Helper: load an image as ArrayBuffer
async function loadImageAsArrayBuffer(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to load image: ' + url);
  return await response.bytes();
}

// Set the custom icon for the position tracker
async function setPositionTrackerImage(imageUrl: string, scale = 1.0) {
  try {
    const imageData = await loadImageAsArrayBuffer(imageUrl);
    MapSceneObject.customizeDefPositionTracker(Array.from(imageData), SceneObjectFileFormat.tex);
    const positionTracker = MapSceneObject.getDefPositionTracker();
    positionTracker.scale = scale;
  } catch (e) {
    showMessage('Failed to set custom position icon: ' + e);
  }
}

async function onMapCreated(gemMap: GemMap) {
  map = gemMap;
  // Use a PNG icon from the Vite public folder (served from /)
  await setPositionTrackerImage('./navArrow.png', 0.7);
}

async function onFollowPositionButtonPressed() {
  // On web, the SDK handles location permission
  const permission = await PositionService.requestLocationPermission();
  if (!permission) {
    showMessage('Location permission denied.');
    return;
  }

  // Set live data source only once
  if (!hasLiveDataSource) {
    PositionService.instance.setLiveDataSource();
    hasLiveDataSource = true;
  }

  // Optionally, set an animation
  const animation = new GemAnimation({ type: AnimationType.linear });

  // Start following position
  map?.startFollowingPosition({ animation: animation, viewAngle: 0 });
  showMessage('Following position...');
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
  const wrapper = gemKit.createView(viewId, onMapCreated);
  if (wrapper) container.appendChild(wrapper);

  // Follow Position button
  followPositionBtn = document.createElement('button');
  followPositionBtn.innerHTML = `${ICONS.gps} Follow Position`;
  followPositionBtn.className = 'gem-button gem-button-primary gem-button-center';
  followPositionBtn.onclick = () => onFollowPositionButtonPressed();
  document.body.appendChild(followPositionBtn);
});
