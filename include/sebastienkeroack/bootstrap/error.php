<?php

/**
 * Sets a custom error handler function to manage errors in a controlled manner.
 * Logs errors and optionally displays them based on the configuration.
 *
 * @author
 * Sébastien Kéroack <dev@sebastienkeroack.com>
 * @copyright
 * 2025 Sébastien Kéroack. All rights reserved.
 * @license
 * https://github.com/SebastienKeroack/sebastienkeroack/blob/main/LICENSE
 * Apache License
 */

// Array mapping PHP error constants to their human-readable names
// phpcs:disable PSR1.Files.SideEffects.FoundWithSymbols
define('ERROR_TYPES', [
    E_ERROR => 'Error',
    E_WARNING => 'Warning',
    E_PARSE => 'Parse Error',
    E_NOTICE => 'Notice',
    E_CORE_ERROR => 'Core Error',
    E_CORE_WARNING => 'Core Warning',
    E_COMPILE_ERROR => 'Compile Error',
    E_COMPILE_WARNING => 'Compile Warning',
    E_USER_ERROR => 'User Error',
    E_USER_WARNING => 'User Warning',
    E_USER_NOTICE => 'User Notice',
    E_STRICT => 'Strict Notice',
    E_RECOVERABLE_ERROR => 'Recoverable Error',
    E_DEPRECATED => 'Deprecated',
    E_USER_DEPRECATED => 'User Deprecated',
]);
// phpcs:enable

set_error_handler(
    /**
     * Custom error handler function.
     *
     * @param int $errno The error number.
     * @param string $errstr The error message.
     * @param string $errfile The filename where the error occurred.
     * @param int $errline The line number where the error occurred.
     * @return bool True if the error was handled, false otherwise.
     */
    function (int $errno, string $errstr, string $errfile, int $errline): bool {
        if (!(error_reporting() & $errno)) {
            // This error code is not included in error_reporting, so let it
            // fall through to the standard PHP error handler
            return false;
        }

        // Format the error type
        $errtype = ERROR_TYPES[$errno] ?? 'Unknown Error';
        error_log("[$errno] $errtype: $errstr in $errfile on line $errline");
        if (ini_get('display_errors')) {
            $errtype = "<b>$errtype</b>";
            $errfile = substr($errfile, strlen(INCLUDE_DIR));
            $errfile = "<b>$errfile</b>";
            $errline = "<b>$errline</b>";
            echo "<p>$errtype: $errstr in $errfile on line $errline</p>";
        }

        // Don't execute PHP internal error handler
        return true;
    }
);
