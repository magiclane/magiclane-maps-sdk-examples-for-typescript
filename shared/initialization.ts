// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

/**
 * SDK initialization utilities with proper error handling
 */

import { showMessage } from './ui';

/** Error types that can occur during SDK initialization */
export enum InitializationErrorType {
  InvalidToken = 'INVALID_TOKEN',
  NetworkError = 'NETWORK_ERROR',
  ContainerNotFound = 'CONTAINER_NOT_FOUND',
  InitializationFailed = 'INITIALIZATION_FAILED',
  ViewCreationFailed = 'VIEW_CREATION_FAILED',
  Unknown = 'UNKNOWN_ERROR',
}

/** Initialization error with typed error information */
export class InitializationError extends Error {
  constructor(
    public readonly type: InitializationErrorType,
    message: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'InitializationError';
  }
}

/** Options for SDK initialization */
export interface InitializeSDKOptions {
  /** The container element ID for the map */
  containerId?: string;
  /** Whether to show error messages to the user */
  showErrorMessages?: boolean;
  /** Custom error handler */
  onError?: (error: InitializationError) => void;
  /** Timeout in milliseconds for initialization (default: 30000) */
  timeout?: number;
}

/** Result of SDK initialization */
export interface InitializeSDKResult<T> {
  success: boolean;
  gemKit?: T;
  container?: HTMLElement;
  error?: InitializationError;
}

/**
 * Initialize the GemKit SDK with proper error handling
 * @param GemKit - The GemKit class from the SDK
 * @param token - The API token
 * @param options - Initialization options
 * @returns Promise with initialization result
 */
export async function initializeSDK<T>(
  GemKit: { initialize: (token: string) => Promise<T> },
  token: string,
  options: InitializeSDKOptions = {}
): Promise<InitializeSDKResult<T>> {
  const {
    containerId = 'map-container',
    showErrorMessages = true,
    onError,
    timeout = 30000,
  } = options;

  const handleError = (error: InitializationError) => {
    console.error(`[SDK Initialization Error] ${error.type}:`, error.message, error.originalError);

    if (showErrorMessages) {
      showMessage(`Error: ${error.message}`, 5000);
    }

    if (onError) {
      onError(error);
    }

    return { success: false, error };
  };

  // Validate token
  if (!token || typeof token !== 'string' || token.trim() === '') {
    return handleError(
      new InitializationError(
        InitializationErrorType.InvalidToken,
        'Invalid or missing API token. Please check your token configuration.'
      )
    );
  }

  // Find container element
  const container = document.getElementById(containerId);
  if (!container) {
    return handleError(
      new InitializationError(
        InitializationErrorType.ContainerNotFound,
        `Map container element with ID '${containerId}' not found.`
      )
    );
  }

  // Initialize SDK with timeout
  try {
    const initPromise = GemKit.initialize(token);

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`SDK initialization timed out after ${timeout}ms`));
      }, timeout);
    });

    const gemKit = await Promise.race([initPromise, timeoutPromise]);

    return {
      success: true,
      gemKit,
      container,
    };
  } catch (error) {
    // Determine error type based on error message/type
    let errorType = InitializationErrorType.InitializationFailed;
    let message = 'Failed to initialize the Maps SDK.';

    if (error instanceof Error) {
      const errorMsg = error.message.toLowerCase();

      if (
        errorMsg.includes('network') ||
        errorMsg.includes('fetch') ||
        errorMsg.includes('connection')
      ) {
        errorType = InitializationErrorType.NetworkError;
        message = 'Network error occurred. Please check your internet connection.';
      } else if (
        errorMsg.includes('token') ||
        errorMsg.includes('auth') ||
        errorMsg.includes('unauthorized')
      ) {
        errorType = InitializationErrorType.InvalidToken;
        message = 'Invalid API token. Please verify your token is correct.';
      } else if (errorMsg.includes('timeout')) {
        errorType = InitializationErrorType.InitializationFailed;
        message = 'SDK initialization timed out. Please try again.';
      } else {
        message = error.message || message;
      }
    }

    return handleError(new InitializationError(errorType, message, error));
  }
}

/**
 * Create a map view with error handling
 * @param gemKit - Initialized GemKit instance
 * @param container - Container element
 * @param viewId - View ID
 * @param onMapCreated - Callback when map is created
 * @param options - Options
 * @returns The wrapper element or null on error
 */
export function createMapView<
  TGemKit extends { createView: (id: number, callback: (map: TMap) => void) => HTMLElement | null },
  TMap,
>(
  gemKit: TGemKit,
  container: HTMLElement,
  viewId: number,
  onMapCreated: (map: TMap) => void,
  options: { showErrorMessages?: boolean } = {}
): HTMLElement | null {
  const { showErrorMessages = true } = options;

  try {
    const wrapper = gemKit.createView(viewId, onMapCreated);

    if (!wrapper) {
      const error = new InitializationError(
        InitializationErrorType.ViewCreationFailed,
        'Failed to create map view. The SDK returned null.'
      );
      console.error('[SDK View Creation Error]', error.message);

      if (showErrorMessages) {
        showMessage('Error: Failed to create map view.', 5000);
      }

      return null;
    }

    container.appendChild(wrapper);
    return wrapper;
  } catch (error) {
    const initError = new InitializationError(
      InitializationErrorType.ViewCreationFailed,
      'An error occurred while creating the map view.',
      error
    );
    console.error('[SDK View Creation Error]', initError.message, error);

    if (showErrorMessages) {
      showMessage('Error: Failed to create map view.', 5000);
    }

    return null;
  }
}

/**
 * Wrapper for safe async initialization in DOMContentLoaded
 * @param initFn - The initialization function to run
 */
export function safeInitialize(initFn: () => Promise<void>): void {
  window.addEventListener('DOMContentLoaded', async () => {
    try {
      await initFn();
    } catch (error) {
      console.error('[Initialization Error] Unhandled error during initialization:', error);
      showMessage('An unexpected error occurred during initialization.', 5000);
    }
  });
}
