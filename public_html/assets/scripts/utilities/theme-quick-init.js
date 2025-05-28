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
 * https://github.com/SebastienKeroack/sebastienkeroack-portfolio/blob/main/LICENSE
 * Apache License
 */

document.firstElementChild.setAttribute(
  "data-theme",
  localStorage.getItem("theme") ||
    (window.matchMedia?.("(prefers-color-scheme: dark)").matches ?
      "dark"
    : "light"),
);
