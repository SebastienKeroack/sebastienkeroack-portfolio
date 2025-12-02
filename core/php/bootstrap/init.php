<?php

/**
 * Initializes the application by loading Composer dependencies and setting
 * the production mode flag. This file should be included at the start of
 * the application's execution to ensure all required libraries are loaded
 * and environment constants are properly defined.
 *
 * @author
 * Sébastien Kéroack <dev@sebastienkeroack.com>
 * @copyright
 * 2025 Sébastien Kéroack. All rights reserved.
 * @license
 * https://github.com/SebastienKeroack/skportfolio/blob/main/LICENSE
 * Apache License
 */

// Load the required libraries and dependencies using Composer's autoloader.
require_once 'vendor/autoload.php';

// phpcs:disable PSR1.Files.SideEffects.FoundWithSymbols

// Define whether the application is in production mode based on the
// zend.assertions directive.
define(IN_PRODUCTION, ini_get('zend.assertions') === '-1');

// phpcs:enable
