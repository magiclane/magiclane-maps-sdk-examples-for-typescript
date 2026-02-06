// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

/**
 * CSS styling utilities and class-based style management
 * Replaces inline CSS strings with maintainable style objects and CSS injection
 */

/** Default font stack used across examples */
export const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/** Style object type for type-safe CSS properties */
export type StyleObject = Partial<CSSStyleDeclaration>;

/**
 * Apply a style object to an HTML element
 * @param element - Target element
 * @param styles - Style object with CSS properties
 */
export function applyStyles(element: HTMLElement, styles: StyleObject): void {
  Object.assign(element.style, styles);
}

/**
 * Create a style object from common presets
 */
export const styles = {
  // ============== POSITIONING ==============
  fixed: {
    position: 'fixed' as const,
  },
  absolute: {
    position: 'absolute' as const,
  },
  relative: {
    position: 'relative' as const,
  },
  centerHorizontal: {
    left: '50%',
    transform: 'translateX(-50%)',
  },
  centerBoth: {
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
  },

  // ============== FLEXBOX ==============
  flexRow: {
    display: 'flex',
    flexDirection: 'row' as const,
    alignItems: 'center',
  },
  flexColumn: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  flexCenter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flexBetween: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // ============== TOAST / MESSAGE ==============
  toast: {
    position: 'fixed' as const,
    bottom: '40px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(33, 33, 33, 0.95)',
    color: '#fff',
    padding: '12px 24px',
    borderRadius: '50px',
    zIndex: '2000',
    fontSize: '0.95em',
    fontFamily: FONT_STACK,
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    backdropFilter: 'blur(4px)',
    transition: 'opacity 0.3s ease',
    display: 'none',
  },

  // ============== BUTTONS ==============
  buttonBase: {
    padding: '12px 24px',
    color: '#fff',
    border: 'none',
    borderRadius: '50px',
    fontSize: '15px',
    fontFamily: FONT_STACK,
    fontWeight: '600',
    cursor: 'pointer',
    zIndex: '2000',
    transition: 'all 0.2s ease-in-out',
    letterSpacing: '0.5px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    whiteSpace: 'nowrap' as const,
  },
  buttonPrimary: {
    background: '#673ab7',
    boxShadow: '0 4px 15px rgba(103, 58, 183, 0.4)',
  },
  buttonSuccess: {
    background: '#4caf50',
    boxShadow: '0 4px 15px rgba(76, 175, 80, 0.4)',
  },
  buttonDanger: {
    background: '#f44336',
    boxShadow: '0 4px 15px rgba(244, 67, 54, 0.4)',
  },
  buttonInfo: {
    background: '#2196f3',
    boxShadow: '0 4px 15px rgba(33, 150, 243, 0.4)',
  },
  buttonSecondary: {
    background: '#fff',
    color: '#333',
    boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
  },
  iconButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#666',
    padding: '5px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ============== PANELS / MODALS ==============
  panel: {
    background: 'rgba(255, 255, 255, 0.98)',
    backdropFilter: 'blur(10px)',
    borderRadius: '24px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
    padding: '24px',
    zIndex: '2000',
    fontFamily: FONT_STACK,
  },
  modalOverlay: {
    position: 'fixed' as const,
    zIndex: '4000',
    left: '0',
    top: '0',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.4)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    background: 'rgba(255, 255, 255, 0.95)',
    width: '90%',
    maxWidth: '500px',
    borderRadius: '20px',
    maxHeight: '80vh',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  modalHeader: {
    padding: '20px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid rgba(0,0,0,0.05)',
  },

  // ============== SIDEBAR ==============
  sidebar: {
    position: 'fixed' as const,
    top: '0',
    left: '0',
    bottom: '0',
    width: '360px',
    background: '#fff',
    zIndex: '2500',
    boxShadow: '4px 0 20px rgba(0,0,0,0.1)',
    transform: 'translateX(-105%)',
    transition: 'transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
    display: 'flex',
    flexDirection: 'column' as const,
    fontFamily: FONT_STACK,
  },
  sidebarHeader: {
    padding: '20px',
    borderBottom: '1px solid #eee',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // ============== CARDS / LIST ITEMS ==============
  card: {
    padding: '12px',
    marginBottom: '8px',
    border: '1px solid #eee',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background 0.2s',
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px 24px',
    borderBottom: '1px solid rgba(0,0,0,0.05)',
    transition: 'background 0.2s ease',
  },

  // ============== FORM ELEMENTS ==============
  input: {
    width: '100%',
    padding: '12px',
    borderRadius: '12px',
    border: '1px solid #e0e0e0',
    background: '#f5f5f5',
    fontSize: '14px',
    color: '#333',
    outline: 'none',
  },
  select: {
    width: '100%',
    padding: '12px',
    borderRadius: '12px',
    border: '1px solid #e0e0e0',
    background: '#f5f5f5',
    fontSize: '14px',
    color: '#333',
    outline: 'none',
    cursor: 'pointer',
  },
  slider: {
    width: '100%',
    accentColor: '#2196f3',
    height: '6px',
    borderRadius: '3px',
    cursor: 'pointer',
  },

  // ============== ICONS / IMAGES ==============
  iconContainer: {
    width: '48px',
    height: '48px',
    flexShrink: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#ede7f6',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  avatar: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    objectFit: 'cover' as const,
  },

  // ============== INDICATORS ==============
  speedIndicator: {
    position: 'fixed' as const,
    top: '90px',
    right: '20px',
    width: '140px',
    background: 'rgba(33, 33, 33, 0.9)',
    color: 'white',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
    padding: '16px',
    fontFamily: FONT_STACK,
    zIndex: '2000',
    backdropFilter: 'blur(10px)',
  },
  speedLimit: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: '#fff',
    border: '4px solid #d32f2f',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '800',
    fontSize: '18px',
    color: '#333',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
  },

  // ============== CONTROLS CONTAINER ==============
  controlsBar: {
    position: 'fixed' as const,
    top: '30px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: '12px',
    zIndex: '2000',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ============== TYPOGRAPHY ==============
  heading: {
    margin: '0',
    fontSize: '20px',
    fontWeight: '600',
    color: '#1a1a1a',
    fontFamily: FONT_STACK,
  },
  subheading: {
    margin: '0',
    fontSize: '14px',
    fontWeight: '600',
    color: '#444',
  },
  text: {
    fontSize: '14px',
    color: '#333',
    fontFamily: FONT_STACK,
  },
  textMuted: {
    fontSize: '13px',
    color: '#666',
  },
  textSmall: {
    fontSize: '12px',
    color: '#aaa',
  },

  // ============== LOADING ==============
  spinner: {
    width: '30px',
    height: '30px',
    border: '3px solid #f3f3f3',
    borderTop: '3px solid #673ab7',
    borderRadius: '50%',
    margin: '0 auto 16px',
  },
};

/**
 * Merge multiple style objects into one
 * @param styleObjects - Style objects to merge
 * @returns Merged style object
 */
export function mergeStyles(...styleObjects: StyleObject[]): StyleObject {
  return Object.assign({}, ...styleObjects);
}

/**
 * Create CSS keyframes and inject into document
 * @param name - Animation name
 * @param keyframes - Keyframe definitions
 */
export function injectKeyframes(name: string, keyframes: string): void {
  if (document.getElementById(`keyframes-${name}`)) return;

  const style = document.createElement('style');
  style.id = `keyframes-${name}`;
  style.textContent = `@keyframes ${name} { ${keyframes} }`;
  document.head.appendChild(style);
}

/** Common keyframe animations */
export const animations = {
  spin: '0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); }',
  fadeIn: 'from { opacity: 0; } to { opacity: 1; }',
  slideUp:
    'from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; }',
  slideInLeft: 'from { transform: translateX(-100%); } to { transform: translateX(0); }',
  slideInRight: 'from { transform: translateX(100%); } to { transform: translateX(0); }',
  pulse: '0%, 100% { opacity: 1; } 50% { opacity: 0.5; }',
};

/**
 * Inject all common animations into document
 */
export function injectCommonAnimations(): void {
  Object.entries(animations).forEach(([name, keyframes]) => {
    injectKeyframes(name, keyframes);
  });
}

/**
 * CSS class manager for dynamic class-based styling
 */
export class StyleManager {
  private static styleElement: HTMLStyleElement | null = null;
  private static rules: Map<string, string> = new Map();

  /**
   * Initialize the style manager with a style element
   */
  static init(): void {
    if (this.styleElement) return;

    this.styleElement = document.createElement('style');
    this.styleElement.id = 'gem-sdk-styles';
    document.head.appendChild(this.styleElement);
  }

  /**
   * Add a CSS class rule
   * @param className - Class name (without dot)
   * @param styles - Style object
   */
  static addClass(className: string, styleObj: StyleObject): void {
    this.init();

    const cssText = Object.entries(styleObj)
      .map(([prop, value]) => {
        // Convert camelCase to kebab-case
        const kebabProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
        return `${kebabProp}: ${value}`;
      })
      .join('; ');

    this.rules.set(className, cssText);
    this.updateStylesheet();
  }

  /**
   * Remove a CSS class rule
   * @param className - Class name to remove
   */
  static removeClass(className: string): void {
    this.rules.delete(className);
    this.updateStylesheet();
  }

  /**
   * Update the stylesheet with all current rules
   */
  private static updateStylesheet(): void {
    if (!this.styleElement) return;

    const css = Array.from(this.rules.entries())
      .map(([className, rules]) => `.${className} { ${rules} }`)
      .join('\n');

    this.styleElement.textContent = css;
  }

  /**
   * Add hover styles to an element
   * @param element - Target element
   * @param hoverStyles - Styles to apply on hover
   * @param baseStyles - Optional base styles to restore on mouse leave
   */
  static addHoverEffect(
    element: HTMLElement,
    hoverStyles: StyleObject,
    baseStyles?: StyleObject
  ): void {
    const originalStyles: StyleObject = {};

    // Capture original styles for properties we'll change
    Object.keys(hoverStyles).forEach((key) => {
      originalStyles[key as keyof StyleObject] = element.style[
        key as keyof CSSStyleDeclaration
      ] as string;
    });

    element.addEventListener('mouseenter', () => {
      applyStyles(element, hoverStyles);
    });

    element.addEventListener('mouseleave', () => {
      applyStyles(element, baseStyles || originalStyles);
    });
  }
}

/**
 * Create element with styles applied
 * @param tag - HTML tag name
 * @param styleObj - Style object to apply
 * @param attributes - Optional attributes to set
 * @returns Created element
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  styleObj?: StyleObject,
  attributes?: Record<string, string>
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);

  if (styleObj) {
    applyStyles(element, styleObj);
  }

  if (attributes) {
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
  }

  return element;
}
