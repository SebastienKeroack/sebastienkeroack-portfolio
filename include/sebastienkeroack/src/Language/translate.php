<?php

/**
 * Provides a function to translate keys using the TRANSLATE array provided by
 * bootstrap.php, which loads the TRANSLATE array from the language files.
 *
 * @author
 * Sébastien Kéroack <dev@sebastienkeroack.com>
 * @copyright
 * 2025 Sébastien Kéroack. All rights reserved.
 * @license
 * https://github.com/SebastienKeroack/sebastienkeroack/blob/main/LICENSE
 * Apache License
 */

namespace SebastienKeroack\Language;

/**
 * Translates a given key using the TRANSLATE array.
 *
 * @param string $key The key to translate.
 * @return string The translated string or the original key if not found.
 */
function translate(string $key): string
{
    return TRANSLATE[$key] ?? $key;
}
