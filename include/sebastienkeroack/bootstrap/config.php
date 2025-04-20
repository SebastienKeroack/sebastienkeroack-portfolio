<?php

/**
 * Defines various constants used throughout the application, including
 * production mode, project root directory, language settings, PHPMailer
 * language directory, and error types.
 *
 * @author
 * Sébastien Kéroack <dev@sebastienkeroack.com>
 * @copyright
 * 2025 Sébastien Kéroack. All rights reserved.
 * @license
 * https://github.com/SebastienKeroack/sebastienkeroack/blob/main/LICENSE
 * Apache License
 */

// Define whether the application is in production mode based on the
// zend.assertions directive.
define('IN_PRODUCTION', ini_get('zend.assertions') === '-1');

// Define the directory where the backend files are located.
// e.g. /home/rxtgsw86/sebastienkeroack/include/sebastienkeroack
define('INCLUDE_DIR', realpath(__DIR__ . '/..') . '/');

// Define the directory where the project files are located.
// e.g. /home/rxtgsw86/sebastienkeroack
define('PROJECT_DIR', realpath(__DIR__ . '/../../..') . '/');

// Define the directory where the language files for PHPMailer are located.
define('PHPMAILER_DIR', INCLUDE_DIR . 'vendor/phpmailer/phpmailer/');

// Define the language to be used, defaulting to 'en' if the LANG environment
// variable is not set.
define('LANG', array_key_exists('LANG', $_ENV) ? $_ENV['LANG'] : 'en');

// phpcs:disable
// Load the Dotenv library to manage environment variables from a .env file.
// This allows for better configuration management and security.
$dotenv = Dotenv\Dotenv::createImmutable(PROJECT_DIR);
$dotenv->load();
// phpcs:enable
