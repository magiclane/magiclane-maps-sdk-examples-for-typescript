// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

/**
 * Common UI utilities for toast messages and button styling
 */

import { styles, applyStyles, mergeStyles, StyleObject, FONT_STACK } from './styles';

/** Default font stack used across examples (re-exported for backward compatibility) */
export const DEFAULT_FONT_STACK = FONT_STACK;

/**
 * Display a toast message that automatically disappears
 * @param message - Message to display (empty string to hide)
 * @param duration - Duration in milliseconds (default: 3000)
 * @param elementId - Optional custom element ID (default: 'status-msg')
 */
export function showMessage(message: string, duration = 3000, elementId = 'status-msg'): void {
  let msgDiv = document.getElementById(elementId);

  if (!msgDiv) {
    msgDiv = document.createElement('div');
    msgDiv.id = elementId;
    applyStyles(msgDiv, styles.toast);
    document.body.appendChild(msgDiv);
  }

  if (message === '') {
    msgDiv.style.opacity = '0';
    setTimeout(() => {
      if (msgDiv) msgDiv.style.display = 'none';
    }, 300);
  } else {
    msgDiv.style.display = 'block';
    requestAnimationFrame(() => {
      if (msgDiv) msgDiv.style.opacity = '1';
    });
    msgDiv.textContent = message;

    setTimeout(() => {
      if (msgDiv) {
        msgDiv.style.opacity = '0';
        setTimeout(() => {
          if (msgDiv) {
            msgDiv.style.display = 'none';
            msgDiv.textContent = '';
          }
        }, 300);
      }
    }, duration);
  }
}

export interface StyleButtonOptions {
  /** Position: 'fixed' or 'relative' */
  position?: 'fixed' | 'relative' | 'absolute';
  /** Top position (for fixed positioning) */
  top?: string;
  /** Left position (for fixed positioning) */
  left?: string;
  /** CSS transform value */
  transform?: string;
  /** Initial display style */
  display?: string;
  /** Additional styles to merge */
  additionalStyles?: StyleObject;
}

/**
 * Apply consistent pill-shaped button styling
 * @param btn - Button element to style
 * @param color - Primary background color (hex)
 * @param hoverColor - Hover background color (hex)
 * @param options - Additional styling options
 */
export function styleButton(
  btn: HTMLButtonElement,
  color: string,
  hoverColor: string,
  options: StyleButtonOptions = {}
): void {
  const {
    position = 'fixed',
    top = '30px',
    left = '50%',
    transform = 'translateX(-50%)',
    display = 'none',
    additionalStyles = {},
  } = options;

  const buttonStyles = mergeStyles(
    styles.buttonBase,
    {
      position,
      top,
      left,
      transform,
      display,
      background: color,
      boxShadow: `0 4px 15px ${color}66`,
    },
    additionalStyles
  );

  applyStyles(btn, buttonStyles);

  const baseTransform = transform;

  btn.onmouseenter = () => {
    applyStyles(btn, {
      transform: `${baseTransform} translateY(-2px)`,
      boxShadow: `0 6px 20px ${color}99`,
      background: hoverColor,
    });
  };

  btn.onmouseleave = () => {
    applyStyles(btn, {
      transform: `${baseTransform} translateY(0)`,
      boxShadow: `0 4px 15px ${color}66`,
      background: color,
    });
  };

  btn.onmousedown = () => {
    applyStyles(btn, {
      transform: `${baseTransform} translateY(1px)`,
    });
  };
}

/**
 * Create a styled button with icon and text
 * @param icon - SVG icon HTML string
 * @param text - Button text
 * @param color - Primary background color
 * @param hoverColor - Hover background color
 * @param onClick - Click handler
 * @param options - Additional styling options
 * @returns Configured button element
 */
export function createButton(
  icon: string,
  text: string,
  color: string,
  hoverColor: string,
  onClick: () => void,
  options: StyleButtonOptions = {}
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.innerHTML = `${icon} ${text}`;
  styleButton(btn, color, hoverColor, options);
  btn.onclick = onClick;
  return btn;
}

/**
 * Create a simple close button
 * @param onClick - Click handler
 * @returns Styled close button
 */
export function createCloseButton(onClick: () => void): HTMLButtonElement {
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 0 24 24" width="24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
  applyStyles(closeBtn, styles.iconButton);
  closeBtn.onclick = onClick;
  return closeBtn;
}

/**
 * Create a modal overlay
 * @param onBackdropClick - Optional callback when backdrop is clicked
 * @returns Modal overlay element
 */
export function createModalOverlay(onBackdropClick?: () => void): HTMLDivElement {
  const overlay = document.createElement('div');
  applyStyles(overlay, styles.modalOverlay);
  overlay.style.display = 'none';

  if (onBackdropClick) {
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        onBackdropClick();
      }
    };
  }

  return overlay;
}

/**
 * Create a modal content container
 * @returns Modal content element
 */
export function createModalContent(): HTMLDivElement {
  const content = document.createElement('div');
  applyStyles(content, styles.modalContent);
  return content;
}

/**
 * Create a modal header with title and close button
 * @param title - Modal title
 * @param onClose - Close button click handler
 * @returns Header element
 */
export function createModalHeader(title: string, onClose: () => void): HTMLDivElement {
  const header = document.createElement('div');
  applyStyles(header, styles.modalHeader);

  const titleEl = document.createElement('h2');
  applyStyles(titleEl, styles.heading);
  titleEl.textContent = title;

  const closeBtn = createCloseButton(onClose);
  applyStyles(
    closeBtn,
    mergeStyles(styles.iconButton, {
      background: 'rgba(0,0,0,0.05)',
      borderRadius: '50%',
      width: '32px',
      height: '32px',
    })
  );

  header.appendChild(titleEl);
  header.appendChild(closeBtn);

  return header;
}

/**
 * Create a sidebar panel
 * @returns Sidebar element
 */
export function createSidebar(): HTMLDivElement {
  const sidebar = document.createElement('div');
  applyStyles(sidebar, styles.sidebar);
  return sidebar;
}

/**
 * Create a sidebar header
 * @param title - Header title
 * @param onClose - Close button handler
 * @returns Header element
 */
export function createSidebarHeader(title: string, onClose: () => void): HTMLDivElement {
  const header = document.createElement('div');
  applyStyles(header, styles.sidebarHeader);

  const titleEl = document.createElement('h2');
  applyStyles(titleEl, mergeStyles(styles.heading, { fontSize: '20px', color: '#333' }));
  titleEl.textContent = title;

  const closeBtn = createCloseButton(onClose);

  header.appendChild(titleEl);
  header.appendChild(closeBtn);

  return header;
}

/**
 * Create a card/list item element
 * @param content - Card content
 * @param onClick - Optional click handler
 * @returns Card element
 */
export function createCard(onClick?: () => void): HTMLDivElement {
  const card = document.createElement('div');
  applyStyles(card, styles.card);

  card.onmouseenter = () => (card.style.background = '#f5f5f5');
  card.onmouseleave = () => (card.style.background = '#fff');

  if (onClick) {
    card.onclick = onClick;
  }

  return card;
}

/**
 * Create a controls bar container
 * @returns Controls bar element
 */
export function createControlsBar(): HTMLDivElement {
  const controlsDiv = document.createElement('div');
  applyStyles(controlsDiv, styles.controlsBar);
  return controlsDiv;
}

/**
 * Create a loading spinner
 * @returns Spinner container element
 */
export function createSpinner(): HTMLDivElement {
  const container = document.createElement('div');
  container.style.textAlign = 'center';
  container.style.padding = '40px';
  container.style.color = '#666';

  const spinner = document.createElement('div');
  applyStyles(spinner, styles.spinner);
  spinner.style.animation = 'spin 1s linear infinite';

  // Inject spin animation if not present
  if (!document.getElementById('keyframes-spin')) {
    const style = document.createElement('style');
    style.id = 'keyframes-spin';
    style.textContent =
      '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
    document.head.appendChild(style);
  }

  container.appendChild(spinner);

  return container;
}

/**
 * Create a speed indicator panel (for navigation examples)
 * @returns Speed indicator element
 */
export function createSpeedIndicator(): HTMLDivElement {
  const container = document.createElement('div');
  applyStyles(container, styles.speedIndicator);
  return container;
}

/**
 * Create a speed limit circle (traffic sign style)
 * @returns Speed limit element
 */
export function createSpeedLimit(): HTMLDivElement {
  const limitContainer = document.createElement('div');
  applyStyles(limitContainer, styles.speedLimit);
  limitContainer.textContent = '--';
  return limitContainer;
}
