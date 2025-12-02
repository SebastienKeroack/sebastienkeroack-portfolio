/**
 * Implements client-side validation for the contact form, including input
 * validation using regular expressions and reCAPTCHA v2 integration.
 * Ensures that form fields meet the required criteria before submission.
 *
 * @author
 * Sébastien Kéroack <dev@sebastienkeroack.com>
 * @copyright
 * 2025 Sébastien Kéroack. All rights reserved.
 * @license
 * https://github.com/SebastienKeroack/skportfolio/blob/main/LICENSE
 * Apache License
 */

import { ReCAPTCHAV2 } from '/assets/scripts/forms/recaptcha.mjs';

/**
 * Extends the ReCAPTCHAV2 class to implement validation for the contact form.
 * Adds validation rules for each input field and integrates reCAPTCHA v2.
 */
export class Contact extends ReCAPTCHAV2 {
  /**
   * Constructor for the Contact class.
   * Initializes the form and sets up validation rules for its fields.
   */
  constructor() {
    // Call the parent class constructor with the form's ID.
    super('contact-form');

    // Add validation for the "name" input field.
    this.add({
      input: this.form.querySelector("input[name='name']"),
      // Regex to validate names with letters, accents, spaces, and hyphens.
      regex: /^[a-zàâçéèêëîïôûùüÿñæœ \-.]*$/i,
    });

    // Add validation for the "email" input field.
    this.add({
      input: this.form.querySelector("input[name='email']"),
      // Regex to validate email addresses.
      regex:
        /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/,
    });

    // Add validation for the "tel" (telephone) input field.
    this.add({
      input: this.form.querySelector("input[name='tel']"),
      // Regex to validate phone numbers with digits, spaces, and special chars.
      regex: /^[0-9 .+\-()]*$/,
      // Mark the field as optional.
      optional: true,
    });

    // Add validation for the "subject" input field.
    this.add({
      input: this.form.querySelector("input[name='subject']"),
      // Enable local storage caching for this field.
      store: true,
    });

    // Add validation for the "message" textarea field.
    this.add({
      input: this.form.querySelector("textarea[name='message']"),
      // Enable local storage caching for this field.
      store: true,
    });
  }
}
