/**
 * Provides core constants and utility functions for the application.
 * Includes environment detection (local or production), reCAPTCHA site keys,
 * language detection, and language-specific flags for localization.
 *
 * @author
 * Sébastien Kéroack <dev@sebastienkeroack.com>
 * @copyright
 * 2025 Sébastien Kéroack. All rights reserved.
 * @license
 * https://github.com/SebastienKeroack/sebastienkeroack/blob/main/LICENSE
 * Apache License
 */

// Detects if the application is running in a local development environment.
// Checks the hostname to determine if it matches common local network patterns.
export const IS_LOCAL = (() => {
  const hostname = window.location.hostname;

  return (
    // Localhost domain for development.
    hostname === "localhost" ||
    // Loopback IP address.
    hostname === "127.0.0.1" ||
    // Common home network IP range (192.168.x.x).
    hostname.startsWith("192.168.") ||
    // Private network IP range (10.x.x.x).
    hostname.startsWith("10.") ||
    // Private IP range (172.16.0.0 - 172.31.255.255).
    (hostname.startsWith("172.") &&
      parseInt(hostname.split(".")[1]) >= 16 &&
      parseInt(hostname.split(".")[1]) <= 31)
  );
})();

// Defines the reCAPTCHA site key based on the environment.
// Uses a testing key for local development and a production key otherwise.
export const SITE_KEY =
  IS_LOCAL ?
    // reCAPTCHA testing key for local environments.
    "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"
    // reCAPTCHA production key for live environments.
  : "6LeXw84kAAAAAITz52RWy9XIblmKKZ7rrmPbVmIZ";

// Extracts the language code from the URL path.
// Assumes the language code is the first two characters of the path.
export const LANGUAGE = window.location.pathname.substring(1, 3);

// Determines if the current language is French.
// Compares the extracted language code to "fr".
export const IS_FRENCH = LANGUAGE === "fr";
