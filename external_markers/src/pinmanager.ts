// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

import { GemMap } from '@magiclane/maps-sdk';

// Interface for pin data with screen coordinates and optional metadata
interface PinData {
  screenCoordinates: { x: number; y: number };
  title?: string;
}

export class PinManager {
  private pins: Map<number, HTMLElement> = new Map();
  private container: HTMLElement;

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error('Container not found');
    this.container = container;
  }

  updatePins(visiblePoints: Map<number, PinData>, map: GemMap | null) {
    // First remove pins that are no longer visible
    const currentIds = new Set(visiblePoints.keys());
    this.pins.forEach((pin, id) => {
      if (!currentIds.has(id)) {
        pin.remove();
        this.pins.delete(id);
      }
    });

    const mapWidth = this.container.clientWidth;
    const mapHeight = this.container.clientHeight;
    // Add or update visible pins
    visiblePoints.forEach((value, key) => {
      const normalizedX = value.screenCoordinates.x; // [0, 1] range
      const normalizedY = value.screenCoordinates.y; // [0, 1] range

      // Convert to actual pixel coordinates
      const screenCoordinates = { x: normalizedX * mapWidth, y: normalizedY * mapHeight };
      if (!screenCoordinates) return;

      let pin = this.pins.get(key);
      if (!pin) {
        pin = this.createPinElement();
        this.pins.set(key, pin);
        this.container.appendChild(pin);
      }

      this.updatePinPosition(pin, screenCoordinates);
      this.updatePinContent(pin, value);
    });
  }

  private createPinElement(): HTMLElement {
    const pin = document.createElement('div');
    // IMPROVEMENT: Use an SVG icon instead of a red box/circle
    pin.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" height="40" viewBox="0 0 24 24" width="40" fill="#EA4335">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        <path d="M0 0h24v24H0z" fill="none"/>
      </svg>
    `;
    pin.style.position = 'absolute';
    pin.style.width = '40px';
    pin.style.height = '40px';
    // Remove background color as the SVG handles the color
    pin.style.backgroundColor = 'transparent';
    pin.style.transform = 'translate(-50%, -100%)'; // Anchor at bottom center of the pin
    pin.style.zIndex = '1000';
    pin.style.cursor = 'pointer';
    // Add a subtle drop shadow filter to the SVG itself
    pin.style.filter = 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))';

    return pin;
  }

  private updatePinPosition(pin: HTMLElement, coords: { x: number; y: number }) {
    pin.style.left = `${coords.x}px`;
    pin.style.top = `${coords.y}px`;
  }

  private updatePinContent(pin: HTMLElement, data: PinData) {
    if (data.title) {
      pin.title = data.title;
    }
    // You can customize the pin appearance based on the data
  }

  clearAll() {
    this.pins.forEach((pin) => pin.remove());
    this.pins.clear();
  }
}
