// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

import { GemKit, GemMap, PositionService } from '@magiclane/maps-sdk';
import { GEMKIT_TOKEN, showMessage } from '../../shared';

// Type for screen position coordinates
interface ScreenPosition {
  x: number;
  y: number;
}

// Gesture-specific icons (not in shared ICONS)
const GESTURE_ICONS = {
  touch: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="currentColor"><path d="M9 11.24V7.5C9 6.12 10.12 5 11.5 5S14 6.12 14 7.5v3.74c1.21-.81 2-2.18 2-3.74C16 5.01 13.99 3 11.5 3S7 5.01 7 7.5c0 1.56.79 2.93 2 3.74zm9.84 4.63l-4.54-2.26c-.17-.07-.35-.11-.54-.11H13v-6c0-.83-.67-1.5-1.5-1.5S10 6.67 10 7.5v10.74l-3.43-.72c-.08-.01-.15-.03-.24-.03-.31 0-.59.13-.79.33l-.79.8 4.94 4.94c.27.27.65.44 1.06.44h6.79c.75 0 1.33-.55 1.44-1.28l.75-5.27c.01-.07.02-.14.02-.2 0-.62-.38-1.16-.91-1.38z"/></svg>`,
  rotate: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="currentColor"><path d="M15.55 5.55L11 1v3.07C7.06 4.56 4 7.92 4 12s3.05 7.44 7 7.93v-2.02c-2.84-.48-5-2.94-5-5.91s2.16-5.43 5-5.91V10l4.55-4.45zM19.93 11c-.17-1.39-.72-2.73-1.62-3.89l-1.42 1.42c.54.75.88 1.6 1.02 2.47h2.02zM13 17.9v2.02c1.39-.17 2.74-.71 3.9-1.61l-1.44-1.44c-.75.54-1.59.89-2.46 1.03zm3.89-2.42l1.42 1.41c.9-1.16 1.45-2.5 1.62-3.89h-2.02c-.14.87-.48 1.72-1.02 2.48z"/></svg>`,
  pan: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="currentColor"><path d="M23 5.5V20c0 2.2-1.8 4-4 4h-7.3c-1.08 0-2.1-.43-2.85-1.19L1 14.83s1.26-1.23 1.3-1.25c.22-.19.49-.29.79-.29.22 0 .42.06.6.16.04.01 4.31 2.46 4.31 2.46V4c0-.83.67-1.5 1.5-1.5S11 3.17 11 4v7h1V1.5c0-.83.67-1.5 1.5-1.5S15 .67 15 1.5V11h1V2.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5V11h1V5.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5z"/></svg>`,
  longPress: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`,
  pinch: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="currentColor"><path d="M6 2.5V1h5v5H9.5V3.56L3.56 9.5H6V11H1V6h1.5v2.44L8.44 2.5H6zm12 0h-2.44l6.94 6.94V6H24v5h-5V9.5h2.44L14.5 2.56V5H13V0h5v1.5h-2zM6 21.5h2.44L1.5 14.56V17H0v-5h5v1.5H2.56L9.5 20.44V18H11v5H6v-1.5zm12 0V23h-5v-5h1.5v2.44l6.94-6.94H18V12h5v5h-1.5v-2.44L14.56 21.5H17z"/></svg>`,
  swipe: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="currentColor"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>`,
  shove: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="currentColor"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/></svg>`,
  double: `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/><circle cx="12" cy="12" r="5"/></svg>`,
};

let map: GemMap | null = null;
let gesturePanel: HTMLDivElement | null = null;
let hideTimeout: ReturnType<typeof setTimeout> | null = null;

// Gesture to icon mapping
function getGestureIcon(gesture: string): string {
  if (gesture.includes('Rotate')) return GESTURE_ICONS.rotate;
  if (gesture.includes('Touch Pinch')) return GESTURE_ICONS.pinch;
  if (gesture.includes('Double Touch')) return GESTURE_ICONS.double;
  if (gesture.includes('Two Touches')) return GESTURE_ICONS.double;
  if (gesture.includes('Touch')) return GESTURE_ICONS.touch;
  if (gesture.includes('Pan')) return GESTURE_ICONS.pan;
  if (gesture.includes('Long Press')) return GESTURE_ICONS.longPress;
  if (gesture.includes('Pinch Swipe')) return GESTURE_ICONS.pinch;
  if (gesture.includes('Pinch')) return GESTURE_ICONS.pinch;
  if (gesture.includes('Shove')) return GESTURE_ICONS.shove;
  if (gesture.includes('Swipe')) return GESTURE_ICONS.swipe;
  return GESTURE_ICONS.touch;
}

// Helper to show gesture panel with modern design
function showGesturePanel(gesture: string) {
  if (!gesturePanel) {
    gesturePanel = document.createElement('div');
    gesturePanel.style.cssText = `
      position: fixed;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      padding: 16px 28px;
      background: rgba(33, 33, 33, 0.95);
      color: #fff;
      border-radius: 50px;
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-weight: 600;
      box-shadow: 0 8px 24px rgba(0,0,0,0.25);
      backdrop-filter: blur(8px);
      z-index: 2000;
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
      opacity: 0;
      letter-spacing: 0.3px;
    `;
    document.body.appendChild(gesturePanel);
  }

  // Clear any existing hide timeout
  if (hideTimeout) {
    clearTimeout(hideTimeout);
  }

  const icon = getGestureIcon(gesture);
  gesturePanel.innerHTML = `
    <div style="display: flex; align-items: center; color: #fff;">${icon}</div>
    <span>${gesture}</span>
  `;

  // Animate in
  requestAnimationFrame(() => {
    if (gesturePanel) {
      gesturePanel.style.transform = 'translateX(-50%) translateY(0)';
      gesturePanel.style.opacity = '1';
    }
  });

  // Auto-hide after 2 seconds
  hideTimeout = setTimeout(() => {
    if (gesturePanel) {
      gesturePanel.style.transform = 'translateX(-50%) translateY(100px)';
      gesturePanel.style.opacity = '0';
    }
  }, 2000);
}

// Map created callback
function onMapCreated(gemMap: GemMap) {
  map = gemMap;

  // Register gesture callbacks with descriptive labels
  map.registerMapAngleUpdateCallback((angle: number) => {
    showGesturePanel('Rotate Map');
    console.log('Gesture: onMapAngleUpdate', angle);
  });

  map.registerTouchCallback((point: ScreenPosition) => {
    showGesturePanel('Touch');
    console.log('Gesture: onTouch', point);
  });

  map.registerMoveCallback((point1: ScreenPosition, point2: ScreenPosition) => {
    showGesturePanel('Pan Map');
    console.log(`Gesture: onMove from (${point1.x} ${point1.y}) to (${point2.x} ${point2.y})`);
  });

  map.registerLongPressCallback((point: ScreenPosition) => {
    showGesturePanel('Long Press');
    console.log('Gesture: onLongPress', point);
  });

  map.registerDoubleTouchCallback((point: ScreenPosition) => {
    showGesturePanel('Double Touch');
    console.log('Gesture: onDoubleTouch', point);
  });

  map.registerPinchCallback(
    (
      p1: ScreenPosition,
      p2: ScreenPosition,
      p3: ScreenPosition,
      p4: ScreenPosition,
      p5: ScreenPosition
    ) => {
      showGesturePanel('Pinch to Zoom');
      console.log(`Gesture: onPinch from (${p1.x} ${p1.y}) to (${p2.x} ${p2.y})`);
    }
  );

  map.registerShoveCallback(
    (degrees: number, p1: ScreenPosition, p2: ScreenPosition, p3: ScreenPosition) => {
      showGesturePanel('Shove (Tilt)');
      console.log(
        `Gesture: onShove with ${degrees} angle from (${p1.x} ${p1.y}) to (${p2.x} ${p2.y})`
      );
    }
  );

  map.registerSwipeCallback((distX: number, distY: number, speedMMPerSec: number) => {
    showGesturePanel('Swipe');
    console.log(
      `Gesture: onSwipe with ${distX} distance in X and ${distY} distance in Y at ${speedMMPerSec} mm/s`
    );
  });

  map.registerPinchSwipeCallback(
    (point: ScreenPosition, zoomSpeed: number, rotateSpeed: number) => {
      showGesturePanel('Pinch & Rotate');
      console.log(
        `Gesture: onPinchSwipe with zoom speed ${zoomSpeed} and rotate speed ${rotateSpeed}`
      );
    }
  );

  map.registerTwoTouchesCallback((point: ScreenPosition) => {
    showGesturePanel('Two Touches');
    console.log('Gesture: onTwoTouches', point);
  });

  map.registerTouchPinchCallback(
    (p1: ScreenPosition, p2: ScreenPosition, p3: ScreenPosition, p4: ScreenPosition) => {
      showGesturePanel('Touch Pinch');
      console.log(`Gesture: onTouchPinch from (${p1.x} ${p1.y}) to (${p2.x} ${p2.y})`);
    }
  );
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

  const viewId = 4;
  const wrapper = gemKit.createView(viewId, (gemMap: GemMap) => {
    onMapCreated(gemMap);
  });
  if (wrapper) container.appendChild(wrapper);
});
