<?php

/**
 * Abstract class for handling form submissions, including input validation,
 * error management, and result conversion to HTML.
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

abstract class Form
{
    /**
     * Abstract method to submit the form.
     */
    abstract public function submit(): void;

    /**
     * @var array Holds the form inputs.
     */
    protected $inputs = [];

    /**
     * @var array Holds the form errors.
     */
    protected $errors = [];

    /**
     * @var string|null Holds the result of the form submission.
     */
    protected $result = null;

    /**
     * Adds a form input with a validation parser.
     *
     * @param string $key The key of the form input.
     * @param callable $parser The validation parser for the form input.
     */
    protected function add(string $key, callable $parser): void
    {
        try {
            if (!isset($_POST[$key])) {
                throw new Exception(
                    "The form field '<b>$key</b>' is required."
                );
            }

            $this->inputs[$key] = $parser($_POST[$key]);
        } catch (Exception $e) {
            $this->errors[] = $e->getMessage();
        }
    }

    /**
     * Checks if there are any errors in the form.
     *
     * @return bool True if there are errors, false otherwise.
     */
    public function anyError(): bool
    {
        return !empty($this->errors);
    }

    /**
     * Converts the form result or errors to HTML.
     *
     * @return string The HTML representation of the form result or errors.
     */
    public function toHTML(): string
    {
        if ($this->errors) {
            $errors = '<li>' . implode('</li><li>', $this->errors) . '</li>';
            return "<div data-value='false'><ul>$errors</ul></div>";
        }

        assert(isset($this->result));
        return "<div data-value='true'>{$this->result}</div>";
    }
}
