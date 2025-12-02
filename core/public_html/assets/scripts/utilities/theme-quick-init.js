/**
 * Quickly sets the website theme on page load to prevent a flash of incorrect
 * theme. Reads the user's preference from localStorage or system settings and
 * applies it before rendering.
 *
 * @author
 * Sébastien Kéroack <dev@sebastienkeroack.com>
 * @copyright
 * 2025 Sébastien Kéroack. All rights reserved.
 * @license
 * https://github.com/SebastienKeroack/skportfolio/blob/main/LICENSE
 * Apache License
 */

// Set the data-theme attribute on the root element based on the user's
// preference stored in localStorage or the system color scheme. This ensures
// the correct theme is applied before the page renders, preventing a flash
// of the wrong theme (FOUC).
document.firstElementChild.setAttribute(
  'data-theme',
  // Use the theme stored in localStorage if available.
  // If not set, use the system color scheme preference.
  localStorage.getItem('theme') ||
    (window.matchMedia?.('(prefers-color-scheme: dark)').matches ?
      'dark'
    : 'light'),
);
