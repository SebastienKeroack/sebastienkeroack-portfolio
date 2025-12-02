/**
 * Manages the application's theme functionality, including detecting the user's
 * preferred color scheme, storing the selected theme in local storage, and
 * dynamically updating the theme across the application. Provides utilities
 * for theme inversion and listener management for theme changes.
 *
 * @author
 * Sébastien Kéroack <dev@sebastienkeroack.com>
 * @copyright
 * 2025 Sébastien Kéroack. All rights reserved.
 * @license
 * https://github.com/SebastienKeroack/skportfolio/blob/main/LICENSE
 * Apache License
 */

/**
 * Retrieves the current theme from local storage or detects the user's
 * preferred color scheme if no theme is stored.
 *
 * @returns {string} The current theme, either "light" or "dark".
 */
export const getTheme = () => {
  return (
    localStorage.getItem('theme') ||
    (window.matchMedia?.('(prefers-color-scheme: dark)').matches ?
      'dark'
    : 'light')
  );
};

/**
 * Class to manage application theme state and provide utilities for theme
 * switching, inversion, and listener management. Automatically detects system
 * theme changes and updates the application accordingly.
 */
class Theme {
  /** @type {Function[]} Holds an array of listeners for theme changes. */
  listeners = [];

  /**
   * Creates a new Theme instance and sets up system theme change detection.
   * Automatically updates stored theme when system preference changes.
   */
  constructor() {
    // Detects changes in the user's preferred color scheme.
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', ({ matches: isDark }) => {
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      this.reflect();
    });
  }

  /**
   * Adds a listener function to respond to theme changes.
   *
   * @param {Function} listener - The function to execute on theme change.
   * @param {boolean} exec - Whether to execute the listener immediately.
   */
  addListener(listener, exec = false) {
    if (exec) listener(getTheme());
    this.listeners.push(listener);
  }

  /**
   * Switches to the next theme (light or dark) and updates the application.
   */
  next() {
    localStorage.setItem('theme', this.invert);
    this.reflect();
  }

  /**
   * Updates the theme attribute on the root element and notifies listeners.
   */
  reflect() {
    const theme = getTheme();
    document.firstElementChild.setAttribute('data-theme', theme);
    this.listeners.forEach((listener) => listener(theme));
  }

  /**
   * Returns the inverted theme (light -> dark, dark -> light).
   *
   * @returns {string} The inverted theme.
   */
  get invert() {
    return getTheme() === 'light' ? 'dark' : 'light';
  }
}

/**
 * Creates an instance of the Theme class to manage the application's theme.
 * Exported for use throughout the application.
 */
export const appTheme = new Theme();
