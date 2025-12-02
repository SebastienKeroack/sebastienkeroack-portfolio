<?php

namespace SKPortfolio;

use Dotenv\Dotenv;

final class App {
  public readonly string $langCode;

  public function __construct(string $langCode = '') {
    $this->langCode = strtolower($langCode ?: $_ENV['LANG'] ?? 'en');
  }

  public function loadEnvironmentVariables($envDir = ''): bool {
    $envDir = $envDir ?: dirname(__DIR__);
    if (!is_dir($envDir)) {
      return false;
    }

    $dotenv = Dotenv::createMutable($envDir);
    $dotenv->load();
    return true;
  }

  /**
   * Set the language for application.
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
  public function setLanguage(
    string $langCode = '',
    string $langDir = '',
  ): bool {
    return Lang::initialize($langCode ?: $this->langCode, $langDir);
  }
}
