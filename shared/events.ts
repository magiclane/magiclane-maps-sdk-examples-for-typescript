// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

/**
 * Event listener management utilities
 * Provides automatic cleanup of event listeners to prevent memory leaks
 */

/** Stored listener information for cleanup */
interface StoredListener {
  target: EventTarget;
  type: string;
  listener: EventListenerOrEventListenerObject;
  options?: boolean | AddEventListenerOptions;
}

/** SDK callback information for cleanup */
interface SDKCallback {
  type: string;
  unregister: () => void;
}

/**
 * EventListenerManager - Manages event listeners with automatic cleanup
 *
 * Usage:
 * ```typescript
 * const events = new EventListenerManager();
 *
 * // Add listeners
 * events.add(window, 'resize', handleResize);
 * events.add(button, 'click', handleClick);
 *
 * // Add SDK callbacks
 * events.addSDKCallback('touch', () => map.unregisterTouchCallback());
 *
 * // Clean up all listeners when done
 * events.cleanup();
 * ```
 */
export class EventListenerManager {
  private listeners: StoredListener[] = [];
  private sdkCallbacks: SDKCallback[] = [];
  private intervalIds: number[] = [];
  private timeoutIds: number[] = [];
  private animationFrameIds: number[] = [];

  /**
   * Add an event listener that will be automatically cleaned up
   * @param target - The event target (window, document, element)
   * @param type - Event type (e.g., 'click', 'resize')
   * @param listener - The event listener function
   * @param options - Optional event listener options
   * @returns A function to remove this specific listener
   */
  add<K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    listener: (this: Window, ev: WindowEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ): () => void;
  add<K extends keyof DocumentEventMap>(
    target: Document,
    type: K,
    listener: (this: Document, ev: DocumentEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ): () => void;
  add<K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ): () => void;
  add(
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): () => void;
  add(
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): () => void {
    target.addEventListener(type, listener, options);

    const storedListener: StoredListener = { target, type, listener, options };
    this.listeners.push(storedListener);

    // Return a function to remove this specific listener
    return () => this.remove(target, type, listener, options);
  }

  /**
   * Remove a specific event listener
   * @param target - The event target
   * @param type - Event type
   * @param listener - The event listener function
   * @param options - Optional event listener options
   */
  remove(
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void {
    target.removeEventListener(type, listener, options);

    // Remove from stored listeners
    this.listeners = this.listeners.filter(
      (l) => !(l.target === target && l.type === type && l.listener === listener)
    );
  }

  /**
   * Add an SDK callback that will be cleaned up
   * @param type - Callback type identifier (for debugging)
   * @param unregister - Function to unregister the callback
   */
  addSDKCallback(type: string, unregister: () => void): void {
    this.sdkCallbacks.push({ type, unregister });
  }

  /**
   * Add a setInterval that will be automatically cleaned up
   * @param callback - Interval callback
   * @param ms - Interval in milliseconds
   * @returns The interval ID
   */
  setInterval(callback: () => void, ms: number): number {
    const id = window.setInterval(callback, ms);
    this.intervalIds.push(id);
    return id;
  }

  /**
   * Clear a specific interval
   * @param id - The interval ID to clear
   */
  clearInterval(id: number): void {
    window.clearInterval(id);
    this.intervalIds = this.intervalIds.filter((i) => i !== id);
  }

  /**
   * Add a setTimeout that will be automatically cleaned up
   * @param callback - Timeout callback
   * @param ms - Timeout in milliseconds
   * @returns The timeout ID
   */
  setTimeout(callback: () => void, ms: number): number {
    const id = window.setTimeout(() => {
      callback();
      // Remove from list after execution
      this.timeoutIds = this.timeoutIds.filter((i) => i !== id);
    }, ms);
    this.timeoutIds.push(id);
    return id;
  }

  /**
   * Clear a specific timeout
   * @param id - The timeout ID to clear
   */
  clearTimeout(id: number): void {
    window.clearTimeout(id);
    this.timeoutIds = this.timeoutIds.filter((i) => i !== id);
  }

  /**
   * Add a requestAnimationFrame that will be automatically cleaned up
   * @param callback - Animation frame callback
   * @returns The animation frame ID
   */
  requestAnimationFrame(callback: FrameRequestCallback): number {
    const id = window.requestAnimationFrame((time) => {
      // Remove from list after execution
      this.animationFrameIds = this.animationFrameIds.filter((i) => i !== id);
      callback(time);
    });
    this.animationFrameIds.push(id);
    return id;
  }

  /**
   * Cancel a specific animation frame
   * @param id - The animation frame ID to cancel
   */
  cancelAnimationFrame(id: number): void {
    window.cancelAnimationFrame(id);
    this.animationFrameIds = this.animationFrameIds.filter((i) => i !== id);
  }

  /**
   * Clean up all registered event listeners, callbacks, and timers
   */
  cleanup(): void {
    // Remove all DOM event listeners
    for (const { target, type, listener, options } of this.listeners) {
      try {
        target.removeEventListener(type, listener, options);
      } catch (error) {
        console.warn(`[EventListenerManager] Failed to remove listener for '${type}':`, error);
      }
    }
    this.listeners = [];

    // Unregister all SDK callbacks
    for (const { type, unregister } of this.sdkCallbacks) {
      try {
        unregister();
      } catch (error) {
        console.warn(`[EventListenerManager] Failed to unregister SDK callback '${type}':`, error);
      }
    }
    this.sdkCallbacks = [];

    // Clear all intervals
    for (const id of this.intervalIds) {
      window.clearInterval(id);
    }
    this.intervalIds = [];

    // Clear all timeouts
    for (const id of this.timeoutIds) {
      window.clearTimeout(id);
    }
    this.timeoutIds = [];

    // Cancel all animation frames
    for (const id of this.animationFrameIds) {
      window.cancelAnimationFrame(id);
    }
    this.animationFrameIds = [];
  }

  /**
   * Get the count of registered listeners
   */
  get listenerCount(): number {
    return this.listeners.length;
  }

  /**
   * Get the count of SDK callbacks
   */
  get callbackCount(): number {
    return this.sdkCallbacks.length;
  }
}

/**
 * Global event manager instance for simple use cases
 * For complex applications, create your own instance
 */
export const globalEventManager = new EventListenerManager();

/**
 * Register cleanup on page unload
 * @param manager - The event manager to clean up
 */
export function registerCleanupOnUnload(manager: EventListenerManager): void {
  window.addEventListener('beforeunload', () => {
    manager.cleanup();
  });

  window.addEventListener('unload', () => {
    manager.cleanup();
  });
}

/**
 * Create a debounced event listener
 * @param callback - The callback to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced callback
 */
export function debounce<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: number | undefined;

  return (...args: Parameters<T>) => {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
    timeoutId = window.setTimeout(() => {
      callback(...args);
      timeoutId = undefined;
    }, delay);
  };
}

/**
 * Create a throttled event listener
 * @param callback - The callback to throttle
 * @param limit - Minimum time between calls in milliseconds
 * @returns Throttled callback
 */
export function throttle<T extends (...args: unknown[]) => void>(
  callback: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      callback(...args);
      inThrottle = true;
      window.setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}
