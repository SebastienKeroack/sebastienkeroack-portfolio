<?php

/**
 * Handles reCAPTCHA v2 validation for form submissions.
 * Adds a validation rule for the 'g-recaptcha-response' input field and
 * verifies the reCAPTCHA response.
 *
 * @author
 * Sébastien Kéroack <dev@sebastienkeroack.com>
 * @copyright
 * 2025 Sébastien Kéroack. All rights reserved.
 * @license
 * https://github.com/SebastienKeroack/sebastienkeroack/blob/main/LICENSE
 * Apache License
 */

namespace SebastienKeroack\Forms;

use SebastienKeroack\Exceptions\Exception;

class ReCAPTCHAV2 extends Form
{
    /**
     * Constructor method for the ReCAPTCHAV2 class.
     * Adds a validation rule for the 'g-recaptcha-response' input field.
     */
    public function __construct()
    {
        $this->add('g-recaptcha-response', function ($x) {
            if (empty($x)) {
                throw new Exception('unset_captcha');
            }

            return $x;
        });
    }

    /**
     * Submits the form and validates the reCAPTCHA response.
     *
     * @throws \Exception if the captcha is invalid.
     */
    public function submit(): void
    {
        if ($this->anyError()) {
            return;
        }

        $secret = $_ENV['RECAPTCHA_SECRET_KEY'];
        $response = urlencode($this->inputs['g-recaptcha-response']);
        $url = "https://www.google.com/recaptcha/api/siteverify?secret=$secret"
             . "&response=$response";
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $contents = curl_exec($ch);
        curl_close($ch);
        $result = json_decode($contents);
        if (json_last_error() !== JSON_ERROR_NONE || !$result->success) {
            throw new Exception('invalid_captcha');
        }
    }
}
