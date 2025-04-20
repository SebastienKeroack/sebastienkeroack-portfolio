/**
 * Handles the dynamic language selection for the website's footer.
 * Updates the page URL to reflect the selected language and reloads the page
 * with the appropriate language prefix.
 *
 * @author
 * Sébastien Kéroack <dev@sebastienkeroack.com>
 * @copyright
 * 2025 Sébastien Kéroack. All rights reserved.
 * @license
 * https://github.com/SebastienKeroack/sebastienkeroack/blob/main/LICENSE
 * Apache License
 */

import { LANGUAGE } from "/js/core.mjs";

document.addEventListener("DOMContentLoaded", () => {
  // Select the dropdown element for language selection in the footer.
  const languages = document.querySelector("select[name='userlang']");

  // Set the currently selected language in the dropdown.
  // Matches the LANGUAGE constant to the corresponding option in the dropdown.
  languages.querySelector(`option[value='${LANGUAGE}']`).selected = true;

  // Add an event listener to handle changes in the language dropdown.
  // Triggered when the user selects a different language.
  languages.addEventListener("change", ({ target: { value: lang } }) => {
    // Get the current path of the URL, excluding the language prefix.
    // This ensures the user stays on the same page after changing the language.
    let path = window.location.pathname;
    path = path.substring(path.indexOf("/", 1));

    // Redirect the user to the same path but with the newly selected language.
    // Updates the URL to include the new language prefix.
    window.location.href = `${window.location.origin}/${lang}${path}`;
  });
});
