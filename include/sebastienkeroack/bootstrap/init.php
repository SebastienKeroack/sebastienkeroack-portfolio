<?php

/**
 * Initializes core functionalities by including essential files for constants,
 * error handling, language support, translation functions,
 * and exception handling.
 *
 * @author
 * Sébastien Kéroack <dev@sebastienkeroack.com>
 * @copyright
 * 2025 Sébastien Kéroack. All rights reserved.
 * @license
 * https://github.com/SebastienKeroack/sebastienkeroack/blob/main/LICENSE
 * Apache License
 */

 // Load the required libraries and dependencies using Composer's autoloader.
 require_once 'sebastienkeroack/vendor/autoload.php';

// This file must be included first as the constants are used.
require_once "sebastienkeroack/bootstrap/config.php";

// Sets up custom error handling mechanisms.
// Manage errors in a controlled manner, providing better error reporting
// and handling.
require_once "sebastienkeroack/bootstrap/error.php";

// Loads the language dictionary based on an environment variable declared in a
// '.htaccess' file. The language file is included dynamically based
// on the LANG constant, allowing for localization.
// Example: 'domain.com/en/' or 'domain.com/fr/' will load 'domain.lang-en.php'
// or 'domain.lang-fr.php' respectively.
require_once
  'sebastienkeroack/languages/sebastienkeroack.lang-' . LANG . '.php';
