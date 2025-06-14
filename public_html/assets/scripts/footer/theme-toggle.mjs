/**
 * Manages the theme toggle functionality for the website's footer.
 * Allows users to switch between light and dark themes and updates the
 * tooltip dynamically based on the selected theme and language.
 *
 * @author
 * Sébastien Kéroack <dev@sebastienkeroack.com>
 * @copyright
 * 2025 Sébastien Kéroack. All rights reserved.
 * @license
 * https://github.com/SebastienKeroack/sebastienkeroack-portfolio/blob/main/LICENSE
 * Apache License
 */

import { appTheme } from "/assets/scripts/theme.mjs";
import { IS_FRENCH } from "/assets/scripts/core.mjs";

// Initializes the theme toggle button in the footer.
// Sets up event listeners for toggling the theme and updating the tooltip.
document.addEventListener("DOMContentLoaded", () => {
  // Get the theme toggle button element by its ID.
  const sunAndMoon = document.getElementById("sun-and-moon");

  // Add a click event listener to the theme toggle button.
  // When clicked, it switches to the next theme (light or dark).
  sunAndMoon.addEventListener("click", appTheme.next.bind(appTheme));

  // Add a listener to update the tooltip text when the theme changes.
  // The tooltip text is set dynamically based on the new theme and language.
  appTheme.addListener(
    (newTheme) =>
      // Set the tooltip title based on the current theme and language.
      sunAndMoon.setAttribute(
        "title",
        {
          dark: IS_FRENCH ? "Foncé" : "Dark",
          light: IS_FRENCH ? "Clair" : "Light",
        }[newTheme],
      ),
    // Execute the listener immediately with the current theme.
    true,
  );
});
