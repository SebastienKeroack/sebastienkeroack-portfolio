<?php

/**
 * Custom exception class for handling application-specific exceptions.
 * Translates exception messages based on a provided key.
 *
 * @author
 * Sébastien Kéroack <dev@sebastienkeroack.com>
 * @copyright
 * 2025 Sébastien Kéroack. All rights reserved.
 * @license
 * https://github.com/SebastienKeroack/sebastienkeroack/blob/main/LICENSE
 * Apache License
 */

namespace SebastienKeroack\Exceptions;

use function SebastienKeroack\Language\translate;

class Exception extends \Exception
{
    /**
     * Exception constructor.
     *
     * @param string $key The translation key for the exception message.
     * @param int $code The exception code.
     * @param Throwable|null $previous The previous throwable used for
     *                                  exception chaining.
     */
    public function __construct(
        string $key,
        int $code = 0,
        Throwable $previous = null
    ) {
        parent::__construct(translate($key), $code, $previous);
    }
}
