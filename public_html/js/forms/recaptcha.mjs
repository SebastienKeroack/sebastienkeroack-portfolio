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
 * https://github.com/SebastienKeroack/sebastienkeroack/blob/main/LICENSE
 * Apache License
 */

import { Form, setInputState } from "/js/forms/form.mjs";
import { SITE_KEY } from "/js/core.mjs";
import { appTheme, getTheme } from "/js/theme.mjs";

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
   * @param {string} name - The name of the form.
   */
  constructor(name) {
    super(name);

    // Select the reCAPTCHA container within the form.
    this.rc = this.form.querySelector(".g-recaptcha");

    // Disable the submit button initially until validation is complete.
    this.submitBtn.disabled = true;
  }

  /**
   * Adds an input field to the form and tracks its validation state.
   * @param {Object} options - Input field options.
   */
  add({ input, ...options }) {
    this.#recaptcha[input.name] = options["optional"] ?? false;
    super.add({ input, ...options });
  }

  /**
   * Handles changes to input fields and updates their validation state.
   * @param {Object} options - Input field options.
   */
  inputChange({ input, ...options }) {
    const found = super.inputChange({ input, ...options });
    this.#recaptcha[input.name] = found;
    this.tryUpdateSubmitBtnState();
  }

  /**
   * Updates the state of the submit button based on validation readiness.
   * @param {boolean} ready - Whether the form is ready for submission.
   */
  setSubmitBtnState(ready) {
    this.submitBtn.disabled = !ready;
    setInputState(this.submitBtn.classList, ready, true);
  }

  /**
   * Attempts to update the submit button state if reCAPTCHA is completed.
   */
  tryUpdateSubmitBtnState() {
    if (!this.#recaptcha.fill) return;
    this.updateSubmitBtnState();
  }

  /**
   * Updates the submit button state based on all validation criteria.
   */
  updateSubmitBtnState() {
    if (this.submitted) return;
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
    this.#recaptcha.fill = done;
    this.updateSubmitBtnState();
  }

  /**
   * Renders the reCAPTCHA widget within the form.
   *
   * @param {number} tabindex - The tabindex for accessibility.
   */
  rcRender(tabindex) {
    // eslint-disable-next-line no-undef
    grecaptcha.render(this.rc, {
      callback: () => this.rcCallback(true),
      "expired-callback": () => this.rcCallback(false),
      sitekey: SITE_KEY,
      tabindex: tabindex,
      theme: getTheme(),
    });

    // Set the tabindex for the reCAPTCHA iframe for accessibility.
    const rcFrame = this.rc.querySelector("iframe");
    rcFrame.setAttribute("tabindex", tabindex);

    // Update the reCAPTCHA theme dynamically when the application theme changes.
    appTheme.addListener((newTheme) => {
      const path = rcFrame.src.replace(/theme=[a-z]+/, `theme=${newTheme}`);
      rcFrame.setAttribute("src", path);
      this.rcCallback(false); // Reset reCAPTCHA state on theme change.
    });
  }

  /**
   * Submits the form and disables the submit button.
   */
  submit() {
    super.submit();
    this.setSubmitBtnState(false);
  }

  /**
   * Handles post-submission validation and re-enables the submit button if needed.
   *
   * @returns {Promise<boolean>} - Whether the validation was successful.
   */
  async postValidation() {
    const success = super.postValidation();

    if (!success) {
      // Wait for 2 seconds before re-enabling the submit button.
      await new Promise((r) => setTimeout(r, 2000));
      this.setSubmitBtnState(true);
    }

    return success;
  }
}
