<?php

namespace SKPortfolio;

final class Lang {
  private static array $data = [];

  /**
   * Get the language parts from a language code.
   *
   * @param string $langCode The language code to validate.
   * @return array Returns the matches array if valid,
   *               or an empty array if invalid.
   */
  public static function getLangParts(string $langCode): array {
    $matches = [];
    if (
      preg_match(
        '/^([a-z]{2})(_[a-z]{4})?(_[a-z]{2})?$/',
        strtolower($langCode),
        $matches,
      )
    ) {
      return [
        0 => $matches[0],
        'lang' => $matches[1],
        'script' => $matches[2] ?? '',
        'country' => $matches[3] ?? '',
      ];
    }
    return [];
  }

  public static function getLangCode(string $filename): string {
    $matches = [];
    preg_match('/^app\.lang-([a-z_]{2,})\.php$/', $filename, $matches);
    return $matches[1] ?? '';
  }

  public static function getLangCodes(string $langCode): array {
    if (!($langParts = self::getLangParts($langCode))) {
      return [];
    }

    $langCodes = [];
    if ($langParts['script'] && $langParts['country']) {
      $langCodes[] =
        $langParts['lang'] . $langParts['script'] . $langParts['country'];
    }
    if ($langParts['country']) {
      $langCodes[] = $langParts['lang'] . $langParts['country'];
    }
    if ($langParts['script']) {
      $langCodes[] = $langParts['lang'] . $langParts['script'];
    }
    $langCodes[] = $langParts['lang'];

    return $langCodes;
  }

  public static function getLangPath(
    array $langCodes,
    string $dirPath,
  ): string {
    $found = false;
    foreach ($langCodes as $code) {
      $filePath = $dirPath . DIRECTORY_SEPARATOR . 'app.lang-' . $code . '.php';
      if (is_readable($filePath)) {
        $found = true;
        break;
      }
    }

    return $found ? $filePath : '';
  }

  public static function loadLanguage(string $path): array {
    if (!is_readable($path)) {
      return [];
    }

    $data = [];
    $lines = file($path);

    foreach ($lines as $line) {
      $matches = [];
      if (
        preg_match(
          '/^\$LANG\[\'([a-z\d_]+)\'\]\s*=\s*(["\'])(.+)*?\2;/',
          $line,
          $matches,
        )
      ) {
        $data[$matches[1]] = $matches[3];
      }
    }

    return $data;
  }

  /**
   * Set the language for application.
   * The default language is English.
   *
   * @param string $langCode ISO 639-1 2-character language code
   *                         (e.g. French is "fr") Optionally, the language code
   *                         can be enhanced with a 4-character script
   *                         annotation and/or a 2-character country annotation.
   * @param string $langPath Path to the language file directory,
   *                         with trailing separator (slash).
   *
   * @return bool Returns true if the requested language was loaded,
   *              false otherwise.
   */
  public static function initialize(
    string $langCode = 'en',
    string $langDir = '',
  ): bool {
    // phpcs:disable Generic.Files.LineLength.TooLong
    // Define full set of translatable strings in English
    self::$data = [
      'invalid_captcha' => 'Please fill out the captcha form correctly.',
      'invalid_email' => 'Please enter a valid email.',
      'invalid_message' => 'Please enter a valid message.',
      'invalid_name' => 'Please enter a valid name.',
      'invalid_subject' => 'Please enter a valid subject.',
      'invalid_tel' => 'Please enter a valid phone number.',
      'mail_delivered' => 'Thank you!',
      'mail_delivery_failed' =>
        'Sorry, there seems to be a problem. Please try again later.',
      'unset_captcha' => 'Please check the captcha form.',
      'mail_contact_form_subject_confirmation' =>
        'Confirmation: the message has been successfully submitted! | Sébastien Kéroack',
      'mail_contact_form_message_confirmation' =>
        'Thank you for your message. It has been received and will be processed as soon as possible.',
    ];
    // phpcs:enable

    if ('en' === ($langCode = strtolower($langCode))) {
      return true;
    }

    if (!($langCodes = self::getLangCodes($langCode))) {
      return false;
    }

    $langDir = $langDir ?: dirname(__DIR__) . DIRECTORY_SEPARATOR . 'language';
    if (!($langPath = self::getLangPath($langCodes, $langDir))) {
      return false;
    }

    if (!($data = self::loadLanguage($langPath))) {
      return false;
    }

    self::$data = $data;
    return true;
  }

  public static function get(string $key): string {
    self::ensureInitialized();
    return self::$data[$key] ?? $key;
  }

  public static function getAll(): array {
    self::ensureInitialized();
    return self::$data;
  }

  public static function clear(): void {
    self::$data = [];
  }

  private static function ensureInitialized(): void {
    if (!self::$data) {
      self::initialize();
    }
  }
}
