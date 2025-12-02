/**
 * Extends the base Form class to integrate reCAPTCHA v2 functionality.
 * Handles reCAPTCHA rendering, validation, and dynamic updates to the
 * submit button state based on form inputs and reCAPTCHA completion.
 * Ensures accessibility and theme compatibility for the reCAPTCHA widget.
 *
 * @author
 * Sébastien Kéroack <dev@sebastienkeroack.com>
 * @copyright
 * 2025 Sébastien Kéroack. All rights reserved.
 * @license
 * https://github.com/SebastienKeroack/skportfolio/blob/main/LICENSE
 * Apache License
 */

import { Form, setInputState } from '/assets/scripts/forms/form.mjs';
import { SITE_KEY } from '/assets/scripts/core.mjs';
import { appTheme, getTheme } from '/assets/scripts/theme.mjs';

/**
 * Class for forms with integrated reCAPTCHA v2 support.
 * Handles reCAPTCHA rendering, validation, and submit button state.
 */
export class ReCAPTCHAV2 extends Form {
  // Holds the reCAPTCHA container element.
  rc = null;

  // Tracks the state of reCAPTCHA and form inputs.
  #recaptcha = {
    // Indicates whether reCAPTCHA is completed.
    fill: false,
  };

  /**
   * Constructor for the ReCAPTCHAV2 class.
   * Initializes the form, selects the reCAPTCHA container, and disables
   * the submit button until validation is complete.
   * @param {string} name - The name of the form.
   */
  constructor(name) {
    super(name);

    // Select the reCAPTCHA container within the form.
    this.rc = this.form.querySelector('.g-recaptcha');

    // Disable the submit button initially until validation is complete.
    this.submitBtn.disabled = true;
  }

  /**
   * Adds an input field to the form and tracks its validation state.
   * @param {Object} options - Input field options.
   */
  add({ input, ...options }) {
    // Track if the input is optional or required.
    this.#recaptcha[input.name] = options['optional'] ?? false;
    super.add({ input, ...options });
  }

  /**
   * Handles changes to input fields and updates their validation state.
   * @param {Object} options - Input field options.
   */
  inputChange({ input, ...options }) {
    // Call the parent method to handle validation.
    const found = super.inputChange({ input, ...options });
    // Update the recaptcha state for this input.
    this.#recaptcha[input.name] = found;
    // Try to update the submit button state.
    this.tryUpdateSubmitBtnState();
  }

  /**
   * Updates the state of the submit button based on validation readiness.
   * @param {boolean} ready - Whether the form is ready for submission.
   */
  setSubmitBtnState(ready) {
    // Enable or disable the submit button.
    this.submitBtn.disabled = !ready;
    // Update the button's visual state.
    setInputState(this.submitBtn.classList, ready, true);
  }

  /**
   * Attempts to update the submit button state if reCAPTCHA is completed.
   */
  tryUpdateSubmitBtnState() {
    // Only update if reCAPTCHA is filled.
    if (!this.#recaptcha.fill) return;
    this.updateSubmitBtnState();
  }

  /**
   * Updates the submit button state based on all validation criteria.
   */
  updateSubmitBtnState() {
    // Do not update if the form has already been submitted.
    if (this.submitted) return;
    // Enable the button only if all fields and reCAPTCHA are valid.
    this.setSubmitBtnState(
      Object.values(this.#recaptcha).every((value) => value),
    );
  }

  /**
   * Callback function for reCAPTCHA completion or expiration.
   *
   * @param {boolean} done - Whether reCAPTCHA is completed.
   */
  rcCallback(done) {
    // Update the reCAPTCHA filled state.
    this.#recaptcha.fill = done;
    // Update the submit button state accordingly.
    this.updateSubmitBtnState();
  }

  /**
   * Renders the reCAPTCHA widget within the form.
   *
   * @param {number} tabindex - The tabindex for accessibility.
   */
  rcRender(tabindex) {
    // Render the reCAPTCHA widget using the global grecaptcha object.
    // eslint-disable-next-line no-undef
    grecaptcha.render(this.rc, {
      callback: () => this.rcCallback(true),
      'expired-callback': () => this.rcCallback(false),
      sitekey: SITE_KEY,
      tabindex: tabindex,
      theme: getTheme(),
    });

    // Set the tabindex for the reCAPTCHA iframe for accessibility.
    const rcFrame = this.rc.querySelector('iframe');
    rcFrame.setAttribute('tabindex', tabindex);

    // Update the reCAPTCHA theme dynamically when the application theme changes.
    appTheme.addListener((newTheme) => {
      // Replace the theme in the iframe src URL.
      const path = rcFrame.src.replace(/theme=[a-z]+/, `theme=${newTheme}`);
      rcFrame.setAttribute('src', path);
      // Reset reCAPTCHA state on theme change.
      this.rcCallback(false);
    });
  }

  /**
   * Submits the form and disables the submit button.
   */
  submit() {
    // Call the parent submit method.
    super.submit();
    // Disable the submit button after submission.
    this.setSubmitBtnState(false);
  }

  /**
   * Handles post-submission validation and re-enables the submit button if needed.
   *
   * @returns {Promise<boolean>} - Whether the validation was successful.
   */
  async postValidation() {
    // Call the parent postValidation method.
    const success = super.postValidation();

    // If validation failed, re-enable the button after a delay.
    if (!success) {
      // Wait for 2 seconds before re-enabling the submit button.
      await new Promise((r) => setTimeout(r, 2000));
      this.setSubmitBtnState(true);
    }

    return success;
  }
}
