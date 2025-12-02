/**
 * Provides a base class for handling form submissions, including input validation,
 * local storage management, and dynamic updates to form states. Integrates with
 * themes and languages for a seamless user experience.
 *
 * Includes utility functions for setting input states and managing iframe-based
 * post-submission validation.
 *
 * @author
 * Sébastien Kéroack <dev@sebastienkeroack.com>
 * @copyright
 * 2025 Sébastien Kéroack. All rights reserved.
 * @license
 * https://github.com/SebastienKeroack/skportfolio/blob/main/LICENSE
 * Apache License
 */

import { IS_LOCAL, IS_FRENCH, LANGUAGE } from '/assets/scripts/core.mjs';
import { appTheme, getTheme } from '/assets/scripts/theme.mjs';

/**
 * Updates the input field's state by adding or removing validation classes.
 *
 * @param {DOMTokenList} classes - The class list of the input element.
 * @param {boolean} valid - Whether the input is valid.
 * @param {boolean} empty - Whether the input is empty.
 */
export function setInputState(classes, valid, empty) {
  // Remove any previous validation classes.
  classes.remove('input-invalid');
  classes.remove('input-valid');

  // If the input is empty, do not add any validation class.
  if (empty) return;

  // Add the appropriate validation class based on validity.
  if (valid) classes.add('input-valid');
  else classes.add('input-invalid');
}

/**
 * Base class for handling form logic, validation, and submission.
 * Supports local storage caching, language adaptation, and theme integration.
 */
export class Form {
  form = null; // The form element.
  target = null; // The iframe used for post-submission validation.
  submitBtn = null; // The submit button of the form.
  submitted = false; // Tracks whether the form has been submitted.

  inputs = []; // Array of input elements in the form.
  registers = []; // Array of local storage keys for cached inputs.

  /**
   * Initializes the form by setting up event listeners and default states.
   *
   * @param {string} name - The ID of the form element.
   */
  constructor(name) {
    // Get the form element by its ID.
    this.form = document.getElementById(name);

    // Find the iframe used for post-submission validation.
    this.target = this.form.querySelector(`iframe[name='${name}-target']`);
    // Listen for the iframe's load event to trigger post-validation.
    this.target.addEventListener('load', this.postValidation.bind(this));

    // Find the submit button and set up its click event.
    this.submitBtn = this.form.querySelector("button[type='submit']");
    this.submitBtn.addEventListener('click', this.submit.bind(this));
    // Set the button label based on the current language.
    this.submitBtn.innerHTML = IS_FRENCH ? 'Soumettre' : 'Submit Now';
  }

  /**
   * Adds an input field to the form and optionally enables local storage caching.
   *
   * @param {Object} options - Input field options.
   * @param {HTMLInputElement} options.input - The input element to add.
   * @param {boolean} [options.store=false] - Whether to cache the input value.
   */
  add({ input, store = false, ...options }) {
    // Create a unique key for local storage if caching is enabled.
    const register = (options.register =
      store ? `${this.name}-store-${input.name}` : '');
    // Define the change event handler for the input.
    const eventChange = () => this.inputChange({ input, ...options });

    // If caching is enabled, restore the value from local storage.
    if (store) {
      this.registers.push(register);
      input.value = localStorage.getItem(register) ?? '';
    }

    // Run the change handler once to initialize validation state.
    eventChange();
    // Listen for changes to the input value.
    input.addEventListener('change', eventChange);
    // Add the input to the list of tracked inputs.
    this.inputs.push(input);
  }

  /**
   * Clears all cached input values from local storage.
   */
  clearLocalStorage() {
    // Iterate through all registered keys and clear their values.
    this.registers.forEach((item) => {
      localStorage.setItem(item, '');
    });
  }

  /**
   * Handles changes to input fields and updates their validation state.
   *
   * @param {Object} options - Input field options.
   * @param {HTMLInputElement} options.input - The input element.
   * @param {string} [options.regex=""] - The regex pattern for validation.
   * @param {string} [options.register=""] - The local storage key for caching.
   * @param {boolean} [options.optional=false] - Whether the input is optional.
   * @returns {boolean} Whether the input is valid.
   */
  inputChange({ input, regex = '', register = '', optional = false }) {
    // Get the current value of the input.
    const value = input.value;
    // Determine if the input is valid based on value, regex, and optional flag.
    const found = Boolean(
      (!!value || optional) && (!regex || value.match(regex)),
    );

    // If caching is enabled, store the value in local storage.
    if (register) localStorage.setItem(register, input.value);

    // Update the input's validation state visually.
    setInputState(input.classList, found, !value);

    return found;
  }

  /**
   * Submits the form by triggering the native form submission.
   */
  submit() {
    // Use the browser's built-in form submission.
    this.form.submit();
  }

  /**
   * Handles post-submission validation by analyzing the iframe's content.
   * Updates the form state and displays the validation result.
   *
   * @returns {Promise<boolean>} Whether the validation was successful.
   */
  async postValidation() {
    // Get the root element of the iframe's content.
    const innerHTML = this.target.contentDocument.firstElementChild;
    // Find the element that contains the validation result.
    const element = innerHTML.querySelector('div[data-value]');
    // Determine if the submission was successful.
    const success = element.getAttribute('data-value') === 'true';

    // Set the direction, theme, and language of the iframe.
    innerHTML.setAttribute('dir', 'ltr');
    innerHTML.setAttribute('lang', LANGUAGE);
    innerHTML.setAttribute('data-theme', getTheme());

    // Update the theme of the iframe when the website's theme changes.
    appTheme.addListener((newTheme) => {
      innerHTML.setAttribute('data-theme', newTheme);
    });

    // Display the iframe.
    this.target.style.display = 'block';

    // Set the height of the iframe to match its content.
    const innerContent = innerHTML.querySelector(IS_LOCAL ? 'body' : 'main');
    this.target.height = getComputedStyle(innerContent).height;

    if (success) {
      // Prevent the button from shrinking when changing its content.
      this.submitBtn.style.width = getComputedStyle(this.submitBtn).width;
      // Update the button label to indicate successful submission.
      this.submitBtn.innerHTML = IS_FRENCH ? 'Soumis!' : 'Submitted!';

      // Clear the cache since the form was successfully submitted.
      this.clearLocalStorage();

      // Mark the form as submitted.
      this.submitted = true;
    }

    return success;
  }
}
