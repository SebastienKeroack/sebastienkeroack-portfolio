<?php

/**
 * Handles the submission of the contact form, including reCAPTCHA validation
 * and email sending.
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

use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as PHPMailerException;
use SebastienKeroack\Exceptions\Exception;

use function SebastienKeroack\Language\translate;

final class ContactForm extends ReCAPTCHAV2
{
    /**
     * Constructor method for the ContactForm class.
     * Adds validation rules for various form input fields.
     */
    public function __construct()
    {
        parent::__construct();
        $this->add('name', function (string $x): string {
            $x = substr(strip_tags($x), 0, 255);
            if (
                empty($x) || !preg_match(
                    "/^[a-zàâçéèêëîïôûùüÿñæœ \-.]*$/i",
                    $x
                )
            ) {
                throw new Exception('invalid_name');
            }

            return $x;
        });
        $this->add('email', function (string $x): string {
            $x = substr(strip_tags($x), 0, 255);
            if (!PHPMailer::validateAddress($x)) {
                throw new Exception('invalid_email');
            }

            return $x;
        });
        $this->add('tel', function (string $x): string {
            $x = substr(strip_tags($x), 0, 255);
            if (!preg_match('/^[0-9 .+\-()]*$/', $x)) {
                throw new Exception('invalid_tel');
            }

            return $x;
        });
        $this->add('subject', function (string $x): string {
            $x = substr(strip_tags($x), 0, 255);
            if (empty($x)) {
                throw new Exception('invalid_subject');
            }

            return $x;
        });
        $this->add('message', function (string $x): string {
            $x = substr(strip_tags($x), 0, 16384);
            if (empty($x)) {
                throw new Exception('invalid_message');
            }

            return $x;
        });
    }

    /**
     * Magic method to get form input values.
     *
     * @param string $key The key of the form input.
     * @return string The value of the form input.
     */
    public function __get(string $key): string
    {
        return $this->inputs[$key];
    }

    /**
     * Submits the form and handles the reCAPTCHA validation and email sending.
     */
    public function submit(): void
    {
        if ($this->anyError()) {
            return;
        }

        $mail = $this->getMailer();
        try {
            parent::submit();
            $this->sendFormToWebmaster($mail);
            $mail->clearAddresses();
            $mail->clearReplyTos();
            $this->sendConfirmationToUser($mail);
            $this->result = translate('mail_delivered');
        } catch (\Exception | Exception | PHPMailerException $e) {
            $this->errors[] = $e->getMessage();
        } finally {
            $mail->SmtpClose();
        }
    }

    /**
     * Initializes and configures the PHPMailer instance.
     *
     * @return PHPMailer The configured PHPMailer instance.
     */
    private function getMailer(): PHPMailer
    {
        $mail = new PHPMailer(true);
        $mail->setLanguage(LANG, PHPMAILER_DIR . 'language');
        $mail->setFrom('donotreply@sebastienkeroack.com', 'Sébastien Kéroack');
        $mail->isSMTP();
        //$mail->SMTPDebug = SMTP::DEBUG_SERVER;
        $mail->SMTPAuth = true;
        $mail->SMTPSecure = 'ssl';
        $mail->Username = 'donotreply@sebastienkeroack.com';
        $mail->Password = $_ENV['SMTP_PASSWORD'];
        $mail->CharSet = PHPMailer::CHARSET_UTF8;
        $mail->Host = 'mail.sebastienkeroack.com';
        $mail->Port = 465;
        $mail->isHTML(false);
        return $mail;
    }

    /**
     * Sends the form submission details to the webmaster.
     *
     * @param PHPMailer $mail The PHPMailer instance.
     * @throws PHPMailerException if there is an error sending the email.
     */
    private function sendFormToWebmaster(PHPMailer $mail): void
    {
        $mail->addAddress('contact@sebastienkeroack.com');
        $mail->addReplyTo($this->email, $this->name);
        $mail->Subject = "Contact form: $this->subject";
        $mail->Body = <<<EOT
            Contact form submission
            Name: $this->name
            Phone: $this->tel
            Email: $this->email
            Message: $this->message
            EOT;
        $mail->send();
    }

    /**
     * Sends a confirmation email to the user.
     *
     * @param PHPMailer $mail The PHPMailer instance.
     * @throws PHPMailerException if there is an error sending the email.
     */
    private function sendConfirmationToUser(PHPMailer $mail): void
    {
        $mail->addAddress($this->email, $this->name);
        $mail->Subject = translate('mail_contact_form_subject_confirmation');
        $mail->Body = translate('mail_contact_form_message_confirmation');
        $mail->send();
    }
}
